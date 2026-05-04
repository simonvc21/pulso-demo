// L.6 — Newsletter draft generator. Reads the fund's current data (KPIs,
// company list, watch list, recent activity) and returns a sensible default
// block set so the GP starts from "edit & publish" instead of "blank page".
//
// L.6c — Now generates rich per-company narrative paragraphs (ARR, runway,
// cash, burn, headcount, status flags, latest GP note) and a fully-populated
// watch list with reasons. Reads like a stat-rich draft the GP can polish.

import { createClient } from "@/lib/supabase/server";
import type { Block, NewsletterCadence } from "./newsletter";
import { newId } from "./newsletter";
import { fmtUSD, fmtPct } from "./utils";
import { gemini } from "@/lib/gemini";

interface DraftInput {
  organizationId: string;
  periodLabel: string;
  cadence: NewsletterCadence;
  fundName: string;
  /** L.6d — when set, Overview + Outlook are AI-generated using this framing. */
  prompt?: string;
}

const PROMPT_SYSTEM = `You are a writing editor helping a venture capital General Partner draft a paragraph for a Limited Partner newsletter.

Rules:
- Use ONLY facts present in the data context provided. Do not invent companies, numbers, dates, rounds, or events.
- Match the voice of premium VC LP letters: confident, factual, direct, free of hype.
- Output prose only. No markdown, no headings, no lists, no quote marks.
- Length: 2-4 sentences for Overview/Outlook unless the GP prompt asks for more.
- Honor the GP's framing prompt while staying grounded in the data.`;

async function generateOverview(opts: {
  fundName: string;
  periodLabel: string;
  prompt: string;
  facts: string;
}): Promise<string | null> {
  try {
    const userPrompt =
      `Fund: ${opts.fundName}\nPeriod: ${opts.periodLabel}\n\n` +
      `GP framing prompt:\n${opts.prompt}\n\n` +
      `Real data context (use these facts only — never invent):\n${opts.facts}\n\n` +
      `Write the OVERVIEW paragraph that opens this LP newsletter. Return prose only.`;
    const text = await gemini.generate(userPrompt, { systemInstruction: PROMPT_SYSTEM, temperature: 0.5 });
    return cleanProse(text);
  } catch {
    return null;
  }
}

async function generateOutlook(opts: {
  fundName: string;
  periodLabel: string;
  prompt: string;
  facts: string;
}): Promise<string | null> {
  try {
    const userPrompt =
      `Fund: ${opts.fundName}\nPeriod: ${opts.periodLabel}\n\n` +
      `GP framing prompt:\n${opts.prompt}\n\n` +
      `Real data context:\n${opts.facts}\n\n` +
      `Write the OUTLOOK / closing paragraph for this LP newsletter — what's next, how the GP is supporting companies, ` +
      `and a brief thank-you to LPs. Return prose only.`;
    const text = await gemini.generate(userPrompt, { systemInstruction: PROMPT_SYSTEM, temperature: 0.5 });
    return cleanProse(text);
  } catch {
    return null;
  }
}

function cleanProse(s: string): string {
  return s.trim()
    .replace(/^["']/, "")
    .replace(/["']$/, "")
    .replace(/^```[\s\S]*?\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

export async function buildDefaultDraft(input: DraftInput): Promise<{
  coverTitle: string;
  coverSubtitle: string;
  heroMetricSummary: string;
  blocks: Block[];
}> {
  const supabase = createClient();

  // Pull every active company. Metrics now live per-company in sheets — for
  // the newsletter draft we leave them empty; the body still narrates from
  // company_updates + form_submissions news fields. Sheet-derived metrics
  // for the draft are a follow-up.
  const { data: rows } = await supabase
    .from("companies")
    .select("id, slug, name, sector, status, flag")
    .eq("organization_id", input.organizationId)
    .is("archived_at", null);

  type MetricSnapshot = { py: number; pm: number; arr: number; burn: number; cash: number; revenue: number; headcount: number };
  const companies = ((rows ?? []) as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    sector: c.sector,
    status: c.status,
    flag: c.flag,
    metrics: [] as MetricSnapshot[],
    latest: null as MetricSnapshot | null,
    prev: null as MetricSnapshot | null,
    yoy: null as MetricSnapshot | null,
  }));

  // L.6c — pull the most recent company_updates note for each company so the
  // per-company paragraph can include narrative flavor.
  const ids = companies.map((c) => c.id);
  const latestNoteByCompany = new Map<string, string>();
  if (ids.length > 0) {
    const { data: updates } = await (supabase as any)
      .from("company_updates")
      .select("company_id, body, created_at")
      .in("company_id", ids)
      .order("created_at", { ascending: false });
    for (const u of (updates ?? []) as any[]) {
      if (!latestNoteByCompany.has(u.company_id)) {
        latestNoteByCompany.set(u.company_id, u.body);
      }
    }
  }

  // ---- Fund-level KPIs ----
  const arrTotal = companies.reduce((a, c) => a + (c.latest?.arr ?? 0), 0);
  const arrPrev  = companies.reduce((a, c) => a + (c.prev?.arr ?? 0), 0);
  const cashTotal = companies.reduce((a, c) => a + (c.latest?.cash ?? 0), 0);
  const burnTotal = companies.reduce((a, c) => a + (c.latest?.burn ?? 0), 0);
  const headcountTotal = companies.reduce((a, c) => a + (c.latest?.headcount ?? 0), 0);
  const arrMoM = arrPrev > 0 ? ((arrTotal - arrPrev) / arrPrev) * 100 : 0;
  const runwayMo = burnTotal > 0 ? cashTotal / burnTotal : 0;

  const coverTitle = `${input.fundName}: ${input.periodLabel} Portfolio Update`;
  const coverSubtitle = "Quarterly portfolio update for our limited partners";
  const heroMetricSummary = `${companies.length} companies · ${fmtUSD(arrTotal, { compact: true })} portfolio ARR · ${runwayMo > 0 ? `${runwayMo.toFixed(0)} mo runway` : "—"}`;

  const watchEntries = companies
    .filter((c) => c.status === "critical" || c.status === "watch" || c.flag)
    .map((c) => ({
      slug: c.slug,
      reason: c.flag ?? (c.status === "critical" ? "Critical status" : "Watch list"),
    }));

  // ---- Default block layout ----
  const blocks: Block[] = [];

  // L.6d — Build a compact facts string the AI can ground itself on.
  const factsBlob = (() => {
    const lines: string[] = [];
    lines.push(`Fund: ${input.fundName}`);
    lines.push(`Period: ${input.periodLabel}`);
    lines.push(`Active companies: ${companies.length}`);
    lines.push(`Portfolio ARR: ${fmtUSD(arrTotal, { compact: true })}` +
      (arrPrev > 0 ? ` (${arrMoM >= 0 ? "+" : ""}${arrMoM.toFixed(2)}% vs prior period)` : ""));
    lines.push(`Combined cash on hand: ${fmtUSD(cashTotal, { compact: true })}`);
    if (burnTotal > 0) lines.push(`Aggregate monthly burn: ${fmtUSD(burnTotal, { compact: true })}`);
    if (runwayMo > 0) lines.push(`Average portfolio runway: ${runwayMo.toFixed(1)} months`);
    lines.push(`Headcount across portfolio: ${headcountTotal}`);
    if (watchEntries.length > 0) {
      lines.push(`Watch list: ${watchEntries.map((e) => `${companies.find((c) => c.slug === e.slug)?.name ?? e.slug} (${e.reason})`).join("; ")}`);
    }
    lines.push(`\nPer-company snapshot (latest period):`);
    for (const c of companies) {
      const last = c.latest;
      if (!last) continue;
      const runway = last.burn > 0 ? last.cash / last.burn : null;
      lines.push(
        `- ${c.name} (${c.sector ?? "—"}, ${c.status}): ARR ${fmtUSD(last.arr, { compact: true })}, ` +
        `cash ${fmtUSD(last.cash, { compact: true })}, burn ${last.burn > 0 ? fmtUSD(last.burn, { compact: false }) + "/mo" : "—"}, ` +
        (runway != null ? `${runway.toFixed(1)}mo runway, ` : "") +
        `${last.headcount} FTE` +
        (c.flag ? `, flag: ${c.flag}` : "")
      );
    }
    return lines.join("\n");
  })();

  // Opening narrative — AI-generated when a prompt was given, else structured.
  const periodWord = input.cadence === "monthly" ? "month"
    : input.cadence === "quarterly" ? "quarter"
    : input.cadence === "annual" ? "year"
    : "period";
  const directionWord = arrMoM >= 0 ? "growth" : "contraction";

  let introBody: string | null = null;
  if (input.prompt && input.prompt.trim().length > 0) {
    introBody = await generateOverview({
      fundName: input.fundName,
      periodLabel: input.periodLabel,
      prompt: input.prompt,
      facts: factsBlob,
    });
  }
  if (!introBody) {
    // Structured fallback (always works even if AI is down).
    introBody =
      `${input.fundName} concluded ${input.periodLabel} with ` +
      (arrPrev > 0
        ? `${arrMoM >= 0 ? "strong " : ""}portfolio-wide ARR ${directionWord}, ` +
          `${arrMoM >= 0 ? "increasing" : "decreasing"} by ${Math.abs(arrMoM).toFixed(2)}% from the prior ${periodWord} ` +
          `to reach a total of ${fmtUSD(arrTotal, { compact: true })}.`
        : `aggregated ARR of ${fmtUSD(arrTotal, { compact: true })} across ${companies.length} active portfolio companies.`) +
      ` Combined cash on hand stands at ${fmtUSD(cashTotal, { compact: true })}` +
      (burnTotal > 0
        ? ` against ${fmtUSD(burnTotal, { compact: true })}/mo of aggregate burn — approximately ${runwayMo.toFixed(0)} months of runway in the system.`
        : `.`) +
      ` This update reflects the continued execution of our founders across the region` +
      (watchEntries.length > 0 ? `, despite some companies facing specific challenges.` : `.`);
  }

  blocks.push({
    id: newId(),
    type: "text",
    heading: "Overview",
    body: introBody,
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

  // L.6b — fund-level visualizations.
  blocks.push({
    id: newId(),
    type: "fund_arr_trend",
    heading: "Aggregated portfolio ARR over time",
    caption: "Sum across the active portfolio.",
  });

  blocks.push({
    id: newId(),
    type: "fund_arr_by_company",
    heading: "ARR by company",
    caption: "Latest period · normalized USD · color = health status.",
  });

  blocks.push({
    id: newId(),
    type: "sector_breakdown",
    heading: "Portfolio mix by sector",
    mode: "arr",
  });

  // L.6c — Per-company narrative section.
  blocks.push({ id: newId(), type: "divider" });
  blocks.push({
    id: newId(),
    type: "text",
    heading: "Portfolio Updates",
    body: "Per-company snapshots — financials this period plus the latest founder note on file. Edit any paragraph to add color or remove sensitive figures.",
  });

  // Sort companies by ARR descending so the bigger names lead.
  const ordered = [...companies].sort((a, b) => (b.latest?.arr ?? 0) - (a.latest?.arr ?? 0));
  for (const c of ordered) {
    blocks.push({
      id: newId(),
      type: "text",
      heading: c.name,
      body: companyParagraph(c, latestNoteByCompany.get(c.id) ?? null, input.periodLabel),
    });
  }

  // Watch list with reasons.
  if (watchEntries.length > 0) {
    blocks.push({ id: newId(), type: "divider" });
    blocks.push({
      id: newId(),
      type: "watch_list",
      heading: "Watch List",
      companies: watchEntries,
    });
  }

  // Outlook / closing note.
  blocks.push({ id: newId(), type: "divider" });

  let outlookBody: string | null = null;
  if (input.prompt && input.prompt.trim().length > 0) {
    outlookBody = await generateOutlook({
      fundName: input.fundName,
      periodLabel: input.periodLabel,
      prompt: input.prompt,
      facts: factsBlob,
    });
  }
  if (!outlookBody) {
    outlookBody =
      `As we move forward, we are encouraged by the overall trajectory of our portfolio` +
      (arrMoM >= 0 ? `, particularly the strong performance of our healthy companies. ` : `. `) +
      `We remain committed to actively supporting our watch and critical companies, working closely with their leadership ` +
      `to address challenges and ensure they have the resources and strategic guidance needed to navigate current market conditions.\n\n` +
      `Thank you for your continued partnership.`;
  }

  blocks.push({
    id: newId(),
    type: "text",
    heading: "Outlook",
    body: outlookBody,
  });

  return { coverTitle, coverSubtitle, heroMetricSummary, blocks };
}

// ---------------------------------------------------------------------------
// Per-company prose. Reads stat-heavy but flowing — close to the example the
// user showed. The "Polish with AI" button (L.6c) lets the GP smooth this
// further on demand.
// ---------------------------------------------------------------------------

function companyParagraph(
  c: { name: string; status: string; flag: string | null; latest: any; prev: any; metrics: any[] },
  latestNote: string | null,
  periodLabel: string,
): string {
  const last = c.latest;
  if (!last) {
    return `No metrics on file for ${periodLabel}.${latestNote ? ` Latest founder note: "${truncate(latestNote, 240)}"` : ""}`;
  }

  const sentences: string[] = [];

  // Sentence 1 — ARR + period.
  if (last.arr > 0) {
    sentences.push(
      `${c.name} ${past("close", c.status)} ${periodLabel} with an ARR of ${fmtUSD(last.arr, { compact: true })}.`
    );
  } else {
    sentences.push(`${c.name} did not report ARR for ${periodLabel}.`);
  }

  // Sentence 2 — cash + burn + runway.
  if (last.cash > 0 && last.burn > 0) {
    const runway = last.cash / last.burn;
    const tone = runway >= 18
      ? "a healthy"
      : runway >= 12
      ? "a comfortable"
      : runway >= 9
      ? "a moderate"
      : runway >= 6
      ? "a tightening"
      : "a constrained";
    sentences.push(
      `The company ${tone === "a healthy" || tone === "a comfortable" ? "maintains" : "holds"} ${tone} runway of approximately ${runway.toFixed(1)} months, ` +
      `with ${fmtUSD(last.cash, { compact: true })} in cash and a monthly burn of ${fmtUSD(last.burn, { compact: false })}.`
    );
  } else if (last.cash > 0) {
    sentences.push(`Cash on hand: ${fmtUSD(last.cash, { compact: true })}.`);
  }

  // Sentence 3 — MoM ARR change if material.
  if (c.prev && c.prev.arr > 0 && last.arr > 0) {
    const mom = ((last.arr - c.prev.arr) / c.prev.arr) * 100;
    if (Math.abs(mom) >= 5) {
      sentences.push(
        `ARR ${mom >= 0 ? "grew" : "contracted"} ${Math.abs(mom).toFixed(1)}% versus the prior period.`
      );
    }
  }

  // Sentence 4 — headcount.
  if (last.headcount > 0) {
    const prevHeads = c.prev?.headcount ?? 0;
    if (prevHeads > 0 && Math.abs(last.headcount - prevHeads) >= 1) {
      const delta = last.headcount - prevHeads;
      sentences.push(
        `Team size is ${last.headcount} FTE (${delta > 0 ? "+" : ""}${delta} vs prior period).`
      );
    } else {
      sentences.push(`Team size: ${last.headcount} FTE.`);
    }
  }

  // Sentence 5 — flag / status.
  if (c.flag) {
    sentences.push(`${c.name} is currently flagged: ${c.flag}.`);
  } else if (c.status === "critical") {
    sentences.push(`${c.name} is flagged as critical for this period.`);
  } else if (c.status === "watch") {
    sentences.push(`${c.name} is on the watch list.`);
  }

  // Sentence 6 — latest founder note (light edit: truncate + tidy).
  if (latestNote && latestNote.trim().length > 0) {
    sentences.push(`Latest founder note: "${truncate(latestNote.trim(), 280)}"`);
  }

  return sentences.join(" ");
}

function past(verb: string, status: string): string {
  // Light verb selection so "Norte declined Q4..." reads better than "Norte
  // closed Q4..." for a critical company. Default to "concluded".
  if (status === "critical") return "concluded";
  if (status === "watch") return "ended";
  return "finished";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + "…";
}
