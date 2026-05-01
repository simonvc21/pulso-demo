# Pulso — Interactive Demo

The portfolio OS for LATAM venture capital. This is a click-through demo with mock data — no backend, no auth. Every screen is meant to look and feel like the real product.

## Run it

```bash
cd pulso-demo
rm -rf node_modules .next   # only if a partial install was left behind
npm install
npm run dev
```

Open http://localhost:3000

> **Note:** The folder ships **without** `node_modules` (or with a partial one — delete it and reinstall). Verified to build cleanly with Node 18+ on a fresh `npm install`.

## What's in here

| Path | What it shows |
| --- | --- |
| `/dashboard` | **GP Overview** — KPIs, portfolio ARR by company (color-coded by status), trend, watch list, AI insight banner, recent activity. The hero screen. |
| `/companies` | **Portfolio table** — every company with sector, stage, ARR, QoQ, status, last update. Click a row → company detail. |
| `/companies/[slug]` | **Company detail** — financials over 8 quarters (ARR, cash, revenue, headcount), AI insight per company, recent submissions. Try `vextra` (healthy) and `brio` (critical). |
| `/forms` | **Form templates** — list of cadenced forms (monthly/quarterly/annual), response rates, schedule banner. |
| `/forms/new` | **Form builder** — interactive: add fields from the palette, edit labels and groups, mark required, set cadence and reminders. |
| `/fill/[id]` | **Founder-side form** (no sidebar) — the experience a founder gets via email link. Choose between AI-extract (upload a doc, watch it auto-fill) or manual entry. Includes review with AI flags + done state. |
| `/share/[token]` | **LP-shared view** (no sidebar) — branded, watermarked quarterly letter. AI summary, anonymized highlights. This is what gets shared with limited partners. |
| `/lps` | **LP roster** — commitments, types, last access. |
| `/settings` | Stub for fund profile / branding / integrations. |

## Demo script (for video / live walkthrough)

1. **Start at `/dashboard`** — narrate: "this is what the GP sees on Monday morning. Eight companies, $48M deployed, ARR up 8% QoQ, with two companies needing attention."
2. **Click `Brio` in the watch list** — "Pulso flagged this automatically — runway under 9 months. Here's the full history."
3. **Sidebar → Forms → New form** — "Setup is the first thing every fund asks about. Drag fields, set cadence, ship."
4. **Sidebar → Founder fill (preview)** — "This is what the founder sees. They can type it manually — or upload a PDF and let Pulso AI extract it." Click the upload area; watch the AI fill flow.
5. **Sidebar → LP view (preview)** — "Same data, curated for LPs. Watermarked, branded, view-only. One click from the GP dashboard."

## Tech

- **Next.js 14** (App Router), TypeScript, **Tailwind CSS**
- **Recharts** for charts, **lucide-react** for icons
- All data is static — see `lib/mock-data.ts`. Swap to real backend later (Supabase, Postgres + Drizzle, etc.)

## Brand palette (locked into Tailwind config)

- `navy` `#0A1F44` · primary surface for left rail and dark cards
- `gold` `#F4B740` · accent — highlights, "most popular", LP brand
- `teal` `#14B8A6` · growth, healthy state, AI-filled fields
- `coral` `#EF4444` · critical / alert
- `paper` `#F7F8FB` · background

Update `tailwind.config.ts` to swap any of these.

## Things you'll want to replace before pitching live

- Founder names, fund name (`Patagonia Fund I`), LP names — all in `lib/mock-data.ts`
- The watermark email in `app/share/[token]/page.tsx` — currently `andina@familyoffice.cl`
- The pilot fund quote in the deck (`Pulso_YC_Deck.pptx`)

## Next obvious things to build (post-demo)

- Real auth (Clerk or Auth0 — multi-tenant from day 1)
- Postgres + Drizzle, with `funds`, `companies`, `metrics`, `forms`, `submissions`, `lps` schema
- AI extraction service: pdf/excel → structured metrics (use Claude API)
- Email send + scheduled jobs (Resend + cron)
- LP-share signed links + audit log
- Multi-currency normalization (FX rates by quarter)
