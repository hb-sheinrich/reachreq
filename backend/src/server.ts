import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';

async function main() {
  const env = getEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info('Shutting down...');
    await app.close();
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
