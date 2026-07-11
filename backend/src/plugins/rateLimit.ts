import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { getRedis } from '../lib/redis.js';

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis: getRedis(),
    allowList: (req) => req.url === '/api/health',
    skipOnError: true,
  });
}
