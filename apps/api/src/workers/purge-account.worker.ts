import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/redis-connection';
import { db } from '../db/client';
import { deleteFromS3 } from '../storage/s3-client';
import { deleteProfileFromIndex } from '../search/elasticsearch-client';

const JOB_TIMEOUT_MS = 24 * 60 * 60 * 1_000; // 24 hours

export const purgeAccountWorker = new Worker(
  'purge-account',
  async (job: Job<{ userId: string }>) => {
    const { userId } = job.data;

    // 1. Collect all profile S3 keys and IDs before deleting rows
    const profilesResult = await db.query<{
      id: string;
      video_url: string | null;
      cv_pdf_url: string | null;
    }>(
      `SELECT id, video_url, cv_pdf_url FROM profiles WHERE user_id = $1`,
      [userId],
    );
    const profiles = profilesResult.rows;

    // 2. Collect all session S3 keys before deleting rows
    const sessionsResult = await db.query<{
      id: string;
      raw_video_url: string | null;
      clean_video_url: string | null;
    }>(
      `SELECT id, raw_video_url, clean_video_url FROM sessions WHERE user_id = $1`,
      [userId],
    );
    const sessions = sessionsResult.rows;

    // 3. Delete S3 objects for profiles (clean video + PDF)
    for (const profile of profiles) {
      if (profile.video_url) {
        await deleteFromS3(profile.video_url).catch(() => {});
      }
      if (profile.cv_pdf_url) {
        await deleteFromS3(profile.cv_pdf_url).catch(() => {});
      }
    }

    // 4. Delete S3 objects for sessions (raw video + clean video)
    for (const session of sessions) {
      if (session.raw_video_url) {
        await deleteFromS3(session.raw_video_url).catch(() => {});
      }
      if (session.clean_video_url) {
        await deleteFromS3(session.clean_video_url).catch(() => {});
      }
    }

    // 5. Remove Elasticsearch documents for all profiles
    for (const profile of profiles) {
      await deleteProfileFromIndex(profile.id).catch(() => {});
    }

    // 6. Hard-delete Session rows
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);

    // 7. Hard-delete Profile rows
    await db.query(`DELETE FROM profiles WHERE user_id = $1`, [userId]);

    // 8. Hard-delete the User row
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
  },
  {
    connection: redisConnection,
    concurrency: 2,
    lockDuration: JOB_TIMEOUT_MS,
  },
);

purgeAccountWorker.on('failed', (job, err) => {
  console.error(`purge-account job ${job?.id} failed for user ${job?.data?.userId}:`, err.message);
});
