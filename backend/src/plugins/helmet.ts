import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export async function registerHelmet(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              fontSrc: ["'self'", 'https:', 'data:'],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
              imgSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              scriptSrcAttr: ["'none'"],
              styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
  });
}
