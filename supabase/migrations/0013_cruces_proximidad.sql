-- =====================================================================
-- 0013_cruces_proximidad.sql  —  Cruces por proximidad (Sprint 9B): elementos de las capas del cliente cerca de las obras
-- =====================================================================
-- Devuelve los elementos de capas (layer_features) NO vinculados a una obra del proyecto (ductos, caminos y líneas
-- existentes del cliente) que cruzan o están a menos de p_dist_m de las obras. Distancias en el CRS del proyecto (metros).
-- SECURITY INVOKER: la RLS de proyectos, obras y capas decide qué ve la persona que llama. Sin IA: solo ST_DWithin/ST_Intersects.
create or replace function public.nearby_features(p_project uuid, p_dist_m numeric)
returns table(feature_id uuid, feature_name text, layer_name text, dist_m numeric, crosses boolean, lon double precision, lat double precision)
language sql stable set search_path = public, extensions as $$
  with pr as (select coalesce(crs_epsg, 22182) as epsg from public.projects where id = p_project),
  w as (
    select ST_Union(ST_Transform(geom, (select epsg from pr))) as g
      from public.works where project_id = p_project and geom is not null
  ),
  f as (
    select lf.id, lf.name, li.base_name, ST_Transform(lf.geom, (select epsg from pr)) as g
      from public.layer_features lf
      join public.layer_imports li on li.id = lf.import_id
     where lf.project_id = p_project and lf.work_id is null and lf.geom is not null
  ),
  hit as (
    select f.id, f.name, f.base_name, f.g, w.g as wg,
           ST_Distance(f.g, w.g) as d, ST_Intersects(f.g, w.g) as x
      from f, w
     where w.g is not null and ST_DWithin(f.g, w.g, p_dist_m)
  )
  select id, name, base_name, round(d::numeric, 1), x,
         ST_X(pt4326), ST_Y(pt4326)
    from (
      select h.*, ST_Transform(
               case when h.x then ST_PointOnSurface(ST_Intersection(h.g, h.wg)) else ST_ClosestPoint(h.g, h.wg) end,
               4326) as pt4326
        from hit h
    ) t
   order by x desc, d, name;
$$;
grant execute on function public.nearby_features(uuid, numeric) to authenticated;
