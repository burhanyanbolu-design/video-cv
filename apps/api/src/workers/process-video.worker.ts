import { Worker, Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { redisConnection } from '../queues/redis-connection';
import { publishQueue } from '../queues';
import { db } from '../db/client';
import { s3, uploadToS3 } from '../storage/s3-client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { emitToUser } from '../websocket/ws-server';
import type { CutSegment } from './clean.worker';

async function downloadToTmp(key: string, ext: string): Promise<string> {
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
  );
  const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  fs.writeFileSync(tmpPath, Buffer.concat(chunks));
  return tmpPath;
}

/**
 * Build an ffmpeg select/aselect filter that keeps only the segments NOT in the cut list.
 * cutList is sorted by start_ms ascending.
 */
function buildSelectFilter(cutList: CutSegment[], durationMs: number): string {
  // Invert cut list to get keep segments
  const keepSegments: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  const sorted = [...cutList].sort((a, b) => a.start_ms - b.start_ms);
  for (const cut of sorted) {
    if (cut.start_ms > cursor) {
      keepSegments.push({ start: cursor / 1000, end: cut.start_ms / 1000 });
    }
    cursor = cut.end_ms;
  }
  if (cursor < durationMs) {
    keepSegments.push({ start: cursor / 1000, end: durationMs / 1000 });
  }

  if (!keepSegments.length) return 'select=1,aselect=1';

  const expr = keepSegments
    .map((s) => `between(t,${s.start},${s.end})`)
    .join('+');

  return `select='${expr}',aselect='${expr}'`;
}

function getVideoDurationMs(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (err) return reject(err);
      resolve((meta.format.duration ?? 0) * 1000);
    });
  });
}

export const processVideoWorker = new Worker(
  'process-video',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    emitToUser(userId, { event: 'pipeline:progress', stage: 'process-video', pct: 0 });

    const { rows } = await db.query<{ raw_video_url: string; cv_data: Record<string, unknown> }>(
      `SELECT raw_video_url, cv_data FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length || !rows[0].raw_video_url) {
      throw new Error(`No raw_video_url for session ${sessionId}`);
    }

    const rawKey = rows[0].raw_video_url;
    const cutList: CutSegment[] = (rows[0].cv_data?.cut_list as CutSegment[]) ?? [];

    const inputPath = await downloadToTmp(rawKey, 'mp4');
    const outputPath = inputPath.replace('.mp4', '-clean.mp4');

    try {
      const durationMs = await getVideoDurationMs(inputPath);

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg(inputPath)
          .outputOptions([
            '-vf', `scale=-2:720`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
          ]);

        if (cutList.length > 0) {
          const filterExpr = buildSelectFilter(cutList, durationMs);
          cmd = cmd.complexFilter([
            `[0:v]${filterExpr.split(',aselect=')[0]},setpts=N/FRAME_RATE/TB[v]`,
            `[0:a]aselect='${filterExpr.split("aselect='")[1]?.replace(/'/g, '') ?? '1'}',asetpts=N/SR/TB[a]`,
          ], ['v', 'a']);
        }

        cmd
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });

      const cleanBuffer = fs.readFileSync(outputPath);
      const cleanKey = `clean-videos/${userId}/${sessionId}.mp4`;
      await uploadToS3(cleanKey, cleanBuffer, 'video/mp4');

      await db.query(
        `UPDATE sessions SET clean_video_url = $1, status = 'processing' WHERE id = $2`,
        [cleanKey, sessionId],
      );

      await publishQueue.add('publish', { sessionId, userId });

      emitToUser(userId, { event: 'pipeline:progress', stage: 'process-video', pct: 100 });
    } finally {
      fs.unlink(inputPath, () => {});
      fs.unlink(outputPath, () => {});
    }
  },
  { connection: redisConnection, concurrency: 1 },
);

processVideoWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'process-video', message: err.message });
});
