import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, type JwtPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('user', null as unknown as JwtPayload);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api')) {
      return;
    }
    const publicRoutes = ['/api/health', '/api/auth/login', '/api/auth/callback', '/api/auth/token'];
    if (publicRoutes.some((r) => request.url.startsWith(r))) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    try {
      const token = authHeader.slice(7);
      request.user = verifyToken(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
