import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticated, cookie, matchesPassword, sessionToken } from '../lib/server/admin';
import usage from '../api/admin-usage';
import auth from '../api/admin-auth';

function response() { return { code: 0, payload: null as any, headers: {} as Record<string,string>, setHeader(key: string, value: string) { this.headers[key] = value; }, status(code: number) { this.code = code; return this; }, json(value: any) { this.payload = value; return this; } }; }

test('signed sessions reject tampering, wrong passwords, and password rotation', () => {
  process.env.ADMIN_PASSWORD = 'test-password-only'; process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  assert.equal(matchesPassword('wrong'), false);
  assert.equal(matchesPassword('test-password-only'), true);
  const token = sessionToken();
  const request = { headers: { cookie: `promptraitz_admin=${token}` } };
  assert.equal(authenticated(request), true);
  assert.equal(authenticated({ headers: { cookie: `promptraitz_admin=${token.slice(0,-1)}X` } }), false);
  assert.equal(authenticated({ headers: { cookie: 'promptraitz_admin=1000000000000.' + '0'.repeat(64) } }), false);
  assert.equal(authenticated({ headers: {} }), false);
  assert.ok(cookie(token).includes('HttpOnly; SameSite=Strict'));
  process.env.ADMIN_PASSWORD = 'rotated-test-password';
  assert.equal(authenticated(request), false);
  delete process.env.ADMIN_PASSWORD; delete process.env.SUPABASE_SECRET_KEY;
});

test('admin reads require authentication; login enforces origin and persistent throttle', async () => {
  process.env.ADMIN_PASSWORD = 'test-password-only'; process.env.SUPABASE_SECRET_KEY = 'sb_secret_test'; process.env.SUPABASE_URL = 'https://example.supabase.co';
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('false'); };
  try {
    const res = response(); await usage({ method: 'GET', headers: {}, query: {} }, res);
    assert.equal(res.code, 401); assert.equal(calls, 0);
    const headers = { origin: 'https://promptraitz.com', 'content-type': 'application/json' };
    const badOrigin = response(); await auth({ method: 'POST', headers: { ...headers, origin: 'https://evil.example' }, body: { password: 'test-password-only' } }, badOrigin);
    assert.equal(badOrigin.code, 403); assert.equal(calls, 0);
    const limited = response(); await auth({ method: 'POST', headers, body: { password: 'test-password-only' } }, limited);
    assert.equal(limited.code, 429); assert.equal(limited.headers['Set-Cookie'], undefined);
    globalThis.fetch = async () => new Response('true');
    const login = response(); await auth({ method: 'POST', headers, body: { password: 'test-password-only' } }, login);
    assert.equal(login.code, 200); assert.ok(login.headers['Set-Cookie'].includes('HttpOnly'));
    const wrong = response(); await auth({ method: 'POST', headers, body: { password: 'incorrect' } }, wrong);
    assert.equal(wrong.code, 401); assert.equal(wrong.headers['Set-Cookie'], undefined);
    const out = response(); await auth({ method: 'POST', headers, body: { action: 'logout' } }, out);
    assert.ok(out.headers['Set-Cookie'].includes('Max-Age=0'));
  } finally { globalThis.fetch = originalFetch; delete process.env.ADMIN_PASSWORD; delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_URL; }
});
