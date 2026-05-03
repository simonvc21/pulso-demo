import { NextResponse, type NextRequest } from "next/server";
import { gemini } from "@/lib/gemini";
import { buildChatContext, serializeContextForPrompt } from "@/lib/chat-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Soft cap: ~150 chat calls per org per day. Roughly $1-2 of Gemini usage.
const DAILY_CAP = 150;

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
}

const SYSTEM_BASE = `You are Pulso, an in-app analyst assistant for a LATAM venture capital fund.

You answer questions about the user's portfolio. You have read-only access to a JSON snapshot of the fund (companies, quarterly metrics, LP roster, forms, recent news submissions, recent alerts) provided below.

RULES
- Only use facts from the JSON. If the JSON doesn't contain the answer, say so plainly. Never invent numbers, names, dates, or relationships.
- Length follows the request type:
  * Quick lookup ("worst runway?", "Vextra ARR?") → 2-4 sentences.
  * Analysis ("how is the portfolio doing?", "top movers") → 1-3 paragraphs.
  * Newsletter / quarterly letter / "summarize Q1" / "write the LP letter" → DELIVER A COMPLETE LETTER. Minimum 600 words. Use markdown structure: H2 headings (## Highlights, ## Portfolio updates, ## Watch list, ## Outlook), bullet lists with company-level detail, narrative paragraphs. Cover EVERY company in the JSON with at least one sentence each. Quote real metrics with company + quarter. Do not stop early.
- When citing a metric, name the company and quarter. Format USD as "$3.2M", percentages as "12.5%".
- When the user asks "what should I do" or similar, give a concrete next step (a meeting, a question to ask, a metric to watch).
- The user's role determines what they can see:
  * "gp" / "managing_partner" / "partner" / "analyst": full access to portfolio + LPs + alerts.
  * "lp": access only to companies and aggregate metrics; do not surface critical-flagged company NAMES; never list LPs (they're peers).
  * "viewer": same as gp for now (will be tightened later).
- Current date: ${new Date().toISOString().slice(0, 10)}.
`;

function lastUserMessage(messages: ChatRequest["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function buildConversationPrompt(ctx: string, messages: ChatRequest["messages"]): string {
  // Gemini 2.5 doesn't have a native multi-turn API in this SDK pattern;
  // we flatten into a single prompt with explicit turn markers.
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  return `## PORTFOLIO CONTEXT (JSON)
${ctx}

## CONVERSATION
${transcript}

ASSISTANT:`;
}

export async function POST(request: NextRequest) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ ok: false, error: "messages[] required" }, { status: 400 });
  }
  if (body.messages.length > 30) {
    return NextResponse.json({ ok: false, error: "Conversation too long" }, { status: 400 });
  }
  const last = lastUserMessage(body.messages);
  if (!last || last.length > 2000) {
    return NextResponse.json({ ok: false, error: "Empty or oversized user message" }, { status: 400 });
  }

  const ctx = await buildChatContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  // Daily cost cap per organization.
  if (ctx.organization?.id) {
    const supabase = createClient();
    const { data: count } = await supabase.rpc("bump_ai_usage", {
      p_org: ctx.organization.id,
      p_feature: "chat",
    });
    if (typeof count === "number" && count > DAILY_CAP) {
      return NextResponse.json(
        { ok: false, error: "Daily AI quota reached for this fund. Resets at 00:00 UTC." },
        { status: 429 }
      );
    }
  }

  const ctxStr = serializeContextForPrompt(ctx);
  const prompt = buildConversationPrompt(ctxStr, body.messages);

  // GPs ask for full newsletters / multi-section answers; LPs ask shorter
  // questions. Cap accordingly so we don't burn tokens on the LP side.
  // Gemini 2.5-flash supports up to 8192 output tokens — we leave headroom.
  const maxOutputTokens = ctx.scope === "lp" ? 3000 : 6000;

  try {
    const reply = await gemini.generate(prompt, {
      model: "flash",
      systemInstruction: SYSTEM_BASE,
      temperature: 0.3,
      maxOutputTokens,
    });
    return NextResponse.json({ ok: true, reply: reply.trim() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Gemini failed" },
      { status: 500 }
    );
  }
}
