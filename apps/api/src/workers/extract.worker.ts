import { Worker, Job } from 'bullmq';
import OpenAI from 'openai';
import { redisConnection } from '../queues/redis-connection';
import { buildCvQueue } from '../queues';
import { db } from '../db/client';
import { emitToUser } from '../websocket/ws-server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CvData {
  name: string | null;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
  };
  work_experience: Array<{
    title: string;
    company: string;
    start_date?: string;
    end_date?: string;
    description?: string;
  }>;
  education: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  skills: string[];
}

const SYSTEM_PROMPT = `You are a CV extraction assistant. Given a spoken transcript, extract structured CV data.
Return ONLY valid JSON matching this schema:
{
  "name": string | null,
  "contact": { "email"?: string, "phone"?: string, "location"?: string },
  "work_experience": [{ "title": string, "company": string, "start_date"?: string, "end_date"?: string, "description"?: string }],
  "education": [{ "degree": string, "institution": string, "year"?: string }],
  "skills": string[]
}
Only include information explicitly stated in the transcript. Do not fabricate any data.`;

export const extractWorker = new Worker(
  'extract',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    emitToUser(userId, { event: 'pipeline:progress', stage: 'extract', pct: 0 });

    const { rows } = await db.query<{ transcript: Array<{ word: string }> }>(
      `SELECT transcript FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length) throw new Error(`Session ${sessionId} not found`);

    const transcriptText = (rows[0].transcript ?? []).map((t) => t.word).join(' ');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcriptText },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const cvData: CvData = JSON.parse(raw);

    // Validate required fields - only name is strictly required
    if (!cvData.name) {
      await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]);
      emitToUser(userId, {
        event: 'pipeline:error',
        stage: 'extract',
        message: 'Could not extract name from video',
      });
      return;
    }

    // Merge cv_data (preserve cut_list from clean stage)
    await db.query(
      `UPDATE sessions
       SET cv_data = COALESCE(cv_data, '{}'::jsonb) || $1::jsonb,
           status = 'building'
       WHERE id = $2`,
      [JSON.stringify(cvData), sessionId],
    );

    await buildCvQueue.add('build-cv', { sessionId, userId });

    emitToUser(userId, { event: 'pipeline:progress', stage: 'extract', pct: 100 });
  },
  { connection: redisConnection, concurrency: 2 },
);

extractWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'extract', message: err.message });
});
