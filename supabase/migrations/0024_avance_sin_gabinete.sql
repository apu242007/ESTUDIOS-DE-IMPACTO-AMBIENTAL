-- 0024: el avance por proyecto cuenta para el cruce GPS solo los waypoints de campo. Los de la ficha de gabinete
-- (cruces sacados de las capas en la oficina, kind = 'gabinete') no llevan GPS de mano y dejaban el paso pendiente
-- para siempre. Misma regla que el checklist del Resumen. Prueba: supabase/tests/avance_proyectos.sql.

create or replace view public.project_progress with (security_invoker = true) as
select
  p.id as project_id,
  p.org_id,
  (select count(*) from public.works w where w.project_id = p.id)::int as works,
  (select count(*) from public.works w where w.project_id = p.id and w.geom is not null)::int as works_geom,
  coalesce((select array_agg(li.status::text) from public.layer_imports li where li.project_id = p.id), '{}') as layer_statuses,
  (select count(*) from public.survey_lines s where s.project_id = p.id)::int as lines,
  (select count(*) from public.survey_lines s where s.project_id = p.id and s.closed)::int as lines_closed,
  (select count(*) from public.waypoints wp join public.survey_lines s on s.id = wp.line_id
     where wp.project_id = p.id and s.kind is distinct from 'gabinete')::int as waypoints,
  (select count(*) from public.waypoints wp join public.survey_lines s on s.id = wp.line_id
     where wp.project_id = p.id and wp.matched and s.kind is distinct from 'gabinete')::int as waypoints_matched,
  coalesce((select array_agg(g.status::text) from public.gps_imports g where g.project_id = p.id), '{}') as gps_statuses,
  (select count(*) from public.photos ph where ph.project_id = p.id)::int as photos,
  (select count(*) from public.project_impacts i where i.project_id = p.id)::int as impacts,
  (select count(*) from public.project_measures m where m.project_id = p.id)::int as measures
from public.projects p;
