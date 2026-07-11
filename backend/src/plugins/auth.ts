import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { parse as parseCookie } from 'cookie';
import { verifyToken, type JwtPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/token',
];

function getPath(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

function getToken(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    if (cookies.token) {
      return cookies.token;
    }
  }
  return undefined;
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest('user', null as unknown as JwtPayload);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.url.startsWith('/api')) {
      return;
    }
    if (PUBLIC_ROUTES.includes(getPath(request.url))) {
      return;
    }

    const token = getToken(request);
    if (!token) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    try {
      request.user = verifyToken(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
