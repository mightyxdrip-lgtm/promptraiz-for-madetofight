import { isIP } from 'node:net';
import { authenticated, database } from '../lib/server/admin.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!authenticated(req)) return res.status(401).json({ error: 'Please sign in' });
  const page = Number(req.query?.page || 0);
  if (!Number.isInteger(page) || page < 0 || page > 100000) return res.status(400).json({ error: 'Invalid page' });
  try {
    const ip = req.query?.ip;
    if (ip !== undefined) {
      if (typeof ip !== 'string' || (!isIP(ip) && ip !== 'unknown')) return res.status(400).json({ error: 'Invalid IP address' });
      const rows = await database(`prompt_usage?select=id,created_at,feature,prompt,result,duration_ms,public_ip&public_ip=eq.${encodeURIComponent(ip)}&order=created_at.desc,id.desc&limit=21&offset=${page * 20}`);
      return res.status(200).json({ rows: rows.slice(0, 20), hasMore: rows.length > 20 });
    }
    const [groups, stats] = await Promise.all([database('rpc/admin_ip_groups', { page_offset: page * 30 }), database('rpc/admin_usage_stats', {})]);
    return res.status(200).json({ groups: groups.slice(0, 30), hasMore: groups.length > 30, stats: stats[0] });
  } catch { return res.status(503).json({ error: 'Could not load history. Check the database setup.' }); }
}
