import Redis from 'ioredis';
import { getEnv } from './env.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 500,
      commandTimeout: 1000,
      lazyConnect: true,
    });
  }
  return _redis;
}

export async function closeRedis(): Promise<void> {
  await _redis?.quit();
}
