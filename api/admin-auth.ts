import { authenticated, cookie, database, loginRateKey, matchesPassword, sessionToken, validOrigin } from '../lib/server/admin.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ authenticated: authenticated(req) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!validOrigin(req) || !req.headers['content-type']?.startsWith('application/json')) return res.status(403).json({ error: 'Invalid origin' });
  if (req.body?.action === 'logout') { res.setHeader('Set-Cookie', cookie('', 0)); return res.status(200).json({ authenticated: false }); }
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin setup is incomplete' });
  try {
    const allowed = await database('rpc/admin_login_allowed', { attempt_key: loginRateKey(req) });
    if (!allowed) { res.setHeader('Retry-After', '900'); return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' }); }
    if (!matchesPassword(req.body?.password)) return res.status(401).json({ error: 'Incorrect password' });
    res.setHeader('Set-Cookie', cookie(sessionToken()));
    return res.status(200).json({ authenticated: true });
  } catch { return res.status(503).json({ error: 'Admin setup or database is unavailable' }); }
}
