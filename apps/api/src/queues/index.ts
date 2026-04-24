import { Queue } from 'bullmq';
import { redisConnection } from './redis-connection';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

/** Transcribe raw video via Whisper and produce a time-stamped transcript. */
export const transcribeQueue = new Queue('transcribe', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Remove filler words and long pauses; produce a cleaned transcript + cut list. */
export const cleanQueue = new Queue('clean', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Extract structured CV_Data from the cleaned transcript via LLM. */
export const extractQueue = new Queue('extract', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Render CV_Data to PDF and upload to S3. */
export const buildCvQueue = new Queue('build-cv', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Apply the cut list to the raw video with FFmpeg and upload cleaned MP4 to S3. */
export const processVideoQueue = new Queue('process-video', {
  connection: redisConnection,
  defaultJobOptions,
});

/** Create the Profile row, index in Elasticsearch, and emit pipeline:complete. */
export const publishQueue = new Queue('publish', {
  connection: redisConnection,
  defaultJobOptions,
});

/** All pipeline queues in execution order. */
export const pipelineQueues = [
  transcribeQueue,
  cleanQueue,
  extractQueue,
  buildCvQueue,
  processVideoQueue,
  publishQueue,
] as const;
