import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Queue } from 'bullmq';
import { db } from '../db/client';
import { redisConnection } from '../queues/redis-connection';

const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';
const PRIVACY_POLICY_VERSION = process.env.PRIVACY_POLICY_VERSION ?? '1.0';

/** Hard-purge queue: triggered when a user deletes their account. */
const purgeQueue = new Queue('purge-account', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: TOKEN_TTL });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<{ token: string; userId: string }> {
  const { email, password } = input;

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw Object.assign(new Error('Email already registered'), { status: 409 });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const consentAt = new Date();

  const result = await db.query<{ id: string }>(
    `INSERT INTO users (email, password, consent_at, privacy_policy_version)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [email, hash, consentAt, PRIVACY_POLICY_VERSION],
  );

  const userId = result.rows[0].id;
  return { token: signToken(userId), userId };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput): Promise<{ token: string; userId: string }> {
  const { email, password } = input;

  const result = await db.query<{ id: string; password: string; deleted_at: Date | null }>(
    'SELECT id, password, deleted_at FROM users WHERE email = $1',
    [email],
  );

  const user = result.rows[0];
  if (!user || user.deleted_at !== null) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  return { token: signToken(user.id), userId: user.id };
}

// ---------------------------------------------------------------------------
// Logout  (stateless JWT — client discards token; placeholder for token blocklist)
// ---------------------------------------------------------------------------

export async function logout(_userId: string): Promise<void> {
  // With stateless JWTs, logout is handled client-side.
  // A token blocklist (Redis SET with TTL) can be added here when needed.
}

// ---------------------------------------------------------------------------
// Delete account
// ---------------------------------------------------------------------------

export async function deleteAccount(userId: string): Promise<void> {
  const result = await db.query<{ deleted_at: Date | null }>(
    'SELECT deleted_at FROM users WHERE id = $1',
    [userId],
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (result.rows[0].deleted_at !== null) {
    throw Object.assign(new Error('Account already deleted'), { status: 410 });
  }

  await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);

  // Enqueue hard-purge job — worker deletes all rows and S3 objects within 24 h
  await purgeQueue.add('purge', { userId }, { delay: 0 });
}
