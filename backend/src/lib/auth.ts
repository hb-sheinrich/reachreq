import type { FastifyRequest, FastifyReply } from 'fastify';
import { getEnv, getAdminEmails } from './env.js';
import type { JwtPayload, UserRole } from './jwt.js';

export function getAllowedEmails(): string[] {
  return getEnv()
    .ALLOWED_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getAllowedDomains(): string[] {
  return getEnv()
    .ALLOWED_DOMAINS.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (isAdminEmail(e)) return true;
  if (getAllowedEmails().includes(e)) return true;
  const domain = e.split('@')[1];
  if (domain && getAllowedDomains().includes(domain)) return true;
  return false;
}

export function isAdminEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  for (const admin of getAdminEmails()) {
    const a = admin.trim();
    if (!a) continue;
    if (a === e) return true;
    // Support wildcard entries like *@hup.de
    if (a.includes('@')) {
      const [user, domain] = a.split('@');
      if (user === '*' && e.endsWith(`@${domain}`)) return true;
    }
  }
  return false;
}

export function roleCanWrite(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'CONTRIBUTOR';
}

export function roleCanExport(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'CONTRIBUTOR';
}

export function requireRole(
  req: FastifyRequest,
  reply: FastifyReply,
  roles: UserRole[],
): req is FastifyRequest & { user: JwtPayload } {
  const user = req.user;
  if (!user || !roles.includes(user.role)) {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): req is FastifyRequest & { user: JwtPayload } {
  if (!req.user?.sub) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function requireWrite(
  req: FastifyRequest,
  reply: FastifyReply,
): req is FastifyRequest & { user: JwtPayload } {
  if (!req.user?.sub) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  if (!roleCanWrite(req.user.role)) {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): req is FastifyRequest & { user: JwtPayload } {
  if (!req.user?.sub) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  if (req.user.role !== 'ADMIN') {
    reply.status(403).send({ error: 'Admin required' });
    return false;
  }
  return true;
}
