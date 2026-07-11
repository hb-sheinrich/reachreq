import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { isAdminEmail, isAllowedEmail } from '../lib/auth.js';
import { getEnv } from '../lib/env.js';
import { exchangeCode, getUserInfo, getAuthUrl, generateOAuthSecret, validateM365Token } from '../services/m365.js';
import { audit } from '../services/audit.js';

const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function userRole(email: string): 'ADMIN' | 'CONTRIBUTOR' {
  return isAdminEmail(email) ? 'ADMIN' : 'CONTRIBUTOR';
}

function cookieOptions() {
  const env = getEnv();
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: isProduction,
  };
}

function setAuthCookie(reply: FastifyReply, token: string) {
  reply.header('Set-Cookie', serializeCookie('token', token, {
    ...cookieOptions(),
    maxAge: COOKIE_MAX_AGE_MS,
  }));
}

function clearOAuthCookies(reply: FastifyReply) {
  const cookies = [
    serializeCookie('m365_state', '', { ...cookieOptions(), maxAge: 0 }),
    serializeCookie('m365_nonce', '', { ...cookieOptions(), maxAge: 0 }),
  ];
  reply.header('Set-Cookie', cookies);
}

function setOAuthCookies(reply: FastifyReply, state: string, nonce: string) {
  const opts = {
    ...cookieOptions(),
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
  };
  const cookies = [
    serializeCookie('m365_state', state, opts),
    serializeCookie('m365_nonce', nonce, opts),
  ];
  reply.header('Set-Cookie', cookies);
}

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/login', async (_req, reply) => {
    const state = generateOAuthSecret();
    const nonce = generateOAuthSecret();
    setOAuthCookies(reply, state, nonce);
    return reply.redirect(getAuthUrl(state, nonce));
  });

  app.get('/api/auth/callback', async (req, reply) => {
    const parsed = callbackSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing authorization code or state' });
    }

    const { code, state } = parsed.data;
    const cookies = parseCookie(req.headers.cookie || '');
    const storedState = cookies.m365_state;
    const storedNonce = cookies.m365_nonce;

    if (!storedState || storedState !== state) {
      return reply.status(400).send({ error: 'Invalid or missing state parameter' });
    }

    try {
      const tokenResponse = await exchangeCode(code);
      if (!tokenResponse.id_token) {
        return reply.status(400).send({ error: 'Missing id_token from identity provider' });
      }

      const claims = await validateM365Token(tokenResponse.id_token, {
        type: 'id',
        nonce: storedNonce,
      });

      const email = (claims.email || claims.preferred_username || '').toLowerCase();
      if (!email) {
        return reply.status(400).send({ error: 'Identity token contains no email' });
      }

      if (!isAllowedEmail(email)) {
        return reply.status(403).send({ error: 'User not authorized' });
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: claims.name || email,
          azureAdObjectId: claims.oid,
          role: userRole(email),
        },
        create: {
          email,
          name: claims.name || email,
          azureAdObjectId: claims.oid,
          role: userRole(email),
        },
      });

      const jwt = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.role === 'ADMIN',
      });

      setAuthCookie(reply, jwt);
      clearOAuthCookies(reply);

      void audit('user', user.id, 'LOGIN', null, { method: 'm365' });

      // In development the frontend and backend may be on different ports,
      // so httpOnly cookies are not reliably sent. Fall back to a URL
      // fragment that the SPA reads and immediately clears.
      const env = getEnv();
      if (env.NODE_ENV === 'production') {
        return reply.redirect(`${env.FRONTEND_URL}/auth/callback`);
      }
      return reply.redirect(`${env.FRONTEND_URL}/auth/callback#token=${jwt}`);
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
      const accessToken = parsed.data.accessToken;
      const claims = await validateM365Token(accessToken, { type: 'access' });
      const userInfo = await getUserInfo(accessToken);
      const email = (userInfo.mail || userInfo.userPrincipalName || claims.preferred_username || '').toLowerCase();

      if (!email) {
        return reply.status(400).send({ error: 'No email found in token' });
      }

      if (!isAllowedEmail(email)) {
        return reply.status(403).send({ error: 'User not authorized' });
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: userInfo.displayName || claims.name || email,
          azureAdObjectId: claims.oid,
          role: userRole(email),
        },
        create: {
          email,
          name: userInfo.displayName || claims.name || email,
          azureAdObjectId: claims.oid,
          role: userRole(email),
        },
      });

      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.role === 'ADMIN',
      });

      setAuthCookie(reply, token);

      void audit('user', user.id, 'LOGIN', null, { method: 'token' });

      return { user: { ...user, isAdmin: user.role === 'ADMIN' } };
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

    return { user: { ...user, isAdmin: user.role === 'ADMIN' } };
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

    return { ...user, isAdmin: user.role === 'ADMIN' };
  });
}
