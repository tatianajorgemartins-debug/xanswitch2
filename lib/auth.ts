import { cookies } from 'next/headers';

const COOKIE_NAME = 'xan_admin_session';
const SESSION_VALUE = 'ok';

function getSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error(
      'ADMIN_PASSWORD não está configurada. Adicione essa variável de ambiente no painel da Vercel.'
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(value: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toHex(signature);
}

// Works in both the Node runtime (server components/actions) and the Edge
// runtime (middleware) — Web Crypto is available in both, unlike Node's
// built-in `crypto` module which Edge does not support.
export async function checkPassword(inputPassword: string): Promise<boolean> {
  const expected = getSecret();
  if (inputPassword.length !== expected.length) return false;
  const key = await getKey();
  const encoder = new TextEncoder();
  // constant-time comparison via HMAC of both values
  const a = await crypto.subtle.sign('HMAC', key, encoder.encode(inputPassword));
  const b = await crypto.subtle.sign('HMAC', key, encoder.encode(expected));
  const aBytes = new Uint8Array(a);
  const bBytes = new Uint8Array(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export async function createSession(): Promise<void> {
  const signature = await sign(SESSION_VALUE);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${SESSION_VALUE}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 dias
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return false;
    const [value, signature] = raw.split('.');
    if (value !== SESSION_VALUE) return false;
    return (await sign(SESSION_VALUE)) === signature;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };

