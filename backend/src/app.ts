import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { registerCors } from './plugins/cors.js';
import { registerHelmet } from './plugins/helmet.js';
import { registerRateLimit } from './plugins/rateLimit.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { moduleRoutes } from './routes/modules.js';
import { requirementRoutes } from './routes/requirements.js';
import { commentRoutes } from './routes/comments.js';
import { glossaryRoutes } from './routes/glossary.js';
import { exportRoutes } from './routes/export.js';
import { usecaseRoutes } from './routes/usecases.js';
import { tagRoutes } from './routes/tags.js';
import { userRoutes } from './routes/users.js';
import { auditRoutes } from './routes/audit.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    trustProxy: 2,
    bodyLimit: 5 * 1024 * 1024,
  });

  await registerCors(app);
  await registerHelmet(app);
  await registerRateLimit(app);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(moduleRoutes);
  await app.register(requirementRoutes);
  await app.register(commentRoutes);
  await app.register(glossaryRoutes);
  await app.register(exportRoutes);
  await app.register(usecaseRoutes);
  await app.register(tagRoutes);
  await app.register(userRoutes);
  await app.register(auditRoutes);

  app.setErrorHandler((err, _req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      app.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const stack = err instanceof Error ? err.stack : undefined;
    return reply.status(500).send({ error: message, stack });
  });

  if (process.env.NODE_ENV === 'production') {
    const publicDir = path.join(process.cwd(), 'public');
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
