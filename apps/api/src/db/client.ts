import { Pool } from 'pg';

/**
 * Shared PostgreSQL connection pool.
 * All services import this singleton rather than creating their own pools.
 */
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
