-- L.10 / Fase 1.D — Generalize share_links to point at dashboards too.
-- Existing rows are LP-letter shares (legacy). New rows are dashboard
-- shares: kind='fund_dashboard' or kind='company_dashboard' with
-- target_company_id set for the latter.

alter table public.share_links
  add column if not exists kind text not null default 'lp_letter',
  add column if not exists target_company_id uuid references public.companies(id) on delete cascade;

alter table public.share_links
  drop constraint if exists share_links_kind_check;
alter table public.share_links
  add constraint share_links_kind_check
    check (kind in ('lp_letter', 'fund_dashboard', 'company_dashboard'));

-- Company dashboards must name a company; fund dashboards must not.
alter table public.share_links
  drop constraint if exists share_links_target_consistent;
alter table public.share_links
  add constraint share_links_target_consistent
    check (
      (kind = 'company_dashboard' and target_company_id is not null)
      or (kind <> 'company_dashboard' and target_company_id is null)
    );

create index if not exists share_links_token_idx on public.share_links (token);
create index if not exists share_links_kind_org_idx on public.share_links (organization_id, kind);
