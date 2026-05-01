# CLAUDE.md — context for Claude Code

> Pulso: portfolio OS for LATAM venture capital. Next.js 14 + Supabase + Vercel.
> Status: live click-through demo with mock data. Backend ready (schema + seed + auth). Frontend NOT YET wired.

---

## Live URLs (production)

- **Demo:** https://pulso-demo-three.vercel.app (Vercel auto-deploys on push to `main`)
- **Repo:** https://github.com/simonvc21/pulso-demo (public)
- **Supabase project:** `wmsmptedodmtmtrdnaud` (us-west-2). Dashboard: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud
- **Vercel project:** `pulso-demo` in team `simonvillena2010-2380s-projects`

## Stack

- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Recharts for charts, lucide-react for icons
- Supabase: Postgres + Auth (single vendor, no Clerk)
- Vercel for hosting + auto-deploy

## What's mocked vs what's real (CRITICAL)

| Thing | Status |
| --- | --- |
| Frontend pages (dashboard, companies, forms, fill, share, lps, settings) | ✅ built and live |
| `lib/mock-data.ts` | ⚠️ still the source of truth — every page reads from here |
| Supabase schema (8 tables) | ✅ applied, source of truth in `migrations/` (not in repo, use Supabase MCP) |
| Supabase seed (Patagonia Fund I + 8 companies + 64 metrics + 3 forms + 6 LPs) | ✅ in DB |
| Supabase Auth | ✅ enabled (email/password + magic link). Google OAuth pending. |
| RLS policies | ✅ 16 policies, scoped via `public.user_org_id()` helper function |
| Trigger `handle_new_user()` | ✅ auto-creates `public.users` row on signup. Email `simon.villena2010@gmail.com` auto-assigns as GP of Patagonia Fund I |
| `lib/database.types.ts` | exists locally — regenerate via Supabase MCP `generate_typescript_types` if drift |
| Auth wiring in Next.js (`@supabase/ssr`, middleware, login page) | ❌ pending |
| Real DB queries replacing mock data | ❌ pending |

## Key paths

```
app/
  (gp)/                        # GP-side pages, gets the sidebar layout
    dashboard/page.tsx         # KPIs, ARR by company chart, watch list
    companies/page.tsx         # portfolio table
    companies/[slug]/page.tsx  # company detail with quarterly metrics
    forms/page.tsx             # form templates list
    forms/new/page.tsx         # form builder (drag-drop fields)
    lps/page.tsx               # LP roster
  fill/[id]/page.tsx           # founder-side form (no sidebar) with AI fill
  share/[token]/page.tsx       # LP-shared letter view (watermarked)
components/                    # shared UI
lib/
  mock-data.ts                 # ⚠️ THE source of truth right now
  types.ts                     # shared TS interfaces (Company, Fund, LP, etc.)
  database.types.ts            # auto-generated Supabase types (regenerate when schema drifts)
  utils.ts                     # cn() helper for Tailwind class merging
tailwind.config.ts             # brand palette: navy, gold, teal, coral, paper
ROADMAP.md                     # phased plan to MVP
.env.local.example             # Supabase URL + publishable key
```

## Schema cheatsheet (Supabase, schema `public`)

- `organizations(id, slug, name, vintage, size_usd, deployed_usd, currency)` — funds
- `users(id, organization_id, auth_user_id → auth.users.id, email, name, role)`
- `companies(id, organization_id, slug, name, sector, country, stage, status, flag, invested_usd, ownership_pct, founder_*, description)`
- `metrics(id, company_id, quarter, arr_usd, burn_usd, cash_usd, revenue_usd, headcount)` — UNIQUE(company_id, quarter)
- `forms(id, organization_id, slug, name, cadence, fields_json, sent_to_count, response_rate, last_sent_at, active)`
- `form_submissions(id, form_id, company_id, submitted_by_email, data_json, ai_flags_json, ai_extracted, submitted_at)`
- `lps(id, organization_id, name, type, commitment_usd, country, email, last_access_at)`
- `share_links(id, organization_id, lp_id, token, watermark_email, expires_at, view_count)`

Enums: `company_status` (healthy/watch/critical/no_data), `company_stage`, `form_cadence`, `form_field_type`, `lp_type`.

## Auth model

- Supabase Auth handles signup/login (email+password, magic link, Google OAuth pending)
- On `auth.users` INSERT, trigger `public.handle_new_user()` creates a row in `public.users`. If the new user's email is `simon.villena2010@gmail.com`, they're auto-assigned `organization_id = Patagonia Fund I` and `role = 'gp'`. Anyone else lands without an org and has to be assigned (manual SQL UPDATE for now, onboarding wizard later).
- RLS policies on every table use `public.user_org_id()` (SECURITY DEFINER) to scope reads/writes by the caller's org.
- Service role bypasses RLS — use for seeding/admin only, never ship to client.

## Conventions

- Server components do reads. Use `createServerClient()` from `@supabase/ssr` with the request's cookies.
- Client components do mutations + interactivity. Use `createBrowserClient()`.
- Don't import `lib/mock-data.ts` in new code — that's the file we're replacing.
- Tailwind: stick to the brand palette in `tailwind.config.ts` (navy, gold, teal, coral, paper). Don't hardcode hex colors in components.
- TypeScript: use the types from `lib/database.types.ts` for DB rows. Use `lib/types.ts` for view-model shapes that may diverge from DB (e.g., aggregations).
- Money: stored as `*_usd BIGINT` (whole dollars, not cents). Format on display only.

## How to run / test locally

```bash
npm install
cp .env.local.example .env.local   # publishable key already in there, safe
npm run dev                         # localhost:3000
npm run build                       # type-check + production build
```

For schema work, use the Supabase MCP server in this Claude Code session — don't write SQL files manually unless you need history.

To regenerate TS types after schema changes:
```bash
# via Supabase CLI (if installed)
supabase gen types typescript --project-id wmsmptedodmtmtrdnaud > lib/database.types.ts
# OR via Supabase MCP tool: generate_typescript_types
```

## Things NOT to do

- Don't commit `SUPABASE_SERVICE_ROLE_KEY`. It belongs in Vercel env vars only.
- Don't disable RLS to "make queries work." If a query needs to bypass RLS, it should run server-side with the service role.
- Don't add Clerk back. Auth is Supabase, that decision is locked in.
- Don't add a new ORM (Drizzle/Prisma) without asking — `@supabase/supabase-js` is enough for MVP and avoids generated-code drift.
- Don't hardcode the org_id of Patagonia Fund I in queries. Always go through `auth.uid()` → RLS, or look up by `slug = 'patagonia-fund-i'` for seed/test scripts.
- Don't push directly to `main` if a Vercel preview is needed first. The repo allows direct pushes; use feature branches when shipping anything risky.

## Pilot context

Patagonia Fund I is the demo seed data, but it's also the intended pilot fund (Simon's network). Names, founders, LPs in the seed are fictional but realistic for LATAM VC. When pitching, swap the founder photos / fund name in `lib/mock-data.ts` (or DB once wired) before sharing the link.
