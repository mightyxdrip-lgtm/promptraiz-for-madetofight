import React, { useEffect, useState } from 'react';
import './admin.css';

type Group = { public_ip: string; submissions: number; last_seen: string };
type Entry = { id: string; created_at: string; feature: string; prompt: string; result: Record<string, unknown>; duration_ms: number };
const labels: Record<string, string> = { audit: 'Prompt audit', optimize: 'Optimize', enhance: 'Enhance', 'image-to-prompt': 'Image to prompt' };
const date = (value: string) => new Date(value).toLocaleString();

function Result({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (Array.isArray(value)) return <ul>{value.map((item, i) => <li key={i}><Result value={item} /></li>)}</ul>;
  if (typeof value === 'object') return <div className="result-fields">{Object.entries(value).filter(([key]) => !key.startsWith('_')).map(([key, item]) => <section key={key}><h4>{key.replace(/([A-Z])/g, ' $1')}</h4><Result value={item} /></section>)}</div>;
  return <p className="result-text">{String(value)}</p>;
}

export default function Admin() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [ip, setIp] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    fetch('/api/admin-auth').then(r => { if (!r.ok) throw Error('Cannot check sign-in status'); return r.json(); })
      .then(data => setSignedIn(data.authenticated === true)).catch(() => { setSignedIn(false); setError('Cannot reach the admin service. Please try again.'); });
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    setBusy(true); setError(''); setRows([]); setGroups([]); setHasMore(false);
    const query = new URLSearchParams({ page: String(page) });
    if (ip !== null) query.set('ip', ip);
    fetch(`/api/admin-usage?${query}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (response.status === 401) { setSignedIn(false); throw Error('Your session expired. Please sign in again.'); }
      if (!response.ok) throw Error(data.error || 'Could not load history');
      if (!controller.signal.aborted) { setGroups(data.groups || []); setRows(data.rows || []); setHasMore(data.hasMore); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [signedIn, ip, page, revision]);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Sign-in failed');
      setPassword(''); setSignedIn(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      if (!response.ok) throw Error('Could not sign out. Please try again.');
      setSignedIn(false); setRows([]); setGroups([]); setIp(null); setPage(0);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <main className="admin-shell">
    <header className="admin-header"><a href="/" className="admin-brand">PROMPTRAITZ<span> / ADMIN</span></a>{signedIn && <button onClick={logout} disabled={busy}>Sign out</button>}</header>
    {signedIn === null ? <p role="status">Checking session…</p> : !signedIn ? <form className="admin-login" onSubmit={login}>
      <span className="admin-eyebrow">OWNER ACCESS</span><h1>Your prompt history,<br />in one place.</h1>
      <p>Sign in to review submitted prompts and the results visitors received.</p>
      <label htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Open dashboard →'}</button>
    </form> : <>
      <div className="admin-heading"><div><span className="admin-eyebrow">USAGE EXPLORER</span><h1>{ip || 'Visitor networks'}</h1><p>{ip ? 'Every saved input and result from this public IP.' : 'Open a network to explore its prompt history. Shared Wi-Fi, VPNs, or changing IPs can combine or split devices.'}</p></div><button disabled={busy} onClick={() => setRevision(n => n + 1)}>↻ Refresh</button></div>
      {ip && <button className="admin-back" onClick={() => { setIp(null); setPage(0); }}>← All networks</button>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {busy ? <p role="status">Loading history…</p> : !error && (ip ? <div className="admin-entries">{rows.map(row => <article className="admin-entry" key={row.id}>
        <div className="entry-meta"><span className="admin-tag">{labels[row.feature] || row.feature}</span><time dateTime={row.created_at}>{date(row.created_at)}</time><span>{(row.duration_ms / 1000).toFixed(1)}s</span></div>
        <div className="entry-columns"><section><h3>INPUT</h3><p className="result-text">{row.prompt}</p></section><section><h3>RESULT</h3><Result value={row.result} /></section></div>
      </article>)}{!rows.length && <div className="admin-empty">No submissions saved for this network yet.</div>}</div> : <div className="admin-grid">{groups.map(group => <button className="network-card" key={group.public_ip} onClick={() => { setIp(group.public_ip); setPage(0); }}>
        <span className="network-icon">↗</span><h2>{group.public_ip === 'unknown' ? 'Unknown IP' : group.public_ip}</h2><strong>{group.submissions} <span>submissions</span></strong><p>Last active {date(group.last_seen)}</p><span className="network-link">View prompt history →</span>
      </button>)}{!groups.length && <div className="admin-empty">No history yet. New submissions will appear here once logging is connected.</div>}</div>)}
      <nav className="admin-pagination" aria-label="History pages"><button disabled={busy || page === 0} onClick={() => setPage(n => n - 1)}>← Previous</button><span>Page {page + 1}</span><button disabled={busy || !hasMore} onClick={() => setPage(n => n + 1)}>Next →</button></nav>
    </>}
  </main>;
}
