# Pulso — Real Fund Dry Run Guide

Goal: put one real founder through the full submission loop before opening
the platform to a whole portfolio. Costs nothing, takes ~30 min total
spread across two days, and surfaces every paper-cut bug your real LPs
would otherwise see first.

---

## Why bother

Until a real human (not you) fills a real form with real numbers and you
see those numbers land in the dashboard + appear in a published newsletter
+ reach an LP's view, the whole stack is theoretical. Every shipped phase
(L.4d auto-write, L.4e founder tokens, L.6 newsletters, L.5c LP view) lives
or dies on this loop.

---

## Prep (5 min, day 1)

1. **Pick a friendly company.** Someone from your portfolio you trust to
   say "this sucked because…" honestly. Not your most polished founder —
   pick one who'll give you the real friction.

2. **Confirm fund onboarding done.** Sign in as the GP at
   https://pulso-demo-three.vercel.app/dashboard. You should see your fund
   name in the sidebar, your real companies in the table.

3. **Confirm the test company exists** in `/companies`. If not, add it:
   `/companies/new` or onboarding wizard CSV import.

4. **Set the test company's founder email** to your own (you'll be both
   GP and founder for the dry run). `/companies/<slug>/edit` → Founder
   section → primary email = your address.

---

## Step 1 — Create a Monthly Pulse form (5 min, day 1)

1. Sidebar → **Forms** → **New form**.
2. Add 3 fields:
   - "MRR (USD)" — currency type → **Save to → ARR (USD)**
   - "Cash on hand (USD)" — currency type → **Save to → Cash (USD)**
   - "Anything urgent?" — long-text type, leave "Save to" empty
3. Save → lands on the edit page with the green "Step 2" banner.
4. **Schedule editor** (auto-scrolled): pick day-of-month = 5, leave
   reminders [3, 1].
5. **Recipients table**: add the test company. Override email = your
   address. Save recipients.
6. **Active form widget**: open the company page, click "Active form" →
   send the Monthly Pulse to the test company with period label
   "M01 2026" (or whichever month is current).

---

## Step 2 — Generate a founder fill link (2 min, day 1)

1. Still on the company page, click **Founder link**.
2. **Create link** with label "Dry run founder".
3. Copy the URL. It looks like
   `https://pulso-demo-three.vercel.app/fill/current?token=<32-char>`.
4. Send the URL to your founder via Slack/WhatsApp (no email yet — Resend
   not wired). Ask them to fill it within 24h and tell you anything
   weird.

---

## Step 3 — Founder fills the form (founder, day 2)

The founder opens the URL. They should see:
- Your fund's logo in the corner (if uploaded)
- The form name + the period label ("M01 2026")
- Three fields: MRR, Cash on hand, Anything urgent
- Submit button at the bottom

What to watch for:
- Did they submit without confusion? Any field they didn't understand?
- Did they get a confirmation screen?
- Did they think the URL looked sketchy (token param is opaque)?
- On mobile vs desktop — both work?

Ask them to text you screenshots of each step.

---

## Step 4 — You verify the data landed (2 min, day 2)

After founder submits, log in as GP:

1. **Company detail page** (`/companies/<slug>`):
   - The KPI strip shows the new MRR/cash from the founder's fill?
     (May need a hard refresh — Cmd+Shift+R)
   - The ARR chart's last data point bumped up? (depends on whether the
     "Save to → ARR" mapping wrote correctly)
   - The "Active form" badge flipped from Pending → Submitted?

2. **Dashboard** (`/dashboard`):
   - Portfolio ARR KPI updated?
   - The ARR-by-company bar for the test company changed height?

3. **Data tab** (`/data`):
   - Find the test company × M01 2026 cell. Value matches what the
     founder typed?

4. **Form submissions** — currently the company-detail page shows
   hardcoded mock submissions. The real submission won't appear there
   yet (this is item #10 on the polish list — wire it to real data).

If any of these don't update, **stop here** and figure out why. Most
likely culprit: the field's `metricKey` mapping wasn't saved when you
created the form. Re-edit the form → check each field has a "Save to"
target → re-submit.

---

## Step 5 — Generate the first newsletter (10 min, day 2)

1. **Newsletters → New newsletter**.
2. Cadence: Quarterly (or Monthly if that's your real cadence).
3. Period label: matches the period of the data you just got.
4. Pick a suggested prompt chip that matches your tone.
5. **Create draft**.

What to check on the draft:
- Cover has your fund logo + period label.
- Overview paragraph references the real ARR / cash / runway numbers.
- KPI grid values match `/dashboard`.
- Charts (ARR trend, ARR by company, sector breakdown) actually render
  (not blank).
- "Portfolio Updates" section has one paragraph per company. Each
  paragraph has the company logo + ARR + runway + flag if any.
- Watch list lists the right companies.
- Outlook paragraph closes cleanly.

Edit anything that reads off. Try the **Polish with AI** button on the
Overview paragraph — does the rewrite preserve every number?

---

## Step 6 — Publish + view as LP (3 min, day 2)

1. **Publish to LPs**.
2. Open a private/incognito window. Sign in as your test LP user. (If
   you don't have one yet, create one in `/settings/team` with role
   `lp`.)
3. Land on `/lp`. Should see:
   - Fund-level KPI strip
   - Portfolio companies callout
   - "Latest newsletter" card linking to the just-published one
   - Message your GP card
4. Click the newsletter card → reads correctly?
5. Click "Fund overview" in the top nav → all 9 charts render?
6. Click "Portfolio companies" → click one → per-company dashboard
   loads?
7. Try posting a comment on a company page (LPs should be able to).

---

## Step 7 — Document what broke

After the loop, write down every paper-cut. Even cosmetic stuff:
- Wrong text somewhere
- A button that confused the founder
- A chart that rendered wrong on mobile
- An empty state with no CTA
- Anything that took >5 sec to load

Bring the list back here and we'll triage.

---

## Success criteria

- Founder submits without asking you a question. ✓
- Submission lands in dashboard within 30 sec. ✓
- Newsletter draft has real per-company prose grounded in real data. ✓
- LP sees the published newsletter + can navigate to per-company
  dashboards. ✓

If 4/4 → you're ready to onboard a second real company. If 3/4 → fix
the broken one and re-test. If <3/4 → real bugs to surface; that's the
whole point of the dry run.

---

## What this dry run does NOT cover

- Email delivery (Resend not wired — founders + LPs get no emails)
- Multi-currency display (everything labeled USD)
- Audit log (no record of who edited what)
- Stripe billing
- LP magic-link signup (they need to be added by you in
  `/settings/team`)

These are tracked separately.
