# Pulso — Links

All the URLs you need. Last updated: 2026-05-02.

---

## Production

- **Live app**: https://pulso-demo-three.vercel.app
- **Marketing landing**: https://pulso-demo-three.vercel.app
- **GP login**: https://pulso-demo-three.vercel.app/login
  - Email: `simon.villena2010@gmail.com`
  - Password: `Pulso2026!`
- **LP login** (same login page):
  - Email: `andina@familyoffice.cl`
  - Password: `Andina2026!`

---

## App routes

### GP-side (after login)
| Path | What |
|---|---|
| `/dashboard` | Fund overview + KPIs + newsletter |
| `/companies` | Portfolio table |
| `/companies/[slug]` | Company detail with charts + AI insight |
| `/companies/[slug]/edit` | Edit company + upload logo |
| `/data` | Spreadsheet view of metrics, inline editable |
| `/forms` | Form templates list |
| `/forms/new` | New form wizard (AI or blank) |
| `/forms/[slug]` | Form detail + recent submissions |
| `/forms/[slug]/edit` | Form builder |
| `/lps` | LP roster + Add LP modal |
| `/notifications` | Full notifications history |
| `/settings` | Profile + Fund + Branding + Team link |
| `/settings/team` | Team management + per-member company scope |

### LP-side
| Path | What |
|---|---|
| `/lp` | LP home: letters list + portfolio callout |
| `/lp/companies` | LP portfolio list (read-only) |
| `/lp/companies/[slug]` | LP company detail with charts (read-only) |
| `/share/[token]` | Public LP letter (anonymous-safe) |

### Founder-side
| Path | What |
|---|---|
| `/fill/[id]?company=<slug>` | Public form fill |

### API endpoints
| Path | What |
|---|---|
| `/api/chat` | POST chatbot endpoint, gated by session |
| `/api/cron/metric-alerts` | Daily AI alerts cron (Vercel) |
| `/api/export/companies` | CSV export of companies |
| `/api/export/metrics` | CSV export of metrics (long format) |
| `/auth/callback` | Supabase magic-link callback |
| `/auth/post-login` | Routes by role (LP→/lp, GP→/dashboard, no fund→/onboarding) |

### Demo previews
- LP letter sample: https://pulso-demo-three.vercel.app/share/q1-2026-lp-letter
- Founder fill sample: https://pulso-demo-three.vercel.app/fill/q1-2026-financials?company=vextra

---

## Source code

- **GitHub repo**: https://github.com/simonvc21/pulso-demo
- **Default branch**: `main`
- **Deploy**: every push to `main` triggers a Vercel build automatically.

---

## Vercel

- **Project dashboard**: https://vercel.com/simonvillena2010-2380s-projects/pulso-demo
- **Deployments**: https://vercel.com/simonvillena2010-2380s-projects/pulso-demo/deployments
- **Env vars**: https://vercel.com/simonvillena2010-2380s-projects/pulso-demo/settings/environment-variables
  - `NEXT_PUBLIC_SUPABASE_URL` (set on production / preview / development)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (set on production / preview / development)
  - `GEMINI_API_KEY` (production + development; **preview missing** due to CLI quirk)
  - `CRON_SECRET` (optional; only needed for manual cron triggers)

---

## Supabase

- **Project dashboard**: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud
- **Project ID / ref**: `wmsmptedodmtmtrdnaud`
- **Region**: us-west-2
- **Database tables**: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/editor
- **Auth users**: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/auth/users
- **Auth URL config** (where `https://pulso-demo-three.vercel.app/auth/callback` is whitelisted):
  https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/auth/url-configuration
- **Storage buckets**: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/storage/buckets
  - `org-assets` (logos for funds and companies)
- **SQL editor**: https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/sql/new

---

## AI / Gemini

- **API key management**: https://aistudio.google.com/apikey
- **AI Studio (test prompts)**: https://aistudio.google.com
- **Pricing**: https://ai.google.dev/pricing
- **Models in use**:
  - `gemini-2.5-flash` (chat, alerts, form helper)
  - `gemini-2.5-pro` (planned for heavier features)

---

## Documentation

- **Roadmap**: [`/ROADMAP.md`](../ROADMAP.md) at repo root
- **Features + capabilities + limitations**: [`docs/features.md`](./features.md)
- **Project context for Claude Code**: [`/CLAUDE.md`](../CLAUDE.md) at repo root
- **README**: [`/README.md`](../README.md) at repo root
- **Brand assets**: [`/brand/`](../brand/) at repo root (logos, pitch deck, landing copy)

---

## Useful Supabase docs

- Next.js + Supabase SSR auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- RLS policies: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage with RLS: https://supabase.com/docs/guides/storage/security/access-control
- pgvector (planned for K.6): https://supabase.com/docs/guides/database/extensions/pgvector

---

## Useful Next.js docs

- App Router: https://nextjs.org/docs/app
- Server actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
