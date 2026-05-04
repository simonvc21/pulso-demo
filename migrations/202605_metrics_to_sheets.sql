-- L.10 / Fase 1.2 — Migrate existing `metrics` rows into sheets/columns/rows.
--
-- For each company with metric data, create one sheet "KPIs trimestrales"
-- with 6 columns (Mes, ARR, Burn, Cash, Revenue, Headcount) and one sheet_row
-- per metric period.
--
-- Idempotent: skips companies that already have a sheet named "KPIs trimestrales".
-- The original `metrics` table is preserved.

do $$
declare
  v_company record;
  v_sheet_id uuid;
  v_col_mes uuid;
  v_col_arr uuid;
  v_col_burn uuid;
  v_col_cash uuid;
  v_col_revenue uuid;
  v_col_headcount uuid;
  v_metric record;
  v_pos int;
  v_period_label text;
  v_companies_done int := 0;
  v_rows_inserted int := 0;
begin
  for v_company in
    select c.id, c.name
    from public.companies c
    where exists (select 1 from public.metrics m where m.company_id = c.id)
      and not exists (
        select 1 from public.sheets s
        where s.company_id = c.id and s.name = 'KPIs trimestrales'
      )
  loop
    -- Create the sheet
    insert into public.sheets (company_id, name, description, position)
    values (v_company.id, 'KPIs trimestrales',
      'Migrated from the legacy metrics table. Edit columns / add rows as needed.', 0)
    returning id into v_sheet_id;

    -- Create columns in display order
    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'Mes', 'date',
        jsonb_build_object('time', false, 'format', 'MMM yyyy'), 0)
      returning id into v_col_mes;

    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'ARR', 'currency',
        jsonb_build_object('currency', 'USD', 'decimals', 0), 1)
      returning id into v_col_arr;

    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'Burn', 'currency',
        jsonb_build_object('currency', 'USD', 'decimals', 0), 2)
      returning id into v_col_burn;

    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'Cash', 'currency',
        jsonb_build_object('currency', 'USD', 'decimals', 0), 3)
      returning id into v_col_cash;

    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'Revenue', 'currency',
        jsonb_build_object('currency', 'USD', 'decimals', 0), 4)
      returning id into v_col_revenue;

    insert into public.sheet_columns (sheet_id, name, type, config, position)
      values (v_sheet_id, 'Headcount', 'number',
        jsonb_build_object('decimals', 0, 'thousand_sep', false), 5)
      returning id into v_col_headcount;

    -- Insert one row per metric period, sorted oldest → newest
    v_pos := 0;
    for v_metric in
      select * from public.metrics
      where company_id = v_company.id
      order by period_year nulls last, period_month nulls last, quarter
    loop
      -- Best-effort period label as ISO date for "Mes" column.
      -- If we have year+month, build "YYYY-MM-01"; else fall back to the
      -- raw quarter string. The "date" column type renders MMM yyyy.
      if v_metric.period_year is not null and v_metric.period_month is not null then
        v_period_label := to_char(make_date(v_metric.period_year, v_metric.period_month, 1), 'YYYY-MM-DD');
      else
        v_period_label := v_metric.quarter;
      end if;

      insert into public.sheet_rows (sheet_id, data, position)
      values (
        v_sheet_id,
        jsonb_build_object(
          v_col_mes::text,       v_period_label,
          v_col_arr::text,       v_metric.arr_usd,
          v_col_burn::text,      v_metric.burn_usd,
          v_col_cash::text,      v_metric.cash_usd,
          v_col_revenue::text,   v_metric.revenue_usd,
          v_col_headcount::text, v_metric.headcount
        ),
        v_pos
      );
      v_pos := v_pos + 1;
      v_rows_inserted := v_rows_inserted + 1;
    end loop;

    v_companies_done := v_companies_done + 1;
  end loop;

  raise notice 'Migrated % companies, inserted % sheet_rows total.',
    v_companies_done, v_rows_inserted;
end
$$;
