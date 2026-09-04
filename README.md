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
