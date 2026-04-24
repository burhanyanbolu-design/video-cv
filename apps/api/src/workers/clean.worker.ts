import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/redis-connection';
import { extractQueue } from '../queues';
import { db } from '../db/client';
import { emitToUser } from '../websocket/ws-server';

const FILLER_WORDS = new Set(['um', 'uh', 'er', 'like', 'you know']);
const PAUSE_THRESHOLD_MS = 1500;

export interface WordToken {
  word: string;
  start: number; // seconds (Whisper format)
  end: number;
}

export interface CutSegment {
  start_ms: number;
  end_ms: number;
}

/**
 * Identify filler words and long pauses; return cut list and cleaned tokens.
 */
export function buildCutList(words: WordToken[]): {
  cutList: CutSegment[];
  cleanedWords: WordToken[];
} {
  const cutList: CutSegment[] = [];
  const cleanedWords: WordToken[] = [];

  for (let i = 0; i < words.length; i++) {
    const token = words[i];
    const normalised = token.word.toLowerCase().replace(/[^a-z ]/g, '').trim();

    if (FILLER_WORDS.has(normalised)) {
      cutList.push({ start_ms: Math.round(token.start * 1000), end_ms: Math.round(token.end * 1000) });
      continue;
    }

    // Check pause before this word
    if (i > 0) {
      const prev = words[i - 1];
      const pauseMs = (token.start - prev.end) * 1000;
      if (pauseMs > PAUSE_THRESHOLD_MS) {
        cutList.push({
          start_ms: Math.round(prev.end * 1000),
          end_ms: Math.round(token.start * 1000),
        });
      }
    }

    cleanedWords.push(token);
  }

  return { cutList, cleanedWords };
}

export const cleanWorker = new Worker(
  'clean',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    emitToUser(userId, { event: 'pipeline:progress', stage: 'clean', pct: 0 });

    const { rows } = await db.query<{ transcript: WordToken[] }>(
      `SELECT transcript FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length) throw new Error(`Session ${sessionId} not found`);

    const words: WordToken[] = rows[0].transcript ?? [];
    const { cutList, cleanedWords } = buildCutList(words);

    // Persist cleaned transcript and cut list in metadata column
    await db.query(
      `UPDATE sessions
       SET transcript = $1,
           cv_data = COALESCE(cv_data, '{}'::jsonb) || jsonb_build_object('cut_list', $2::jsonb),
           status = 'extracting'
       WHERE id = $3`,
      [JSON.stringify(cleanedWords), JSON.stringify(cutList), sessionId],
    );

    await extractQueue.add('extract', { sessionId, userId });

    emitToUser(userId, { event: 'pipeline:progress', stage: 'clean', pct: 100 });
  },
  { connection: redisConnection, concurrency: 4 },
);

cleanWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'clean', message: err.message });
});
