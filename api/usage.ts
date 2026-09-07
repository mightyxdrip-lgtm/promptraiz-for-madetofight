import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const features = new Set(['audit', 'optimize', 'enhance', 'image-to-prompt']);

export function validEvent(body: any): boolean {
  return !!body && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
    && features.has(body.feature) && typeof body.prompt === 'string'
    && body.prompt.length <= 120_000 && body.result !== null
    && typeof body.result === 'object' && !Array.isArray(body.result)
    && Number.isInteger(body.durationMs) && body.durationMs >= 0 && body.durationMs <= 3_600_000
    && Buffer.byteLength(JSON.stringify(body)) <= 200_000;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const origin = req.headers.origin;
  const allowed = new Set(['https://promptraitz.com', 'https://www.promptraitz.com', 'https://promptraiz-for-madetofight.vercel.app']);
  if (process.env.VERCEL_URL) allowed.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== 'production') allowed.add('http://localhost:3000');
  if (!allowed.has(origin)) return res.status(403).json({ error: 'Invalid origin' });
  if (!req.headers['content-type']?.startsWith('application/json') || !validEvent(req.body)) {
    return res.status(400).json({ error: 'Invalid event' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Usage storage is not configured' });
  try {
    const candidate = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const ip = isIP(candidate) ? candidate : 'unknown';
    const rateKey = createHmac('sha256', key).update(`${new Date().toISOString().slice(0, 10)}:${ip}`).digest('hex');
    const { id, feature, prompt, result, durationMs } = req.body;
    const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/record_prompt_usage`, {
      method: 'POST', headers, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ event_id: id, event_feature: feature, event_prompt: prompt,
        event_result: result, event_duration_ms: durationMs, event_rate_key: rateKey, event_ip: ip }),
    });
    if (!response.ok) throw new Error('Storage request failed');
    const outcome = await response.json();
    if (outcome === 'limited') return res.status(429).json({ error: 'Usage limit reached' });
    return res.status(outcome === 'saved' ? 201 : 202).json({ received: true });
  } catch {
    console.error('Usage storage write failed');
    return res.status(503).json({ error: 'Usage storage unavailable' });
  }
}
