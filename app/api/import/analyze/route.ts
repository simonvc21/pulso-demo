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
import { claude, isClaudeEnabled } from "@/lib/anthropic";
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

const SYSTEM = `You are a data import analyst for a VC portfolio app.

The user uploaded a spreadsheet. For each sheet you see headers + sample rows. Classify each sheet's shape and map its columns.

Shapes:
- "companies_long": one row per company × period (Airtable export). The same company appears N times.
- "companies_simple": one row per company, no historicals.
- "metrics_only": SHEET NAME = company name. Each row is one period for that company. Common pattern: workbook with one tab per company (Avanzo, Beeok, Velocity, etc).
- "ignored": empty, summary, README, "table of contents".

Column mapping — recognize multilingual headers:
- arr: "ARR" / "MRR" / "Revenue Mensual" / "Recurring Revenue" / "Ingresos recurrentes"
- burn: "Burn" / "Quema" / "Cash burn" / "Gasto mensual"
- cash: "Cash" / "Caja" / "Tesorería" / "Efectivo"
- revenue: "Revenue" (when distinct from MRR) / "Ingresos" / "Facturación"
- headcount: "Headcount" / "FTE" / "Empleados" / "N° de empleados"
- runway: "Runway" / "Meses de runway"
- period: single column like "Mes" / "Month" / "Period" / "Fecha" / "Quarter".
- period_year + period_month: when year and month are SEPARATE columns. Year header: "Año" / "Year". Month header: "Mes" / "Month" / "Indique el mes" — values like "ENERO" "FEBRERO" "JANUARY". Set BOTH period_year and period_month columns, leave "period" unset.

For metrics_only: ALWAYS set companyNameOverride to the sheet name. Ignore any "Name" or "Nombre Startup" column inside the sheet — those are placeholders.

If a column doesn't exist, OMIT it from columns (don't return empty source string).`;

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

  // L.8f — Build the user prompt. Aggressive truncation per-sheet so 20+
  // sheet workbooks don't blow the model's context window.
  const lines: string[] = [];
  lines.push(`User intent: ${body.intent ?? "companies"}.`);
  lines.push(`Number of sheets: ${body.sheets.length}.`);
  lines.push("");
  lines.push(`IMPORTANT: When a workbook has many sheets each named after a company (Avanzo, Beeok, Velocity, ...) and each sheet contains ~12-36 monthly data rows, treat each sheet as shape="metrics_only" and copy the sheet name to companyNameOverride. The cells inside the sheet often repeat the same name in a "Name" or "Nombre Startup" column — IGNORE those for naming.`);
  lines.push("");
  for (const s of body.sheets) {
    lines.push(`=== Sheet "${s.name}" (${s.rowCount} rows) ===`);
    // Trim each sample to header + 4 sample rows, max 1200 chars.
    const sampleLines = s.sample.split(/\r?\n/).slice(0, 5);
    const trimmedSample = sampleLines.join("\n").slice(0, 1200);
    lines.push(trimmedSample);
    lines.push("");
  }

  // Schema enforced by Gemini JSON mode. The model must produce exactly this
  // shape — no markdown fences, no commentary, no truncation.
  const responseSchema = {
    type: "OBJECT",
    properties: {
      summary: { type: "STRING" },
      mappings: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            sheetName: { type: "STRING" },
            shape: { type: "STRING", enum: ["companies_long", "companies_simple", "metrics_only", "ignored"] },
            companyNameOverride: { type: "STRING" },
            columns: {
              type: "OBJECT",
              properties: {
                company_name: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                period: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                period_year: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                period_month: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                sector: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                country: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                stage: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                invested: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                ownership_pct: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                founder: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                founder_email: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                arr: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                burn: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                cash: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                revenue: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                headcount: { type: "OBJECT", properties: { source: { type: "STRING" } } },
                runway: { type: "OBJECT", properties: { source: { type: "STRING" } } },
              },
            },
            notes: { type: "STRING" },
          },
          required: ["sheetName", "shape"],
        },
      },
    },
    required: ["mappings"],
  };

  // L.8g — Try Claude first (better JSON adherence on multi-sheet workbooks);
  // fall back to Gemini if ANTHROPIC_API_KEY isn't set or Claude errors.
  const userPrompt = lines.join("\n");
  let parsed: AnalyzeResponse | null = null;
  let lastError: string | null = null;

  if (isClaudeEnabled()) {
    try {
      parsed = await claude.generateJSON<AnalyzeResponse>(userPrompt, {
        model: "sonnet",
        systemInstruction: SYSTEM,
        temperature: 0.1,
        maxOutputTokens: 8000,
      });
    } catch (err: any) {
      console.error("[import/analyze] claude failed, falling back to gemini", err?.message ?? err);
      lastError = err?.message ?? "Claude failed";
    }
  }

  if (!parsed) {
    try {
      parsed = await gemini.generateJSON<AnalyzeResponse>(userPrompt, {
        systemInstruction: SYSTEM,
        temperature: 0.1,
        maxOutputTokens: 8000,
        responseSchema: responseSchema as any,
      });
    } catch (err: any) {
      console.error("[import/analyze] gemini failed", err?.message ?? err);
      return NextResponse.json({
        error: err?.message ?? lastError ?? "Analysis failed",
      }, { status: 500 });
    }
  }

  if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
    return NextResponse.json({ error: "AI response missing mappings array" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
