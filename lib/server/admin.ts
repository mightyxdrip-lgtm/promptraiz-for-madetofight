import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

export async function database(path: string, body?: unknown) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Database unavailable');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Database unavailable');
  return response.json();
}

export function matchesPassword(value: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof value !== 'string' || value.length > 1024) return false;
  return timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(expected).digest());
}

function signature(value: string) {
  const password = process.env.ADMIN_PASSWORD;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password || !key) throw new Error('Admin not configured');
  return createHmac('sha256', key).update(`${password}:${value}`).digest('hex');
}

export function sessionToken() {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  return `${expires}.${signature(expires)}`;
}

export function authenticated(req: any) {
  try {
    const token = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('promptraitz_admin='))?.slice('promptraitz_admin='.length);
    if (!token) return false;
    const [expires, mac, extra] = token.split('.');
    if (extra || !/^\d{13}$/.test(expires) || !/^[a-f0-9]{64}$/.test(mac || '') || Number(expires) <= Date.now() || Number(expires) > Date.now() + 8 * 3600000) return false;
    return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(expires), 'hex'));
  } catch { return false; }
}

export function cookie(token: string, maxAge = 28800) {
  return `promptraitz_admin=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function validOrigin(req: any) {
  const allowed = new Set(['https://promptraitz.com', 'https://www.promptraitz.com', 'https://promptraiz-for-madetofight.vercel.app']);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== 'production') allowed.add('http://localhost:3000');
  return allowed.has(req.headers.origin);
}

export function loginRateKey(req: any) {
  const candidate = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return signature(`login:${isIP(candidate) ? candidate : 'unknown'}`);
}
