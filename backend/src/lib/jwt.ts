import jwt from 'jsonwebtoken';
import { getEnv } from './env.js';

export type UserRole = 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  isAdmin: boolean;
}

const ISSUER = 'reachreq';
const AUDIENCE = 'reachreq-api';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getEnv().JWT_SECRET, {
    expiresIn: '24h',
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getEnv().JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}
