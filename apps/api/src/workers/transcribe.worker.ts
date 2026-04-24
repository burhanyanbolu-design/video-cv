import { Worker, Job } from 'bullmq';
import OpenAI from 'openai';
import { redisConnection } from '../queues/redis-connection';
import { cleanQueue } from '../queues';
import { db } from '../db/client';
import { s3 } from '../storage/s3-client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { emitToUser } from '../websocket/ws-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function downloadFromS3(key: string): Promise<Buffer> {
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const transcribeWorker = new Worker(
  'transcribe',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    // Mark transcribing
    await db.query(`UPDATE sessions SET status = 'transcribing' WHERE id = $1`, [sessionId]);
    emitToUser(userId, { event: 'pipeline:progress', stage: 'transcribe', pct: 0 });

    // Fetch raw video S3 key
    const { rows } = await db.query<{ raw_video_url: string }>(
      `SELECT raw_video_url FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length || !rows[0].raw_video_url) {
      throw new Error(`No raw_video_url for session ${sessionId}`);
    }

    const videoBuffer = await downloadFromS3(rows[0].raw_video_url);

    // Call Whisper with verbose_json for word-level timestamps
    const uint8Array = new Uint8Array(videoBuffer);
    const file = new File([uint8Array], 'audio.mp4', { type: 'video/mp4' });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    // Store transcript JSONB and advance status
    await db.query(
      `UPDATE sessions SET transcript = $1, status = 'cleaning' WHERE id = $2`,
      [JSON.stringify(transcription.words ?? []), sessionId],
    );

    // Enqueue next stage
    await cleanQueue.add('clean', { sessionId, userId });

    emitToUser(userId, { event: 'pipeline:progress', stage: 'transcribe', pct: 100 });
  },
  { connection: redisConnection, concurrency: 2 },
);

transcribeWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'transcribe', message: err.message });
});
