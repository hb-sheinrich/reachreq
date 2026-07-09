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
  return getAdminEmails().includes(email.toLowerCase());
}
