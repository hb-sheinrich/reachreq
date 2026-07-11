import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../lib/env.js';

interface M365TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface M365UserInfo {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface M365TokenClaims {
  oid: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  nonce?: string;
  tid: string;
  aud: string | string[];
  iss: string;
  sub: string;
  iat: number;
  exp: number;
}

const jwksCache = new Map<string, { keys: unknown; expiresAt: number }>();

export function getAuthUrl(state: string, nonce: string): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.M365_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: env.M365_REDIRECT_URI,
    scope: 'openid profile email User.Read',
    response_mode: 'query',
    state,
    nonce,
  });
  return `https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}

export function generateOAuthSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function jwksUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
}

async function fetchJwks(tenantId: string): Promise<any> {
  const cached = jwksCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const res = await fetch(jwksUrl(tenantId), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch Microsoft JWKS: ${res.status}`);
  }
  const data = await res.json();
  jwksCache.set(tenantId, { keys: data, expiresAt: Date.now() + 5 * 60 * 1000 });
  return data;
}

function jwkToPem(jwk: { kty: string; n: string; e: string }): string {
  const key = createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

interface ValidateOptions {
  type: 'id' | 'access';
  nonce?: string;
}

export async function validateM365Token(rawToken: string, options: ValidateOptions): Promise<M365TokenClaims> {
  const env = getEnv();
  const tenantId = env.M365_TENANT_ID;
  if (!tenantId) {
    throw new Error('M365_TENANT_ID not configured');
  }
  if (!env.M365_CLIENT_ID) {
    throw new Error('M365_CLIENT_ID not configured');
  }

  const header = jwt.decode(rawToken, { complete: true })?.header as { kid?: string; alg?: string } | undefined;
  if (!header) throw new Error('Invalid token: cannot decode header');
  if (header.alg !== 'RS256') throw new Error('Invalid token algorithm');

  const jwks = await fetchJwks(tenantId);
  const key = (jwks.keys || []).find((k: any) => k.kid === header.kid);
  if (!key) throw new Error('Signing key not found in Microsoft JWKS');

  const pem = jwkToPem(key);

  const issuers = [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`,
  ];
  const audiences = options.type === 'id'
    ? [env.M365_CLIENT_ID]
    : ['https://graph.microsoft.com', '00000003-0000-0000-c000-000000000000'];

  const payload = jwt.verify(rawToken, pem, {
    algorithms: ['RS256'],
    audience: audiences,
    issuer: issuers,
    clockTolerance: 60,
  }) as M365TokenClaims;

  if (payload.tid !== tenantId) {
    throw new Error('Token tenant mismatch');
  }

  if (options.type === 'id' && options.nonce && payload.nonce !== options.nonce) {
    throw new Error('Token nonce mismatch');
  }

  return payload;
}

export async function exchangeCode(code: string): Promise<M365TokenResponse> {
  const env = getEnv();
  const body = new URLSearchParams({
    client_id: env.M365_CLIENT_ID ?? '',
    client_secret: env.M365_CLIENT_SECRET ?? '',
    code,
    redirect_uri: env.M365_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M365 token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<M365TokenResponse>;
}

export async function getUserInfo(accessToken: string): Promise<M365UserInfo> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Graph API /me failed: ${res.status}`);
  }

  return res.json() as Promise<M365UserInfo>;
}
