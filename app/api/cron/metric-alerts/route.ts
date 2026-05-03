import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // give Gemini headroom

// Vercel Cron hits this endpoint daily. We accept either:
//   1. Vercel's cron header (`x-vercel-cron`) — auto-set when triggered by the platform
//   2. A bearer secret header for manual invocation (CRON_SECRET env var)
function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

const ALERT_KINDS = [
  "metric_alert_runway",
  "metric_alert_arr_drop",
  "metric_alert_burn_spike",
] as const;

const SYSTEM_INSTRUCTION = `You are a senior LATAM venture capital analyst writing portfolio alerts for the GP.
Write 1-2 sentences max, plain English, calm and actionable.
Never invent numbers. Use only what's in the metrics. End with a concrete suggestion (a question to ask, a meeting to schedule, a metric to watch).
Do not start with "Alert:" or repeat the company name.`;

interface AlertContext {
  notificationId: string;
  kind: string;
  title: string;
  companyId: string;
  companyName: string;
  metrics: Array<{
    quarter: string;
    arr_usd: number | null;
    burn_usd: number | null;
    cash_usd: number | null;
    revenue_usd: number | null;
    headcount: number | null;
  }>;
}

async function enrichAlert(supabase: ReturnType<typeof createClient>, ctx: AlertContext): Promise<boolean> {
  const recent = ctx.metrics.slice(-4);
  const prompt = `Company: ${ctx.companyName}
Alert: ${ctx.kind}
Original notification title: ${ctx.title}

Recent metrics (oldest to most recent):
${JSON.stringify(recent, null, 2)}

Write the analyst body for this alert.`;

  try {
    const body = await gemini.generate(prompt, {
      model: "flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.4,
      maxOutputTokens: 220,
    });
    const trimmed = body.trim().slice(0, 600);
    if (!trimmed) return false;
    const { error } = await supabase
      .from("notifications")
      .update({ body: trimmed })
      .eq("id", ctx.notificationId);
    return !error;
  } catch {
    return false; // keep the original heuristic body on AI failure
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: ranData, error: ranErr } = await supabase.rpc("run_metric_alerts");
  if (ranErr) {
    return NextResponse.json({ ok: false, error: ranErr.message }, { status: 500 });
  }

  // Pull the most recent alerts (last 5 minutes) to enrich. If the cron just
  // inserted them they'll be in this window; if not we silently skip.
  const sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: fresh } = await supabase
    .from("notifications")
    .select("id, kind, title, metadata_json, body, organization_id")
    .in("kind", ALERT_KINDS as unknown as string[])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  // L.20 — emit one usage_event per fresh alert. Organization comes from
  // the notification row (cron-side, not auth-scoped).
  if (fresh && fresh.length > 0) {
    const eventRows = fresh
      .filter((n: any) => n.organization_id)
      .map((n: any) => ({
        organization_id: n.organization_id,
        kind: "alert_created" as const,
        metadata: { notification_id: n.id, kind: n.kind } as any,
      }));
    if (eventRows.length > 0) {
      await supabase.from("usage_events").insert(eventRows);
    }
  }

  let enriched = 0;
  let skipped = 0;

  if (fresh && fresh.length > 0) {
    // Build a unique set of company_ids so we fetch metrics once per company
    const companyIds = Array.from(
      new Set(fresh.map((n: any) => (n.metadata_json?.company_id as string | undefined)).filter(Boolean) as string[])
    );

    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, metrics(quarter, arr_usd, burn_usd, cash_usd, revenue_usd, headcount)")
        .in("id", companyIds);

      const byCompany = new Map<string, { name: string; metrics: AlertContext["metrics"] }>();
      for (const c of (companies ?? []) as any[]) {
        const sorted = ((c.metrics ?? []) as any[]).sort((a, b) => a.quarter.localeCompare(b.quarter));
        byCompany.set(c.id, { name: c.name, metrics: sorted });
      }

      for (const n of fresh as any[]) {
        const cid = n.metadata_json?.company_id as string | undefined;
        if (!cid) { skipped++; continue; }
        const c = byCompany.get(cid);
        if (!c) { skipped++; continue; }
        const ok = await enrichAlert(supabase, {
          notificationId: n.id,
          kind: n.kind,
          title: n.title,
          companyId: cid,
          companyName: c.name,
          metrics: c.metrics,
        });
        if (ok) enriched++; else skipped++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ran: ranData,
    enriched,
    skipped,
    candidates: fresh?.length ?? 0,
  });
}
