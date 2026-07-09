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

export function getAuthUrl(): string {
  const env = getEnv();
  const params = new URLSearchParams({
    client_id: env.M365_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: env.M365_REDIRECT_URI,
    scope: 'openid profile email User.Read',
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
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
