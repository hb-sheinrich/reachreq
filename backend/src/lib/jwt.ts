import jwt from 'jsonwebtoken';
import { getEnv, getAdminEmails } from './env.js';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getEnv().JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getEnv().JWT_SECRET) as JwtPayload;
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
