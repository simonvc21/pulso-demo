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

  // L.8h — Chunk the workbook. With 19+ sheets and verbose Spanish headers
  // a single AI call's JSON output blows past any reasonable token cap.
  // Process in batches of 5 sheets per call; merge results.
  const CHUNK_SIZE = 5;
  const chunks: SheetSample[][] = [];
  for (let i = 0; i < body.sheets.length; i += CHUNK_SIZE) {
    chunks.push(body.sheets.slice(i, i + CHUNK_SIZE));
  }

  function buildPromptForChunk(chunk: SheetSample[]): string {
    const lines: string[] = [];
    lines.push(`User intent: ${body.intent ?? "companies"}.`);
    lines.push(`Workbook total sheets: ${body.sheets.length}. This batch: ${chunk.length}.`);
    lines.push("");
    lines.push(`IMPORTANT: When a workbook has many sheets each named after a company (Avanzo, Beeok, Velocity, ...) and each sheet contains ~12-36 monthly data rows, treat each sheet as shape="metrics_only" and copy the sheet name to companyNameOverride. The cells inside the sheet often repeat the same name in a "Name" or "Nombre Startup" column — IGNORE those for naming.`);
    lines.push("");
    for (const s of chunk) {
      lines.push(`=== Sheet "${s.name}" (${s.rowCount} rows) ===`);
      const sampleLines = s.sample.split(/\r?\n/).slice(0, 5);
      const trimmedSample = sampleLines.join("\n").slice(0, 1200);
      lines.push(trimmedSample);
      lines.push("");
    }
    return lines.join("\n");
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

  // L.8j — Run all chunks in PARALLEL. Vercel Hobby plan caps function
  // duration at 10s; processing 4 chunks × ~5s each sequentially blows the
  // budget. Promise.all turns 4 × 5s into max(5s) ≈ 5s.
  const allMappings: AnalyzeResponse["mappings"] = [];
  const summaries: string[] = [];
  const chunkErrors: string[] = [];

  function isUseful(r: AnalyzeResponse | null): boolean {
    return !!r && Array.isArray(r.mappings) && r.mappings.length > 0;
  }

  async function processChunk(chunkIdx: number, chunk: SheetSample[]): Promise<{
    result: AnalyzeResponse | null;
    error: string | null;
  }> {
    const chunkPrompt = buildPromptForChunk(chunk);

    // Try Claude first when available; fall through to Gemini on empty/error.
    if (isClaudeEnabled()) {
      try {
        const r = await claude.generateJSON<AnalyzeResponse>(chunkPrompt, {
          model: "sonnet",
          systemInstruction: SYSTEM,
          temperature: 0.1,
          maxOutputTokens: 4000,
        });
        console.log(`[import/analyze] claude chunk ${chunkIdx + 1}/${chunks.length} → ${r?.mappings?.length ?? 0} mappings`);
        if (isUseful(r)) return { result: r, error: null };
      } catch (err: any) {
        console.error(`[import/analyze] claude chunk ${chunkIdx + 1}/${chunks.length} threw`, err?.message ?? err);
      }
    }

    try {
      const r = await gemini.generateJSON<AnalyzeResponse>(chunkPrompt, {
        systemInstruction: SYSTEM,
        temperature: 0.1,
        maxOutputTokens: 4000,
        responseSchema: responseSchema as any,
      });
      console.log(`[import/analyze] gemini chunk ${chunkIdx + 1}/${chunks.length} → ${r?.mappings?.length ?? 0} mappings`);
      if (isUseful(r)) return { result: r, error: null };
      return { result: null, error: "empty mappings" };
    } catch (err: any) {
      console.error(`[import/analyze] gemini chunk ${chunkIdx + 1}/${chunks.length} threw`, err?.message ?? err);
      return { result: null, error: err?.message ?? "unknown" };
    }
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk, idx) => processChunk(idx, chunk))
  );

  for (let i = 0; i < chunks.length; i++) {
    const { result: chunkResult, error } = chunkResults[i];
    if (error) chunkErrors.push(`Chunk ${i + 1}: ${error}`);

    // L.8i — heuristic fallback per missing sheet so we ALWAYS produce a
    // mapping for every sheet the user uploaded.
    const classifiedNames = new Set((chunkResult?.mappings ?? []).map((m) => m.sheetName));
    if (chunkResult && Array.isArray(chunkResult.mappings)) {
      allMappings.push(...chunkResult.mappings);
    }
    for (const s of chunks[i]) {
      if (!classifiedNames.has(s.name)) {
        allMappings.push({
          sheetName: s.name,
          shape: s.rowCount > 0 ? "metrics_only" : "ignored",
          companyNameOverride: s.name,
          columns: {},
          notes: "Heuristic fallback: AI didn't classify this sheet. Defaulted to metrics_only using the sheet name as the company.",
        });
      }
    }
    if (chunkResult?.summary) summaries.push(chunkResult.summary);
  }

  if (allMappings.length === 0) {
    return NextResponse.json({
      error: chunkErrors.join("; ") || "Could not produce any mappings — workbook may be empty.",
    }, { status: 500 });
  }

  const aiCount = allMappings.filter((m) => !m.notes?.startsWith("Heuristic fallback")).length;
  const heuristicCount = allMappings.length - aiCount;

  const merged: AnalyzeResponse = {
    mappings: allMappings,
    summary: summaries.length > 0
      ? summaries.join(" ")
      : `Analyzed ${body.sheets.length} sheets in ${chunks.length} batch${chunks.length === 1 ? "" : "es"}.` +
        (heuristicCount > 0 ? ` ${heuristicCount} sheet${heuristicCount === 1 ? "" : "s"} used heuristic fallback (sheet name = company name).` : ""),
  };

  return NextResponse.json(merged);
}
