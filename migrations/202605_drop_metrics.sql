-- L.10/Fase 1.G — drop the legacy metrics table.
-- Source of truth is now per-company sheets. All read paths and write paths
-- that previously touched this table have been migrated. The audit_metrics
-- trigger and its trigger function go with it (the audit_log table stays).

drop trigger if exists trg_audit_metrics on public.metrics;
drop function if exists public.audit_metrics_trigger();
drop table if exists public.metrics cascade;
