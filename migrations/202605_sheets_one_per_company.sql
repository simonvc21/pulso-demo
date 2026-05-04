-- L.10 / Fase 1.A — One sheet per company.
-- Locks the data model down to the simplified MVP shape: each company has
-- exactly one editable sheet. If we ever want multiple, drop this constraint.

alter table public.sheets
  add constraint sheets_one_per_company unique (company_id);
