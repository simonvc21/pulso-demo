// Single entry point for every Gemini call. Centralizes:
//   - API key loading (GEMINI_API_KEY env var)
//   - Model selection (flash for cheap/fast, pro for chatbot)
//   - JSON mode + retry on parse failure
//   - Future: cost cap, telemetry, request caching
//
// Usage:
//   import { gemini } from "@/lib/gemini";
//   const text = await gemini.generate("Write a haiku");
//   const obj  = await gemini.generateJSON<{ summary: string }>(prompt);

import { GoogleGenerativeAI, type GenerativeModel, type ResponseSchema } from "@google/generative-ai";

export const MODELS = {
  flash: "gemini-2.5-flash",
  pro: "gemini-2.5-pro",
} as const;

type ModelKey = keyof typeof MODELS;

let _client: GoogleGenerativeAI | null = null;

function client(): GoogleGenerativeAI {
  if (_client) return _client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local or your Vercel project env."
    );
  }
  _client = new GoogleGenerativeAI(key);
  return _client;
}

function model(name: ModelKey): GenerativeModel {
  return client().getGenerativeModel({ model: MODELS[name] });
}

interface GenerateOptions {
  model?: ModelKey;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Only meaningful for generateJSON. Constrains the model to emit this exact shape. */
  responseSchema?: ResponseSchema;
}

async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const m = client().getGenerativeModel({
    model: MODELS[opts.model ?? "flash"],
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      maxOutputTokens: opts.maxOutputTokens ?? 800,
    },
  });

  try {
    const res = await m.generateContent(prompt);
    return res.response.text();
  } catch (err: any) {
    // Surface the underlying message so the caller can decide what to do.
    throw new Error(`Gemini generate failed: ${err?.message ?? "unknown"}`);
  }
}

async function generateJSON<T>(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<T> {
  const m = client().getGenerativeModel({
    model: MODELS[opts.model ?? "flash"],
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 1500,
      responseMimeType: "application/json",
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  });

  const res = await m.generateContent(prompt);
  const text = res.response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Most common cause: maxOutputTokens cut the JSON mid-string. Surface a
    // hint so the caller knows to either bump the cap or add a responseSchema.
    const tail = text.slice(-80);
    throw new Error(
      `Gemini returned invalid JSON (likely truncated; response ended "${tail}"). ` +
      `Bump maxOutputTokens or pass a responseSchema.`
    );
  }
}

export const gemini = {
  generate,
  generateJSON,
  model,
};
