import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken, isAdminEmail } from '../lib/jwt.js';
import { getEnv } from '../lib/env.js';
import { exchangeCode, getUserInfo } from '../services/m365.js';
import { audit } from '../services/audit.js';

const callbackSchema = z.object({
  code: z.string(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/login', async (_req, reply) => {
    const { getAuthUrl } = await import('../services/m365.js');
    return reply.redirect(getAuthUrl());
  });

  app.get('/api/auth/callback', async (req, reply) => {
    const parsed = callbackSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      const tokenResponse = await exchangeCode(parsed.data.code);
      const userInfo = await getUserInfo(tokenResponse.access_token);
      const email = (userInfo.mail || userInfo.userPrincipalName).toLowerCase();

      const user = await prisma.user.upsert({
        where: { email },
        update: { name: userInfo.displayName, azureAdObjectId: userInfo.id },
        create: {
          email,
          name: userInfo.displayName,
          azureAdObjectId: userInfo.id,
        },
      });

      const jwt = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        isAdmin: isAdminEmail(user.email),
      });

      void audit('user', user.id, 'LOGIN', req.user?.sub ?? null, { method: 'm365' });

      return reply.redirect(`${getEnv().FRONTEND_URL}/auth/callback?token=${jwt}`);
    } catch (err) {
      app.log.error(err, 'Auth callback failed');
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  app.post('/api/auth/token', async (req, reply) => {
    const schema = z.object({ accessToken: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing accessToken' });
    }

    try {
      const userInfo = await getUserInfo(parsed.data.accessToken);
      const email = (userInfo.mail || userInfo.userPrincipalName).toLowerCase();

      const user = await prisma.user.upsert({
        where: { email },
        update: { name: userInfo.displayName, azureAdObjectId: userInfo.id },
        create: { email, name: userInfo.displayName, azureAdObjectId: userInfo.id },
      });

      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        isAdmin: isAdminEmail(user.email),
      });

      void audit('user', user.id, 'LOGIN', req.user?.sub ?? null, { method: 'token' });

      return { token, user: { ...user, isAdmin: isAdminEmail(user.email) } };
    } catch (err) {
      app.log.error(err, 'Token exchange failed');
      return reply.status(500).send({ error: 'Token exchange failed' });
    }
  });

  app.get('/api/auth/me', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { ...user, isAdmin: isAdminEmail(user.email) };
  });

  app.patch('/api/auth/me', async (req, reply) => {
    const schema = z.object({
      locale: z.enum(['de', 'en']).optional(),
      theme: z.enum(['light', 'dark']).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: parsed.data,
    });

    return { ...user, isAdmin: isAdminEmail(user.email) };
  });
}
