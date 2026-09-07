import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { validEvent } from '../api/usage';

const event = { id: 'b75a1dc2-9530-44aa-9806-e8f3ca146293', feature: 'enhance',
  prompt: "Write a poem about rain '); DROP TABLE prompt_usage; --", result: { enhancedPrompt: 'A better prompt' }, durationMs: 200 };

test('reject malformed, oversized, and invalid feature events', () => {
  assert.equal(validEvent(event), true);
  for (const patch of [{ id: 'bad' }, { feature: 'unknown' }, { result: null }, { result: [] },
    { prompt: 'x'.repeat(120001) }, { durationMs: -1 }, { result: { text: 'x'.repeat(200001) } }]) {
    assert.equal(validEvent({ ...event, ...patch }), false);
  }
});

test('endpoint prevents reads and cross-origin writes, keeps credentials server-side, and tolerates storage failure', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  let calls = 0;
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    calls++;
    assert.equal(url, 'https://example.supabase.co/rest/v1/rpc/record_prompt_usage');
    assert.equal((options.headers as any).apikey, 'sb_secret_test_only');
    assert.equal((options.headers as any).Authorization, undefined);
    const body = JSON.parse(options.body as string);
    assert.equal(body.event_prompt, event.prompt);
    assert.equal(body.event_rate_key.length, 64);
    assert.equal(body.event_ip, '192.0.2.1');
    return new Response(JSON.stringify('saved'), { status: 200 });
  }) as any;
  async function request(method: string, origin = 'https://promptraitz.com') {
    const res: any = { code: 0, payload: null, setHeader() {}, status(code: number) { this.code = code; return this; }, json(payload: unknown) { this.payload = payload; return this; } };
    await handler({ method, headers: { origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.1' }, body: event }, res);
    return res;
  }
  try {
    assert.equal((await request('GET')).code, 405);
    assert.equal((await request('POST', 'https://evil.example')).code, 403);
    assert.equal(calls, 0);
    assert.equal((await request('POST')).code, 201);
    assert.equal(calls, 1);
    globalThis.fetch = async () => { throw new Error('network unavailable'); };
    assert.equal((await request('POST')).code, 503);
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await request('POST')).code, 503);
  } finally { globalThis.fetch = originalFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; }
});
