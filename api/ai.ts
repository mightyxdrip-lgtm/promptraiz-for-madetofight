const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b";
const MAX_INPUT_CHARS = 120_000;

type Message = {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

function containsImage(messages: Message[]) {
  return messages.some(message => Array.isArray(message.content) && message.content.some(item => item.type === "image_url"));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI service is not configured" });

  const messages = req.body?.messages as Message[] | undefined;
  const serializedLength = JSON.stringify(messages || []).length;
  if (!Array.isArray(messages) || messages.length === 0 || serializedLength > MAX_INPUT_CHARS) {
    return res.status(400).json({ error: "Invalid or oversized request" });
  }

  const maxTokens = Math.min(Math.max(Number(req.body?.maxTokens) || 1400, 256), 3000);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: containsImage(messages) ? VISION_MODEL : TEXT_MODEL,
        messages,
        max_completion_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("Groq request failed", response.status, detail);
      return res.status(502).json({ error: "AI provider request failed" });
    }

    const data = await response.json();
    return res.status(200).json({ choices: data.choices || [] });
  } catch (error) {
    console.error("AI proxy failed", error);
    return res.status(502).json({ error: "AI service unavailable" });
  }
}
