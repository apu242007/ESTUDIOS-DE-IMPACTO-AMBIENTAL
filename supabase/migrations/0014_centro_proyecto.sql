-- =====================================================================
-- 0014_centro_proyecto.sql  —  Centro del proyecto (centroide de las obras con geometría), para la regla de "fuera del área"
-- =====================================================================
create or replace function public.project_center(p_project uuid)
returns table(lon double precision, lat double precision)
language sql stable set search_path = public, extensions as $$
  select ST_X(c), ST_Y(c)
    from (select ST_Centroid(ST_Collect(geom)) as c from public.works where project_id = p_project and geom is not null) t
   where c is not null;
$$;
grant execute on function public.project_center(uuid) to authenticated;
