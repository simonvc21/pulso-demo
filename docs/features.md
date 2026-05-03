# Pulso — Features, capabilities, and limitations

Snapshot of what the product does today, what's planned, and what's intentionally out of scope.
Last updated: 2026-05-02 (synced with the latest deployed commit).

---

## Live capabilities (deployed today)

### Auth and tenancy
- Supabase Auth with email + password and magic links.
- Multi-tenant: every fund is an `organizations` row; users belong to one org.
- Row Level Security (RLS) on every table — a user only sees their org's data via `public.user_org_id()` SECURITY DEFINER helper.
- Role-aware sign-in: `gp` / `managing_partner` / `partner` / `principal` / `vp` / `associate` / `analyst` / `advisor` / `viewer` for fund members; `lp` for limited partners.
- Trigger `handle_new_user`: at signup, GP override → pending invitation → LP detection by `lps.email` → viewer fallback.
- `/auth/post-login` routes by role: LP → `/lp`, anyone else → `/dashboard` (or `/onboarding` if no fund yet).

### GP-side surfaces
- **Marketing landing** (`/`).
- **Login** (`/login`) with magic link + password fallback.
- **Dashboard** (`/dashboard`) — fund KPIs (Total invested, Portfolio ARR, YoY growth, Runway), bar chart of ARR by company, watch list, ARR trend, activity feed, AI banner (dismissable, persists 24h via localStorage), portfolio newsletter section with founder updates.
- **Companies list** (`/companies`) — table with logo, sector, country, stage, invested, latest ARR, QoQ delta, status badge.
- **Company detail** (`/companies/[slug]`) — hero with logo + founder, **investment-instrument badge (SAFE / Convertible Note / Equity / SAFT / Warrant / Loan / Other) with cap + discount summary**, **website + LinkedIn link icons**, stat grid (invested / ARR / cash / burn / headcount / YoY), quarterly history charts (ARR / cash / revenue / headcount), recent submissions list, AI insight callout, newsletter feed scoped to the company.
- **Company edit** (`/companies/[slug]/edit`) — full editor incl. logo uploader, investment-terms section (instrument + conditional cap/discount for SAFE/Convertible), Links section (website + LinkedIn).
- **Forms list** (`/forms`) — template cards with cadence, field count, response rate.
- **Form detail** (`/forms/[slug]`) — fields grouped, recent submissions list with AI-assisted badge, send-now / pause buttons.
- **Form builder** (`/forms/new` and `/forms/[slug]/edit`):
  - New-form intro picks "Build with AI" or "Start blank".
  - Drag-and-drop reordering with `@dnd-kit/sortable`.
  - Field config panel with type / label / group / options / required.
  - Per-field "Rewrite with AI" buttons (Clearer / Spanish translation).
  - Recipients picker (all companies or per-company subset).
  - Cadence + reminder schedule sidebar.
- **LPs roster** (`/lps`) — table with logo initials, type, commitment, % of fund, last access; Add-LP modal portal'd to body.
- **Settings** (`/settings`) — profile card, Fund profile (name / vintage / size / deployed / currency / **description / thesis / website / linkedin / founded year**), Branding card (logo upload + 3 color pickers — primary / accent / navy with live theme injection), Team link.
- **Settings → Team** (`/settings/team`) — members list with inline role select, pending invitations with revoke, invite-by-email modal, **per-member "Scope" modal for company-level access** (B.5).
- **Notifications page** (`/notifications`) — full history with kind labels and click-through links.
- **Bell in topbar** — dropdown with last 15, unread count badge, mark-all-read; persistent across pages.
- **Data spreadsheet** (`/data`) — companies × quarters × 5 metrics, 2 view modes (by company / by quarter), inline editable cells with autosave + sticky first column + filter + sort, CSV export, **CSV import** (B.4 — drop file or paste, preview with errors, upsert), **column reorder/hide** persisted per-org (L.3), **per-cell notes** with right-click or hover-icon trigger (L.3 — stored in `metric_notes` table, golden dot indicator).
- **AI chatbot dock** — floating button bottom-right on every GP and LP page, opens slide-over panel. Powered by Gemini 2.5-flash with the org's full JSON context (companies, metrics, news, LPs, alerts, **investment thesis**). 8000 token cap (3000 for LPs). Per-org daily cap 150 calls. Multi-turn within an open conversation.

### LP-side surfaces
- **LP portal** (`/lp`) — letters list with view counts and expiry, prominent "Portfolio" callout (L.7), "Sign out" + "Switch to GP view" if user is dual-role.
- **LP portfolio list** (`/lp/companies`) — read-only table of every active company with logo, sector, stage, ARR, QoQ delta, status badge.
- **LP company detail** (`/lp/companies/[slug]`) — read-only mirror of the GP detail page: hero with logos + sector/stage/instrument/website/linkedin, KPI grid (Invested / ARR / Cash / Headcount / YoY), 4 quarterly charts (ARR / cash / revenue / headcount), narrative newsletter from founder submissions, AI insight callout. No edit / no Send-form buttons.
- **LP layout header**: Letters and Portfolio nav buttons.
- **LP letter** (`/share/[token]`) — branded, watermarked, fund hero with KPIs, **"Our thesis" card when set**, GP commentary, ARR trend chart, top movers, AI summary, view counter, expiry banner. Public/anonymous via SECURITY DEFINER RPC `get_share_letter`.
- **LP chatbot** — same dock, scoped JSON (no LP roster, no critical-flagged company names), 4000 token cap.

### Founder-side surfaces
- **Form fill** (`/fill/[id]?company=<slug>`) — anonymous, AI-prefill flow with "Upload PDF" demo + manual fill + review + submit. All fields rendered from the form template (currency, number, percent, text, longtext, news, select, date).
- Submissions persist via SECURITY DEFINER RPC `submit_public_form`, gated by recipient list.

### Onboarding (initial)
- `/onboarding` wizard auto-triggered when a user logs in without a fund.
- **5 steps** (L.8), every one skippable:
  1. **Fund profile** — name + vintage + size + currency + description + investment thesis (visible to LPs) + website.
  2. **LPs** — repeatable list (name, type, commitment, country, contact email). Inserted into `lps`; matched to LP users by email at sign-in.
  3. **Team** — invite-by-email with role select; sends magic links via existing `inviteUser` action.
  4. **Portfolio companies** — table-style manual entry (name, sector, country, stage, invested, ownership, founder + email). Stub "Upload CSV / Excel / PDF" button (real parser is B.4).
  5. **Historical metrics** — manual quarterly backfill per company × quarter (ARR / cash / burn / revenue / headcount), **plus CSV / Excel upload** (B.4): drop a `.csv` / `.xlsx`, paste raw text, or download the template. Tolerant headers (company_slug | company | name; quarter as "Q1 2026" / "2026-Q1" / "Q1-2026"; $/,/% stripped). Preview with row-by-row errors before commit. Upserts by `(company_id, quarter)` so re-running is safe. Excel parsing uses SheetJS, lazy-loaded only when an xlsx file is picked.
- New accounts start empty: the existing `handle_new_user` trigger only assigns the Patagonia seed to `simon.villena2010@gmail.com`; everyone else lands with no org and is routed to `/onboarding`.

### AI features (Gemini)
- All AI through `lib/gemini.ts` wrapper using `GEMINI_API_KEY`.
- Models: `gemini-2.5-flash` (cheap path) and `gemini-2.5-pro` (chatbot heavy).
- **Chatbot** (`/api/chat`) — generates analysis, newsletters (1000-1400 words covering all companies), portfolio Q&A. Role-aware scope.
- **Form helper** (`suggestFormFields`) — Gemini proposes 6-10 fields from a one-line description.
- **Field rewriter** (`rewriteFieldLabel`) — clearer or Spanish translation of any label.
- **Metric alerts** (cron `/api/cron/metric-alerts` daily at 14:00 UTC):
  - Heuristic detection of runway < 9mo, ARR drop > 10% QoQ, burn spike > 25% QoQ.
  - Each alert's `body` is rewritten by Gemini with company context + recommendation.
  - Idempotent over 80-day windows.
- Per-org daily AI quota (150 chat / 60 form helper) tracked in `ai_usage` table.

### Notifications
- `notifications` table + 4 Postgres triggers:
  - `form_submission_notify` (founder submits)
  - `share_link_view_notify` (LP opens letter)
  - `form_sent_notify` (GP sends a form)
  - `user_inserted_notify` (member joins)
- All visible in the bell dropdown + `/notifications` history.

### Customization
- **White-label**: per-org logo (Supabase Storage `org-assets` bucket), per-company logos.
- **Brand colors**: navy / primary / accent picker in Settings → Branding. Tailwind tokens are CSS-variable backed; the GP layout converts hex → RGB triplets and injects them. Changing colors updates every `bg-navy`, `text-gold`, `border-teal` instantly.
- **Dark mode**: 3-state toggle (Light / Dark / System) in the sidebar via `next-themes`. Surface tokens swap via CSS vars; status pastels (red-50 / teal-50 / gold-50) get low-alpha versions in dark.
- **Internationalization**: cookie-driven EN/ES with `LocaleSwitcher` in the sidebar. Translated: sidebar nav, topbar search, dashboard headers/KPIs/captions. Full app translation pending.
### Cron jobs
- `vercel.json` registers `/api/cron/metric-alerts` daily at 14:00 UTC.
- Endpoint protected by Vercel's `x-vercel-cron` header or `CRON_SECRET` bearer.

### Database
- 11 tables: `organizations`, `users`, `user_invitations`, `user_company_access`, `companies`, `metrics`, `forms`, `form_recipients`, `form_submissions`, `lps`, `share_links`, `notifications`, `ai_usage`.
- 8 SECURITY DEFINER RPCs for cross-RLS access: `user_org_id`, `can_access_company`, `bump_ai_usage`, `get_lp_letters`, `get_org_members`, `get_public_form`, `get_share_letter`, `submit_public_form`, `run_metric_alerts`.
- Full TypeScript types in `lib/database.types.ts` (regenerated after every migration).

### CSV exports
- `/api/export/companies` — flat company list.
- `/api/export/metrics` — long-format (one row per company × quarter).

---

## Limitations (current)

- **Demo seed is global**: Patagonia Fund I and its 8 seeded companies are the default. New accounts get a `/onboarding` wizard but the seed is still in the DB.
- **No emails sent yet**: Resend integration (Fase C) is in the roadmap. Magic links work because Supabase Auth handles them; product emails (form invites, reminders, "your letter is ready") don't go out.
- **Metrics schema is fixed**: every company has the same 5 quarterly metrics (ARR / burn / cash / revenue / headcount). Custom metrics per company is L.4 in the roadmap (large change).
- **Dashboard layout is fixed**: widgets aren't draggable/resizable/recolorable. (L.5 was shipped and reverted; column `organizations.dashboard_config_json` stays in the DB, currently null for everyone.)
- **Bulk import partial**: CSV + Excel (`.xlsx`, `.xlsm`, `.xls`, `.xlsb`, `.ods`) upload of historical metrics is shipped (B.4 — `/data` toolbar + onboarding Step 5). PDF/screenshot parsing still pending. Excel parsing via SheetJS, lazy-loaded so it doesn't bloat initial page weight; first sheet of the workbook is imported, others are ignored with a warning.
- **No subscription billing**: free for now, no Stripe integration. Planned in L.9.
- **No audit log**: who-did-what tracking is in Fase G (planned).
- **i18n partial**: only sidebar / topbar / dashboard core are translated. Companies / forms / settings pages still in English.
- **Vercel Preview env vars**: `GEMINI_API_KEY` is set on Production + Development but Preview deploys don't have it (CLI v52 quirk).
- **AI cost cap**: hard-coded 150 chat / 60 form helper calls per fund per day. No per-user breakdown.
- **Chat memory**: lives only in the open conversation tab — closing the dock resets history. No long-term memory.
- **Vector RAG not enabled**: Gemini ingests the full org snapshot per query. Fine up to ~50 companies × 12 quarters; beyond that we need pgvector (K.6 deferred).
- **Charts are not customizable**: titles / colors / position are hard-coded.

---

## Out of scope

- **Mobile apps** — GPs use laptops; native apps not planned.
- **QuickBooks / Carta / Xero integrations** — listed as "Coming soon" in Settings but not on any active phase. Long-tail nice-to-have.
- **Marketplace of templates between funds** — network-effect feature, only after 5+ paying funds.
- **Custom domain per fund** — uses `pulso-demo-three.vercel.app` for all funds today; per-fund subdomain is an enterprise feature for Fase G or later.

---

## Stack

- **Frontend**: Next.js 14.2 (App Router) + React 18 + TypeScript + Tailwind 3
- **Auth + DB**: Supabase (Postgres 15 + Auth + Storage + RLS)
- **AI**: Google Gemini (`@google/generative-ai`), `gemini-2.5-flash` for most paths
- **UI deps**: lucide-react, recharts, @dnd-kit, next-themes
- **Hosting**: Vercel (Pro plan target)
- **Cost at 10 funds (target)**: ~$115/mo ($20 Vercel + $25 Supabase + $20 Resend + $50 AI)
