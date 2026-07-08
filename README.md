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
- OpenRouter API (free vision + text models)
- Vite

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Get a free API key from [OpenRouter](https://openrouter.ai/keys)

3. Create `.env.local`:
   ```
   OPENROUTER_API_KEY=sk-or-your-key-here
   ```

4. Run:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

## Models Used

| Feature | Model |
|---------|-------|
| Text (Audit/Enhance) | `google/gemini-2.0-flash-001:free` |
| Vision (Image-to-Prompt) | `nvidia/nemotron-nano-12b-v2-vl:free` |
| Fallback | Canvas fingerprint + text model |

## License

MIT
