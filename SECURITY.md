# Pulso — Security & operational checks

Quick reference for things the team should verify before onboarding any
real fund. Generated as part of L.7.

---

## ✅ Service-role key audit (auto-checked L.7)

**Status: clean.** Zero references to `SUPABASE_SERVICE_ROLE_KEY`,
`service_role`, or `serviceRole` anywhere in `lib/` or `app/`. Every
server action goes through `lib/supabase/server.ts → createClient()`,
which uses the anon key + RLS.

Privilege escalation only happens via `SECURITY DEFINER` Postgres
functions (`submit_public_form`, `resolve_fill_token`, `audit_actor`,
etc), which is the proper pattern.

To re-verify: `grep -rn "service_role" lib/ app/`. Should return empty.

---

## ⚠️ Backups — verify in Supabase dashboard

The MCP doesn't expose plan/billing info. You need to confirm manually:

1. Open https://supabase.com/dashboard/project/wmsmptedodmtmtrdnaud/settings/billing
2. Check the project tier:
   - **Free tier:** 7-day daily backups, NO point-in-time recovery (PITR).
     If the DB is corrupted you can lose up to 24h of data and only
     restore to the day boundary.
   - **Pro tier ($25/mo):** 7-day daily backups + PITR (restore to any
     second within the window). This is what you want before importing
     a real fund.
3. If on Free, upgrade to Pro before the dry run with real data.

Also worth setting up:
- A weekly `pg_dump` to a separate location (S3 / your laptop) as a
  belt-and-suspenders backup. Supabase loses your project = you have a
  copy.

---

## ✅ Audit log (shipped L.7)

Every change to the trust-critical tables is logged to `public.audit_log`:
- `metrics` — every insert/update/delete with before/after columns
- `custom_metric_values` — same
- `companies` — name/sector/status/flag/founder/invested + archive events
- `newsletters` — create/edit/publish/unpublish
- `form_submissions` — every founder submission

Viewer at `/settings/audit`. RLS-scoped to GP-side roles only (LPs don't
see the audit log).

When an LP asks "this number changed since last quarter," go to
`/settings/audit?table=metrics`, find the company, see who edited what
and when.

---

## RLS audit checklist

Verified end-to-end as part of L.5c:

- `companies_select_org` — scoped via `user_org_id() AND can_access_company()`
- `metrics_select_org` — scoped via company → org
- `custom_metric_values_select_org` — scoped via company → org
- `newsletters_select` — scoped via org; LPs see only `status = published`
- `lp_messages_select` — LPs see only their own thread; GPs see all
- `audit_log_select_gp` — GP-side roles only, scoped to org

Anonymous routes (`/share/[token]`, `/fill/[id]`) use SECURITY DEFINER
RPCs (`get_share_letter`, `get_public_form`, `submit_public_form`,
`resolve_fill_token`) — they bypass RLS only after verifying the token
or slug matches an active row.

---

## What's NOT yet covered

- **No automated penetration test.** Worth running at least once before
  GA (HackerOne, OWASP ZAP, or a friendly hacker friend).
- **No 2FA** on GP login. Supabase Auth supports it; we haven't enabled it.
- **No IP allowlist** on the GP routes. Anyone with credentials can sign in
  from anywhere.
- **No rate limiting** beyond Vercel's default. A determined attacker could
  brute-force the founder fill tokens (192 bits each, so impractical, but
  defense in depth would help).
- **No GDPR/data deletion flow.** A founder asking "delete my data"
  doesn't have a self-serve path — the GP has to do it manually.
