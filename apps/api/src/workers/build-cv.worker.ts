import { Worker, Job } from 'bullmq';
import puppeteer from 'puppeteer';
import { redisConnection } from '../queues/redis-connection';
import { processVideoQueue } from '../queues';
import { db } from '../db/client';
import { uploadToS3 } from '../storage/s3-client';
import { emitToUser } from '../websocket/ws-server';
import type { CvData } from './extract.worker';

function buildHtml(cv: CvData): string {
  const workHtml = cv.work_experience?.length
    ? `<section>
        <h2>Work Experience</h2>
        ${cv.work_experience
          .map(
            (w) => `<div class="entry">
              <strong>${w.title}</strong> at ${w.company}
              ${w.start_date ? `<span class="date">${w.start_date}${w.end_date ? ` – ${w.end_date}` : ''}</span>` : ''}
              ${w.description ? `<p>${w.description}</p>` : ''}
            </div>`,
          )
          .join('')}
      </section>`
    : '';

  const eduHtml = cv.education?.length
    ? `<section>
        <h2>Education</h2>
        ${cv.education
          .map(
            (e) => `<div class="entry">
              <strong>${e.degree}</strong> — ${e.institution}
              ${e.year ? `<span class="date">${e.year}</span>` : ''}
            </div>`,
          )
          .join('')}
      </section>`
    : '';

  const skillsHtml = cv.skills?.length
    ? `<section><h2>Skills</h2><p>${cv.skills.join(', ')}</p></section>`
    : '';

  const contactParts: string[] = [];
  if (cv.contact?.email) contactParts.push(cv.contact.email);
  if (cv.contact?.phone) contactParts.push(cv.contact.phone);
  if (cv.contact?.location) contactParts.push(cv.contact.location);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
  h1 { margin-bottom: 4px; }
  .contact { color: #555; margin-bottom: 20px; }
  h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .entry { margin-bottom: 12px; }
  .date { color: #777; font-size: 0.9em; margin-left: 8px; }
</style>
</head>
<body>
  <h1>${cv.name ?? ''}</h1>
  ${contactParts.length ? `<p class="contact">${contactParts.join(' · ')}</p>` : ''}
  ${workHtml}
  ${eduHtml}
  ${skillsHtml}
</body>
</html>`;
}

export const buildCvWorker = new Worker(
  'build-cv',
  async (job: Job<{ sessionId: string; userId: string }>) => {
    const { sessionId, userId } = job.data;

    emitToUser(userId, { event: 'pipeline:progress', stage: 'build-cv', pct: 0 });

    const { rows } = await db.query<{ cv_data: Record<string, unknown> }>(
      `SELECT cv_data FROM sessions WHERE id = $1`,
      [sessionId],
    );
    if (!rows.length) throw new Error(`Session ${sessionId} not found`);

    const cvData = rows[0].cv_data as unknown as CvData;
    const html = buildHtml(cvData);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      const pdfKey = `cv-pdfs/${userId}/${sessionId}.pdf`;
      await uploadToS3(pdfKey, Buffer.from(pdfBuffer), 'application/pdf');

      // Merge pdf key into cv_data and advance status
      await db.query(
        `UPDATE sessions
         SET cv_data = COALESCE(cv_data, '{}'::jsonb) || jsonb_build_object('cv_pdf_url', $1),
             status = 'processing'
         WHERE id = $2`,
        [pdfKey, sessionId],
      );

      await processVideoQueue.add('process-video', { sessionId, userId });

      emitToUser(userId, { event: 'pipeline:progress', stage: 'build-cv', pct: 100 });
    } catch (err) {
      await browser.close().catch(() => {});
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 1 },
);

buildCvWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { sessionId, userId } = job.data as { sessionId: string; userId: string };
  await db.query(`UPDATE sessions SET status = 'error' WHERE id = $1`, [sessionId]).catch(() => {});
  emitToUser(userId, { event: 'pipeline:error', stage: 'build-cv', message: err.message });
});
