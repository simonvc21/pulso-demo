// L.6 — Newsletter draft generator. Reads the fund's current data (KPIs,
// company list, watch list, recent activity) and returns a sensible default
// block set so the GP starts from "edit & publish" instead of "blank page".

import { createClient } from "@/lib/supabase/server";
import type { Block, NewsletterCadence } from "./newsletter";
import { newId } from "./newsletter";
import { fmtUSD, fmtPct } from "./utils";

interface DraftInput {
  organizationId: string;
  periodLabel: string;
  cadence: NewsletterCadence;
  fundName: string;
}

export async function buildDefaultDraft(input: DraftInput): Promise<{
  coverTitle: string;
  coverSubtitle: string;
  heroMetricSummary: string;
  blocks: Block[];
}> {
  const supabase = createClient();

  // Pull every active company with their last 13 monthly metric rows so we
  // can compute period-end + MoM/YoY at the fund level + per-company.
  const { data: rows } = await supabase
    .from("companies")
    .select(
      "id, slug, name, sector, status, flag, " +
      "metrics(quarter, arr_usd, burn_usd, cash_usd, headcount, revenue_usd, period_year, period_month)"
    )
    .eq("organization_id", input.organizationId)
    .is("archived_at", null);

  const companies = ((rows ?? []) as any[]).map((c) => {
    const metrics = ((c.metrics ?? []) as any[])
      .map((m) => ({
        py: m.period_year ?? 0,
        pm: m.period_month ?? 0,
        arr: Number(m.arr_usd ?? 0),
        burn: Number(m.burn_usd ?? 0),
        cash: Number(m.cash_usd ?? 0),
        revenue: Number(m.revenue_usd ?? 0),
        headcount: Number(m.headcount ?? 0),
      }))
      .sort((a, b) => (a.py - b.py) || (a.pm - b.pm));
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      sector: c.sector,
      status: c.status,
      flag: c.flag,
      metrics,
      latest: metrics[metrics.length - 1] ?? null,
      prev: metrics[metrics.length - 2] ?? null,
      yoy: metrics[metrics.length - 13] ?? null,
    };
  });

  // ---- Fund-level KPIs ----
  const arrTotal = companies.reduce((a, c) => a + (c.latest?.arr ?? 0), 0);
  const arrPrev  = companies.reduce((a, c) => a + (c.prev?.arr ?? 0), 0);
  const cashTotal = companies.reduce((a, c) => a + (c.latest?.cash ?? 0), 0);
  const burnTotal = companies.reduce((a, c) => a + (c.latest?.burn ?? 0), 0);
  const headcountTotal = companies.reduce((a, c) => a + (c.latest?.headcount ?? 0), 0);
  const arrMoM = arrPrev > 0 ? ((arrTotal - arrPrev) / arrPrev) * 100 : 0;
  const runwayMo = burnTotal > 0 ? cashTotal / burnTotal : 0;

  const coverTitle = `${input.fundName} — ${input.periodLabel}`;
  const coverSubtitle = "Portfolio update for our limited partners";
  const heroMetricSummary = `${companies.length} companies · ${fmtUSD(arrTotal, { compact: true })} portfolio ARR · ${runwayMo > 0 ? `${runwayMo.toFixed(0)} mo runway` : "—"}`;

  // ---- Standout companies ----
  // Top growers by MoM ARR (with a non-zero prev so % is meaningful).
  const growers = companies
    .filter((c) => c.prev && c.prev.arr > 0 && c.latest && c.latest.arr > c.prev.arr)
    .map((c) => ({
      ...c,
      mom: ((c.latest!.arr - c.prev!.arr) / c.prev!.arr) * 100,
    }))
    .sort((a, b) => b.mom - a.mom)
    .slice(0, 3);

  const watchEntries = companies
    .filter((c) => c.status === "critical" || c.status === "watch" || c.flag)
    .slice(0, 5)
    .map((c) => ({
      slug: c.slug,
      reason: c.flag ?? (c.status === "critical" ? "Runway / health flagged" : "Watch list"),
    }));

  // ---- Default block layout ----
  const blocks: Block[] = [];

  blocks.push({
    id: newId(),
    type: "text",
    heading: `A note from the team`,
    body:
      `Dear Partners,\n\n` +
      `This is our ${input.cadence === "monthly" ? "monthly" : input.cadence === "quarterly" ? "quarterly" : "periodic"} update for ${input.periodLabel}. ` +
      `Across ${companies.length} active portfolio companies, aggregated ARR is ${fmtUSD(arrTotal, { compact: true })} ` +
      `(${arrPrev > 0 ? fmtPct(arrMoM, 1) + " vs prior period" : "no prior baseline yet"}). ` +
      `Combined cash on hand stands at ${fmtUSD(cashTotal, { compact: true })} ` +
      `${burnTotal > 0 ? `against ${fmtUSD(burnTotal, { compact: true })}/mo aggregate burn — ${runwayMo.toFixed(0)} months of runway in the system.` : "with limited burn data on file."}\n\n` +
      `Highlights, watch items, and per-company detail follow.`,
  });

  blocks.push({
    id: newId(),
    type: "kpi_grid",
    heading: "By the numbers",
    items: [
      { label: "Portfolio ARR",    value: fmtUSD(arrTotal, { compact: true }), delta: arrPrev > 0 ? fmtPct(arrMoM, 1) : null, positive: arrMoM >= 0 },
      { label: "Cash on hand",     value: fmtUSD(cashTotal, { compact: true }) },
      { label: "Aggregate burn",   value: burnTotal > 0 ? `${fmtUSD(burnTotal, { compact: true })}/mo` : "—" },
      { label: "Avg runway",       value: runwayMo > 0 ? `${runwayMo.toFixed(0)} mo` : "—" },
      { label: "Headcount",        value: headcountTotal.toLocaleString("en-US") },
      { label: "Active companies", value: String(companies.length) },
    ],
  });

  if (growers.length > 0) {
    blocks.push({ id: newId(), type: "divider" });
    blocks.push({
      id: newId(),
      type: "text",
      heading: "Standouts this period",
      body:
        growers
          .map((g) => `• ${g.name} — ARR ${fmtPct(g.mom, 1)} MoM, now at ${fmtUSD(g.latest!.arr, { compact: true })}.`)
          .join("\n"),
    });
    // ARR chart for the top grower.
    if (growers[0]) {
      blocks.push({
        id: newId(),
        type: "metric_chart",
        companySlug: growers[0].slug,
        metric: "arr",
        caption: `${growers[0].name} — ARR trajectory.`,
      });
    }
  }

  if (watchEntries.length > 0) {
    blocks.push({ id: newId(), type: "divider" });
    blocks.push({
      id: newId(),
      type: "watch_list",
      heading: "Watch list",
      companies: watchEntries,
    });
  }

  // Closing note.
  blocks.push({ id: newId(), type: "divider" });
  blocks.push({
    id: newId(),
    type: "text",
    heading: "What's next",
    body:
      "Replace this paragraph with what's on your mind for the next quarter — pipeline, deployments, hires, " +
      "anything you want LPs to be primed for. The rest of this letter was auto-drafted from your dashboard.",
  });

  return { coverTitle, coverSubtitle, heroMetricSummary, blocks };
}
