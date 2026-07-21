import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_req, reply) => {
    const checks: Record<string, string> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      const redis = getRedis();
      const waitReady = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Redis timeout')), 5000);
        if (redis.status === 'ready') {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (redis.status === 'wait' || redis.status === 'end') {
          redis.connect().catch(reject);
        }
        const onReady = () => {
          clearTimeout(timeout);
          redis.off('ready', onReady);
          redis.off('error', onError);
          resolve();
        };
        const onError = (err: Error) => {
          clearTimeout(timeout);
          redis.off('ready', onReady);
          redis.off('error', onError);
          reject(err);
        };
        redis.once('ready', onReady);
        redis.once('error', onError);
      });
      await waitReady;
      const pong = await Promise.race([
        redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 5000)),
      ]);
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}
