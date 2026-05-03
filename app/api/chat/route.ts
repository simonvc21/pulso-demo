import { NextResponse, type NextRequest } from "next/server";
import { gemini } from "@/lib/gemini";
import { buildChatContext, serializeContextForPrompt } from "@/lib/chat-context";
import { createClient } from "@/lib/supabase/server";
import {
  createConversation,
  appendMessage,
  setConversationTitle,
  getConversationMessages,
  getCurrentUserRowId,
} from "@/lib/chat-history";
import { logAiCall } from "@/lib/ai-usage";
import { logUsageEvent } from "@/lib/value-analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Soft cap: ~150 chat calls per org per day. Roughly $1-2 of Gemini usage.
const DAILY_CAP = 150;

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  /** L.13 — optional conversation id. If absent, a new conversation is created
   *  and its id is returned in the response. */
  conversationId?: string | null;
}

const SYSTEM_BASE = `You are Pulso, an in-app analyst assistant for a LATAM venture capital fund.

You answer questions about the user's portfolio. You have read-only access to a JSON snapshot of the fund (companies, quarterly metrics, LP roster, forms, recent news submissions, recent alerts) provided below.

RULES
- Only use facts from the JSON. If the JSON doesn't contain the answer, say so plainly. Never invent numbers, names, dates, or relationships.
- The JSON includes the fund's investment thesis under organization.thesis. Use it to ground your tone, your interpretation of "fit", and your portfolio suggestions. Never quote it verbatim — synthesize.
- Length follows the request type:
  * Quick lookup ("worst runway?", "Vextra ARR?") → 2-4 sentences.
  * Analysis ("how is the portfolio doing?", "top movers") → 1-3 paragraphs.
  * Newsletter / quarterly letter / "summarize Q1" / "write the LP letter" →
    Deliver a complete letter with this structure:
      ## Headline summary (2-3 sentences with the MoM ARR change and the headline number)
      ## Portfolio updates (one short paragraph PER COMPANY — 2-3 sentences max each — covering ARR, runway, and one news item if available)
      ## Watch list (companies with critical/watch status — one bullet each)
      ## Outlook (1 paragraph)
    HARD REQUIREMENT: cover EVERY company present in the JSON. Count them yourself before writing — if there are 8 companies, you must produce 8 paragraphs in Portfolio updates. Be tight per company so they all fit. If you start to run long, shorten earlier paragraphs rather than skip companies at the end.
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
  // questions. We push GP to the model max (8192) for newsletters, LP at 4000.
  const maxOutputTokens = ctx.scope === "lp" ? 4000 : 8000;

  let reply: string;
  let usage = { modelId: "gemini-2.5-flash", inputTokens: 0, outputTokens: 0 };
  try {
    const r = await gemini.generateWithUsage(prompt, {
      model: "flash",
      systemInstruction: SYSTEM_BASE,
      temperature: 0.3,
      maxOutputTokens,
    });
    reply = r.text.trim();
    usage = { modelId: r.modelId, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Gemini failed" },
      { status: 500 }
    );
  }

  // L.13 — persist this turn. Failures here don't block the user; the reply
  // is still returned. Logged so we can spot issues without breaking chat UX.
  let conversationId = body.conversationId ?? null;
  let titledNow = false;
  try {
    if (!conversationId) {
      conversationId = await createConversation(ctx.scope === "lp" ? "lp" : "gp");
    }
    if (conversationId) {
      await appendMessage(conversationId, "user", last);
      await appendMessage(conversationId, "assistant", reply, usage.outputTokens);

      // Auto-title after the first complete turn (when total messages == 2).
      // Cheap follow-up call to flash with a tight prompt.
      const all = await getConversationMessages(conversationId);
      if (all.length === 2) {
        try {
          const titleR = await gemini.generateWithUsage(
            `Suggest a concise 3-6 word title for this chat. No quotes, no period.\n\n` +
            `User: ${last.slice(0, 400)}\n\nAssistant: ${reply.slice(0, 400)}`,
            { model: "flash", temperature: 0.3, maxOutputTokens: 30 },
          );
          const title = titleR.text.trim().replace(/^["'`]+|["'`]+$/g, "").slice(0, 60);
          if (title) {
            await setConversationTitle(conversationId, title);
            titledNow = true;
          }
          // Log the title call as a separate ai_usage_event so cost is accurate.
          if (ctx.organization?.id) {
            const userCtx = await getCurrentUserRowId();
            await logAiCall({
              organizationId: ctx.organization.id,
              userId: userCtx?.userId ?? null,
              feature: "auto_title",
              modelId: titleR.modelId,
              inputTokens: titleR.inputTokens,
              outputTokens: titleR.outputTokens,
              conversationId,
            });
          }
        } catch {
          // Title is non-critical, skip silently.
        }
      }
    }
  } catch (err) {
    console.error("[L.13] Persist chat failed:", err);
  }

  // L.15 — log the actual chat call's tokens + cost.
  // L.20 — log a value event so the "hours saved" widget counts it.
  if (ctx.organization?.id) {
    try {
      const userCtx = await getCurrentUserRowId();
      await logAiCall({
        organizationId: ctx.organization.id,
        userId: userCtx?.userId ?? null,
        feature: "chat",
        modelId: usage.modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        conversationId,
      });
      await logUsageEvent({
        organizationId: ctx.organization.id,
        userId: userCtx?.userId ?? null,
        kind: "chat_query",
        metadata: { conversation_id: conversationId, scope: ctx.scope },
      });
    } catch (err) {
      console.error("[L.15/L.20] usage log failed:", err);
    }
  }

  return NextResponse.json({ ok: true, reply, conversationId, titledNow });
}
