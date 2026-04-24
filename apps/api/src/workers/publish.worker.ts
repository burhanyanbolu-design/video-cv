import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { redisConnection } from '../queues/redis-connection';
import { db } from '../db/client';
import { indexProfile } from '../search/elasticsearch-client';
import { emitToUser } from '../websocket/ws-server';

export const publishWorker = new Worker(
  'publish',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    emitToUser(userId, { event: 'pipeline:progress', stage: 'publish', pct: 0 });

    const { rows } = await db.query<{
      clean_video_url: string;
      cv_data: Record<string, unknown>;
    }>(
      `SELECT clean_video_url, cv_data FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length) throw new Error(`Session ${sessionId} not found`);

    const { clean_video_url, cv_data } = rows[0];
    const cvPdfUrl = cv_data?.cv_pdf_url as string | undefined;

    const profileId = uuidv4();
    const slug = uuidv4(); // UUID-based public slug

    await db.query(
      `INSERT INTO profiles (id, session_id, user_id, slug, cv_pdf_url, video_url, visibility, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'private', NOW() + INTERVAL '90 days', NOW())`,
      [profileId, sessionId, userId, slug, cvPdfUrl ?? null, clean_video_url ?? null],
    );

    await db.query(
      `UPDATE sessions SET status = 'complete', profile_id = $1 WHERE id = $2`,
      [profileId, sessionId],
    );

    const profileUrl = `/profiles/${slug}`;

    emitToUser(userId, {
      event: 'pipeline:complete',
      profileUrl,
      profileId,
      slug,
    });
  },
  { connection: redisConnection, concurrency: 4 },
);

publishWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'publish', message: err.message });
});
