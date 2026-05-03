// L.6c — Newsletter prose polish endpoint. Takes a paragraph + the
// surrounding newsletter context and rewrites it in journalistic LP-letter
// voice. Used by the editor's "Polish with AI" button on text blocks.

import { NextResponse, type NextRequest } from "next/server";
import { gemini } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  blockHeading: string | null;
  blockBody: string;
  fundName: string;
  periodLabel: string;
  /** Optional: the cover title so the model knows the framing. */
  coverTitle?: string;
}

const SYSTEM = `You are a writing editor helping a venture capital General Partner polish a paragraph for a Limited Partner newsletter.

Rules:
- Preserve every NUMBER, COMPANY NAME, and FACT exactly as given. Do not invent metrics, dates, names, or events.
- Rewrite for clarity and a polished journalistic tone.
- Match the voice of premium VC LP letters: confident, factual, direct, free of hype.
- Output prose only. No markdown, no headings, no lists, no quote marks around the result.
- Length: roughly the same as the input (within ±25%).`;

export async function POST(req: NextRequest) {
  // Auth gate — only signed-in GP-side users can call this.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: profile } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) {
    return NextResponse.json({ error: "No fund assigned" }, { status: 403 });
  }
  if (!["gp", "managing_partner", "partner", "analyst"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "GP-side roles only" }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  if (!body.blockBody || body.blockBody.trim().length === 0) {
    return NextResponse.json({ error: "Empty paragraph" }, { status: 400 });
  }
  if (body.blockBody.length > 8000) {
    return NextResponse.json({ error: "Paragraph too long" }, { status: 400 });
  }

  const userPrompt =
    `Newsletter context:\n` +
    `- Fund: ${body.fundName}\n` +
    `- Period: ${body.periodLabel}\n` +
    (body.coverTitle ? `- Letter title: ${body.coverTitle}\n` : "") +
    (body.blockHeading ? `- Section heading: ${body.blockHeading}\n` : "") +
    `\nParagraph to polish:\n${body.blockBody}\n\n` +
    `Return the polished paragraph only — no preamble, no quotes, no markdown.`;

  try {
    const text = await gemini.generate(userPrompt, { systemInstruction: SYSTEM, temperature: 0.4 });
    const cleaned = text.trim()
      .replace(/^["']/, "")
      .replace(/["']$/, "")
      .replace(/^```[\s\S]*?\n/, "")
      .replace(/\n```$/, "")
      .trim();
    return NextResponse.json({ polished: cleaned });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Generation failed" }, { status: 500 });
  }
}
