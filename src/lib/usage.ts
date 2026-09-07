// Save the final result, including local fallbacks, without delaying the UI.
export function recordUsage(feature: string, prompt: string, result: unknown, startedAt: number) {
  try {
    const body = JSON.stringify({ id: crypto.randomUUID(), feature, prompt, result, durationMs: Math.round(performance.now() - startedAt) });
    void fetch('/api/usage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      // Fetch keepalive has a 64 KiB limit; larger submissions use normal fetch.
      keepalive: new TextEncoder().encode(body).length < 60_000,
    }).catch(() => {});
  } catch { /* Analytics must never prevent a user from receiving their result. */ }
}
