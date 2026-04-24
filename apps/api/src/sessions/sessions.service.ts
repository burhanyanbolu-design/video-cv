import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';
import { transcribeQueue } from '../queues';
import { uploadToS3, getPresignedUrl, deleteFromS3 } from '../storage/s3-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw DB row — raw_video_url / clean_video_url hold S3 object keys, NOT public URLs.
 * Pre-signed URLs are generated on the fly and never persisted.
 */
export interface Session {
  id: string;
  user_id: string;
  status: string;
  /** S3 object key for the raw video (stored in the raw_video_url column) */
  raw_video_url: string | null;
  /** S3 object key for the cleaned video (stored in the clean_video_url column) */
  clean_video_url: string | null;
  transcript: unknown;
  cv_data: unknown;
  profile_id: string | null;
  created_at: Date;
}

/** What clients receive — video fields are pre-signed URLs (15-min TTL) */
export interface SessionView {
  id: string;
  user_id: string;
  status: string;
  raw_video_url: string | null;
  clean_video_url: string | null;
  transcript: unknown;
  cv_data: unknown;
  profile_id: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function toView(session: Session): Promise<SessionView> {
  return {
    id: session.id,
    user_id: session.user_id,
    status: session.status,
    transcript: session.transcript,
    cv_data: session.cv_data,
    profile_id: session.profile_id,
    created_at: session.created_at,
    // Replace S3 keys with short-lived pre-signed URLs
    raw_video_url: session.raw_video_url
      ? await getPresignedUrl(session.raw_video_url)
      : null,
    clean_video_url: session.clean_video_url
      ? await getPresignedUrl(session.clean_video_url)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Create session
// ---------------------------------------------------------------------------

export async function createSession(
  userId: string,
  videoBuffer: Buffer,
  mimeType: string,
): Promise<{ sessionId: string; status: string }> {
  const sessionId = uuidv4();
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const key = `raw-videos/${userId}/${sessionId}.${ext}`;

  // Upload raw video to S3 — key stored in DB, never the raw URL
  await uploadToS3(key, videoBuffer, mimeType);

  await db.query(
    `INSERT INTO sessions (id, user_id, status, raw_video_url, created_at)
     VALUES ($1, $2, 'pending', $3, NOW())`,
    [sessionId, userId, key],
  );

  // Enqueue transcription job
  await transcribeQueue.add('transcribe', { sessionId, userId });

  return { sessionId, status: 'pending' };
}

// ---------------------------------------------------------------------------
// List sessions for a user
// ---------------------------------------------------------------------------

export async function listSessions(userId: string): Promise<SessionView[]> {
  const result = await db.query<Session>(
    `SELECT id, user_id, status, raw_video_url, clean_video_url,
            transcript, cv_data, profile_id, created_at
     FROM sessions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return Promise.all(result.rows.map(toView));
}

// ---------------------------------------------------------------------------
// Get single session
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string, userId: string): Promise<SessionView> {
  const result = await db.query<Session>(
    `SELECT id, user_id, status, raw_video_url, clean_video_url,
            transcript, cv_data, profile_id, created_at
     FROM sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw Object.assign(new Error('Session not found'), { status: 404 });
  }

  return toView(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Delete session
// ---------------------------------------------------------------------------

export async function deleteSession(sessionId: string, userId: string): Promise<void> {
  const result = await db.query<Session>(
    `DELETE FROM sessions
     WHERE id = $1 AND user_id = $2
     RETURNING raw_video_url, clean_video_url`,
    [sessionId, userId],
  );

  if (!result.rowCount || result.rowCount === 0) {
    throw Object.assign(new Error('Session not found'), { status: 404 });
  }

  // Best-effort S3 cleanup (raw_video_url / clean_video_url hold S3 keys)
  const { raw_video_url, clean_video_url } = result.rows[0];
  const cleanups: Promise<void>[] = [];
  if (raw_video_url) cleanups.push(deleteFromS3(raw_video_url));
  if (clean_video_url) cleanups.push(deleteFromS3(clean_video_url));
  await Promise.allSettled(cleanups);
}
