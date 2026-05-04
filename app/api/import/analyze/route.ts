// L.8e — AI-assisted import analyzer. Takes the headers + sample rows from a
// CSV (or each sheet of an xlsx) and asks Gemini to identify the structure:
//   - Is it one row per company, or one row per company × period?
//   - Is data split across multiple sheets (one per company)?
//   - Which columns map to: company name, period, ARR, burn, cash, revenue,
//     headcount, sector, country, stage, invested, ownership, founder, founder_email?
//
// Returns a normalized mapping the client can use to extract companies +
// historical metrics in a single import.

import { NextResponse, type NextRequest } from "next/server";
import { gemini } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SheetSample {
  name: string;
  rowCount: number;
  /** First N rows of the sheet, as the raw CSV string (header + ≤8 data rows). */
  sample: string;
}

interface AnalyzeRequest {
  sheets: SheetSample[];
  /** Hint about what the user is importing — defaults to "companies". */
  intent?: "companies" | "metrics" | "both";
}

interface ColumnMapping {
  /** Column header text in the file. Empty if not found. */
  source: string;
  /** Notes / confidence hint from the model (optional). */
  note?: string;
}

interface SheetMapping {
  sheetName: string;
  /** What kind of data this sheet contains. */
  shape:
    | "companies_long"          // one row per company × period (most common Airtable shape)
    | "companies_simple"        // one row per company, no historical data
    | "metrics_only"            // historical rows tied to one company (sheet name = company)
    | "ignored";                // header-only, summary, or unrelated content
  /** When shape=metrics_only, the company name is taken from the sheet name. */
  companyNameOverride?: string;
  columns: {
    company_name?: ColumnMapping;
    period?: ColumnMapping;
    sector?: ColumnMapping;
    country?: ColumnMapping;
    stage?: ColumnMapping;
    invested?: ColumnMapping;
    ownership_pct?: ColumnMapping;
    founder?: ColumnMapping;
    founder_email?: ColumnMapping;
    arr?: ColumnMapping;
    burn?: ColumnMapping;
    cash?: ColumnMapping;
    revenue?: ColumnMapping;
    headcount?: ColumnMapping;
    runway?: ColumnMapping;
  };
  /** Free-form note from the model about anything ambiguous. */
  notes?: string;
}

interface AnalyzeResponse {
  /** Per-sheet mapping. */
  mappings: SheetMapping[];
  /** Top-level commentary the GP should see ("Detected one sheet per company"). */
  summary: string;
}

const SYSTEM = `You are a data import analyst for a venture capital portfolio app.

The user just uploaded a spreadsheet (CSV or Excel). You will see the headers + first few data rows from each sheet. Your job: figure out what shape the data is in and produce a structured JSON mapping.

The target schema is a VC portfolio with two tables:
1. companies — name, sector, country, stage, invested_usd, ownership_pct, founder name + email
2. metrics — per-company historical data: ARR, burn, cash, revenue, headcount, plus a period (month or quarter)

Common spreadsheet shapes you must recognize:

A. "companies_long" (most common for Airtable exports): one row per company × period. Columns include the company name AND period AND all metrics. The same company appears N times (one row per month).

B. "companies_simple": one row per company, no historical metrics. Columns are name + sector + country + stage + invested.

C. "metrics_only": one sheet per company (sheet name = company name). Each row is a period; columns are the metrics for that period. The company name is NOT a column — it's the sheet name.

D. "ignored": empty, summary, "Notes", "Read me", "Table of contents", etc. Mark these as ignored.

For each sheet, return:
{
  sheetName: string,
  shape: "companies_long" | "companies_simple" | "metrics_only" | "ignored",
  companyNameOverride: string | null,  // set ONLY when shape="metrics_only" — copy the sheet name as the company name
  columns: {
    company_name?: { source: string },  // header text in the file that maps to this concept
    period?: { source: string },
    sector?: { source: string },
    country?: { source: string },
    stage?: { source: string },
    invested?: { source: string },
    ownership_pct?: { source: string },
    founder?: { source: string },
    founder_email?: { source: string },
    arr?: { source: string },
    burn?: { source: string },
    cash?: { source: string },
    revenue?: { source: string },
    headcount?: { source: string },
    runway?: { source: string }
  },
  notes: string  // anything ambiguous
}

Rules:
- "ARR" might be called "MRR", "Revenue Mensual", "Recurring Revenue", "Ingresos recurrentes" — use your best guess.
- "Burn" might be "Quema mensual", "Cash burn", "Gasto mensual".
- "Cash" might be "Caja", "Tesorería", "Efectivo en banco".
- "Period" might be "Mes", "Month", "Period", "Fecha", "Quarter" — even formatted like "Jul 2024".
- If a column doesn't exist in the file, OMIT the key (don't return empty string).
- If multiple sheets are clearly per-company metrics dumps, mark each as metrics_only.
- If one sheet has all companies stacked, mark it companies_long.
- Be honest in notes if something doesn't fit cleanly.

Output ONLY valid JSON matching the AnalyzeResponse shape. No prose, no markdown fences.`;

export async function POST(req: NextRequest) {
  // Auth gate.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile || !["gp", "managing_partner", "partner", "analyst"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "GP-side roles only" }, { status: 403 });
  }

  let body: AnalyzeRequest;
  try { body = await req.json() as AnalyzeRequest; }
  catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  if (!body.sheets || body.sheets.length === 0) {
    return NextResponse.json({ error: "No sheets provided" }, { status: 400 });
  }
  if (body.sheets.length > 50) {
    return NextResponse.json({ error: "Too many sheets (max 50)" }, { status: 400 });
  }

  // Build the user-side prompt: per-sheet samples + intent.
  const lines: string[] = [];
  lines.push(`User intent: ${body.intent ?? "companies"}.`);
  lines.push(`Number of sheets: ${body.sheets.length}.`);
  lines.push("");
  for (const s of body.sheets) {
    lines.push(`=== Sheet: "${s.name}" (${s.rowCount} data rows) ===`);
    // Truncate aggressively so we don't blow token budget.
    lines.push(s.sample.slice(0, 2000));
    lines.push("");
  }
  lines.push("Return ONLY the JSON object — no prose.");

  try {
    const text = await gemini.generate(lines.join("\n"), {
      systemInstruction: SYSTEM,
      temperature: 0.2,
      maxOutputTokens: 4000,
    });

    const cleaned = text.trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "")
      .trim();

    let parsed: AnalyzeResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      console.error("[import/analyze] JSON parse failed", e?.message, cleaned.slice(0, 500));
      return NextResponse.json({ error: "AI returned invalid JSON. Try again or import manually." }, { status: 500 });
    }

    if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
      return NextResponse.json({ error: "AI response missing mappings array" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[import/analyze] gemini failed", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Analysis failed" }, { status: 500 });
  }
}
