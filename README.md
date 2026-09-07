# Promptraitz

Premium AI prompt judge, optimizer, and enhancer. Built for MadeToFight.

**Author: darkwaveop**

---

## Features

- **Audit & Optimize** — Score prompts 0-100, get detailed feedback, and auto-optimize
- **Enhance** — Transform rough prompts into production-grade instructions
- **Image-to-Prompt** — Reverse-engineer images into AI generation prompts (vision AI + canvas fingerprint)
- **Prompt Recipes** — Persona, Chain of Thought, Few-Shot, Step-by-Step templates
- **Security Scanner** — Detects injection attacks, jailbreaks, and malicious prompts
- **Drag & Drop** — Drop files anywhere (images → Image-to-Prompt, text → attach as context)
- **Custom Cursor** — Animated cursor trail with motion blur

## Tech Stack

- React 19 + TypeScript
- Tailwind CSS 4
- Framer Motion (motion/react)
- Groq API (text + vision models, proxied through a Vercel Function)
- Vite

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Get an API key from [Groq](https://console.groq.com/keys)

3. Create `.env.local`:
   ```
   GROQ_API_KEY=gsk_your-key-here
   ```

4. Run:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

## Models Used

| Feature | Model |
|---------|-------|
| Text (Audit/Enhance) | `openai/gpt-oss-120b` |
| Vision (Image-to-Prompt) | `qwen/qwen3.6-27b` |
| Fallback | Canvas fingerprint + text model |

The browser calls `/api/ai`; the Groq key is read only by the serverless function and is never bundled into client JavaScript.

## License

MIT

## Private usage history (Supabase Free)

1. Create a Supabase project on the **Free** plan.
2. Run `supabase/migrations/202609070001_prompt_usage.sql` in its SQL Editor.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in Vercel's server environment variables. A legacy `SUPABASE_SERVICE_ROLE_KEY` also works. Never use a `VITE_` prefix for secrets.
4. Deploy, submit a test prompt, and open Supabase **Table Editor > prompt_usage**.

Each row contains the feature, submitted prompt (including attached text for audits), final result JSON, timestamp, and duration. Image-to-prompt saves generated text, not uploaded image bytes. The result is client-reported, including heuristic fallbacks, and is not authoritative billing or security evidence. Delivery is best effort; closed tabs, blockers, network failures, and limits can prevent a row being saved. Historical prompts cannot be recovered by this change.

RLS is enabled with no public policies; anonymous and signed-in site visitors have no table access. Only the server's secret can call the write function. Browse records through your authenticated Supabase dashboard. The write endpoint validates input and limits each daily hashed IP to 30 entries/minute. It stores the server-observed public IP for owner-only grouping; it stores no account identity or browser fingerprint. A 300 MiB table cap stops new logging to leave room within the Free plan's current 500 MB database allowance; it never upgrades your plan or deletes old rows. Monitor storage in Supabase, then export/delete records yourself when needed.

To inspect recent usage in SQL Editor:

```sql
SELECT created_at, feature, prompt, result, duration_ms
FROM public.prompt_usage ORDER BY created_at DESC LIMIT 100;
```

Validation: `npm run lint`, `npm run build`, `npx tsx --test tests/usage.test.ts`.


## Owner admin panel

Visit `/admin`. Configure `ADMIN_PASSWORD` as a **server-only Vercel environment variable** using your chosen password. Do not put it in source code or prefix it with `VITE_`. Run both SQL migrations in filename order. The second migration adds public IP grouping, restricted read RPCs, and persistent login throttling (5 attempts per 15 minutes per IP).

Sessions expire after 8 hours and use signed HttpOnly, SameSite=Strict cookies (Secure in production). Changing the password invalidates existing sessions. The admin API checks the session before reading any data. Login fails closed if the throttle database is unavailable. Sign-out clears this browser's cookie.

IP addresses come from Vercel's forwarded-IP header, never from submitted event fields. A public IP identifies a network, not a person or a PC: shared Wi-Fi and VPNs can group devices together, and dynamic addresses can split one device across groups. Existing rows have an unknown IP; new logging cannot recover historical IPs or prompts. The panel paginates networks and submissions and shows the full returned result as structured text.
