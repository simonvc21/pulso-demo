-- L.10 / Fase 1 — Custom Tables (Airtable-style) for Pulso.
-- Three new tables + RLS + indexes. Replaces the rigid `metrics` table at the
-- application layer over time; `metrics` stays for now until every reader is
-- migrated (see /docs/airtable-tables-spec.md §2.4 + §7).

-- ---------------------------------------------------------------------------
-- 1. Sheets — one custom table per (company, name).
-- ---------------------------------------------------------------------------

create table if not exists public.sheets (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  description  text,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

create index if not exists sheets_company_id_idx
  on public.sheets (company_id, position);

-- ---------------------------------------------------------------------------
-- 2. Columns — schema of a sheet. Type + per-type config in jsonb.
-- ---------------------------------------------------------------------------

create table if not exists public.sheet_columns (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references public.sheets(id) on delete cascade,
  name         text not null,
  -- enum kept as plain text for forward-compat. Allowed values:
  --   text, long_text, number, currency, percent, date,
  --   single_select, checkbox, attachment_url
  type         text not null,
  config       jsonb not null default '{}'::jsonb,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  constraint sheet_columns_type_check check (type in (
    'text','long_text','number','currency','percent','date',
    'single_select','checkbox','attachment_url'
  ))
);

create index if not exists sheet_columns_sheet_id_idx
  on public.sheet_columns (sheet_id, position);

-- ---------------------------------------------------------------------------
-- 3. Rows — JSONB blob keyed by column.id. Cells with no value are absent.
-- ---------------------------------------------------------------------------

create table if not exists public.sheet_rows (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references public.sheets(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists sheet_rows_sheet_id_idx
  on public.sheet_rows (sheet_id, position);
create index if not exists sheet_rows_data_gin
  on public.sheet_rows using gin (data);

-- ---------------------------------------------------------------------------
-- 4. RLS — same pattern as the rest of the schema: scope via
--    company_id → companies.organization_id → public.user_org_id().
--    sheet_columns + sheet_rows scope via their parent sheet.
-- ---------------------------------------------------------------------------

alter table public.sheets enable row level security;
alter table public.sheet_columns enable row level security;
alter table public.sheet_rows enable row level security;

drop policy if exists sheets_org_select on public.sheets;
create policy sheets_org_select on public.sheets for select
  using (
    company_id in (
      select id from public.companies where organization_id = public.user_org_id()
    )
  );

drop policy if exists sheets_org_write on public.sheets;
create policy sheets_org_write on public.sheets for all
  using (
    company_id in (
      select id from public.companies where organization_id = public.user_org_id()
    )
  )
  with check (
    company_id in (
      select id from public.companies where organization_id = public.user_org_id()
    )
  );

drop policy if exists sheet_columns_org_select on public.sheet_columns;
create policy sheet_columns_org_select on public.sheet_columns for select
  using (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  );

drop policy if exists sheet_columns_org_write on public.sheet_columns;
create policy sheet_columns_org_write on public.sheet_columns for all
  using (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  )
  with check (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  );

drop policy if exists sheet_rows_org_select on public.sheet_rows;
create policy sheet_rows_org_select on public.sheet_rows for select
  using (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  );

drop policy if exists sheet_rows_org_write on public.sheet_rows;
create policy sheet_rows_org_write on public.sheet_rows for all
  using (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  )
  with check (
    sheet_id in (
      select s.id from public.sheets s
      join public.companies c on c.id = s.company_id
      where c.organization_id = public.user_org_id()
    )
  );
