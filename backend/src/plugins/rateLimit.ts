import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getRedis } from '../lib/redis.js';

function clientKey(req: FastifyRequest): string {
  const flyClientIp = req.headers['fly-client-ip'];
  if (typeof flyClientIp === 'string' && flyClientIp) return flyClientIp;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 2] ?? parts[0] ?? req.ip;
    if (parts.length === 1) return parts[0] ?? req.ip;
  }
  return req.ip;
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis: getRedis(),
    keyGenerator: clientKey,
    allowList: (req, _key) => {
      if (req.url === '/api/health') return true;
      // Static SPA assets and the index.html fallback should not be rate limited.
      if (!req.url.startsWith('/api')) return true;
      return false;
    },
    skipOnError: true,
  });
}
