// L.8g — Anthropic (Claude) client wrapper. Mirrors lib/gemini.ts so the
// rest of the app can swap providers without touching call sites.
//
// We use Claude for structured JSON tasks where Gemini's JSON mode has
// failed (e.g. multi-sheet spreadsheet analysis). Gemini stays the default
// for chat + newsletter polish — Claude is 3-5× more expensive per token,
// so we only pay for it where reliability matters.

import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODELS = {
  // Claude 4 Sonnet — fast + good at structured outputs
  sonnet: "claude-sonnet-4-5",
  // Cheaper, still fine for simple extractions
  haiku: "claude-haiku-4-5",
};

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  client = new Anthropic({ apiKey: key });
  return client;
}

export function isClaudeEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

interface GenerateOptions {
  model?: keyof typeof CLAUDE_MODELS;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Free-form text completion. Returns the model's reply. */
export async function claudeGenerate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await c.messages.create({
    model: CLAUDE_MODELS[opts.model ?? "sonnet"],
    max_tokens: opts.maxOutputTokens ?? 2000,
    temperature: opts.temperature ?? 0.3,
    system: opts.systemInstruction,
    messages: [{ role: "user", content: prompt }],
  });

  // Concatenate all text blocks (Claude 4 may return multiple).
  const text = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  return text;
}

/** JSON-only completion. Claude follows "respond ONLY with JSON" instructions
 *  reliably; we still strip code fences defensively. Throws on parse failure. */
export async function claudeGenerateJSON<T>(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<T> {
  // Append an explicit JSON-only instruction to the prompt — Claude doesn't
  // have a "JSON mode" flag the way Gemini does, but it follows direct
  // instructions consistently when temp is low.
  const jsonPrompt = prompt + "\n\nRespond ONLY with a valid JSON object. No prose, no markdown fences, no commentary.";
  const text = await claudeGenerate(jsonPrompt, {
    ...opts,
    temperature: opts.temperature ?? 0.1,
    maxOutputTokens: opts.maxOutputTokens ?? 4000,
  });

  // Strip leading/trailing whitespace + markdown fences if present.
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    const tail = cleaned.slice(-200);
    throw new Error(`Claude returned invalid JSON. Tail: "${tail}". Error: ${err?.message}`);
  }
}

export const claude = {
  generate: claudeGenerate,
  generateJSON: claudeGenerateJSON,
  isEnabled: isClaudeEnabled,
};
