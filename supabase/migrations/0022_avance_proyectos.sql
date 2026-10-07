-- 0022: conteos por proyecto para el índice de Proyectos (avance por fase sin 10 consultas por proyecto).
-- Mismos datos que el checklist del Resumen (apps/web/src/lib/data/summary.ts). security_invoker: respeta el RLS.
-- Prueba: supabase/tests/avance_proyectos.sql.

create view public.project_progress with (security_invoker = true) as
select
  p.id as project_id,
  p.org_id,
  (select count(*) from public.works w where w.project_id = p.id)::int as works,
  (select count(*) from public.works w where w.project_id = p.id and w.geom is not null)::int as works_geom,
  coalesce((select array_agg(li.status::text) from public.layer_imports li where li.project_id = p.id), '{}') as layer_statuses,
  (select count(*) from public.survey_lines s where s.project_id = p.id)::int as lines,
  (select count(*) from public.survey_lines s where s.project_id = p.id and s.closed)::int as lines_closed,
  (select count(*) from public.waypoints wp where wp.project_id = p.id)::int as waypoints,
  (select count(*) from public.waypoints wp where wp.project_id = p.id and wp.matched)::int as waypoints_matched,
  coalesce((select array_agg(g.status::text) from public.gps_imports g where g.project_id = p.id), '{}') as gps_statuses,
  (select count(*) from public.photos ph where ph.project_id = p.id)::int as photos,
  (select count(*) from public.project_impacts i where i.project_id = p.id)::int as impacts,
  (select count(*) from public.project_measures m where m.project_id = p.id)::int as measures
from public.projects p;

revoke all on public.project_progress from anon;
grant select on public.project_progress to authenticated;
