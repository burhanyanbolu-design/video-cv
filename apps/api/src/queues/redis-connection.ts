import { ConnectionOptions } from 'bullmq';

/**
 * Shared Redis connection options used by all BullMQ queues and workers.
 * Values are read from environment variables with sensible local defaults.
 */
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD ?? undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null, // required by BullMQ
};
