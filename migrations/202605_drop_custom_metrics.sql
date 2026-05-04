-- L.10 / Fase 1.B — Custom metrics system removed.
-- Replaced by the per-company sheets model. Drop the three tables and the
-- enum that was specific to custom metrics.

drop table if exists public.custom_metric_values cascade;
drop table if exists public.metric_definition_companies cascade;
drop table if exists public.metric_definitions cascade;

drop type if exists public.custom_metric_type;
