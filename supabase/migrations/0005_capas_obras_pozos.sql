-- =====================================================================
-- 0005_capas_obras_pozos.sql  —  Vínculo elemento de capa → obra, y pozos desde capa
-- =====================================================================

-- La geometría de una obra es la unión de los elementos de capa vinculados a ella.
-- works.geom dispara trg_works_measures (largo/área con el CRS del proyecto).
create or replace function public.recalc_work_geom(p_work uuid)
returns void language sql as $$
  update public.works w
     set geom = (select ST_Collect(ST_Force2D(f.geom))
                   from public.layer_features f
                  where f.work_id = w.id and f.geom is not null)
   where w.id = p_work;
$$;
grant execute on function public.recalc_work_geom(uuid) to authenticated;

create or replace function public.sync_work_geom()
returns trigger language plpgsql as $$
begin
  -- la obra anterior solo se recalcula si se soltó el elemento (cambió de obra o se borró); si la obra es la
  -- misma y solo cambió la geometría, alcanza con el recálculo de abajo (una sola vez por fila)
  if tg_op in ('UPDATE','DELETE') and old.work_id is not null
     and (tg_op = 'DELETE' or old.work_id is distinct from new.work_id) then
    perform public.recalc_work_geom(old.work_id);
  end if;
  if tg_op in ('INSERT','UPDATE') and new.work_id is not null then
    perform public.recalc_work_geom(new.work_id);
  end if;
  return null;
end $$;
create trigger trg_layer_features_work_geom
  after insert or update of work_id, geom or delete on public.layer_features
  for each row execute function public.sync_work_geom();

-- Pozos a partir de los puntos de una capa importada. Idempotente: no duplica por nombre dentro del proyecto.
-- SECURITY INVOKER: RLS de layer_imports / layer_features / wells aplica al usuario que llama.
create or replace function public.create_wells_from_import(p_import uuid)
returns int language plpgsql as $$
declare v_project uuid; v_order int; v_n int;
begin
  select project_id into v_project from public.layer_imports where id = p_import;
  if v_project is null then raise exception 'capa inexistente o sin acceso'; end if;
  perform pg_advisory_xact_lock(hashtext('wells:' || v_project::text));  -- evita duplicados/órdenes repetidos en llamadas simultáneas
  select coalesce(max(sort_order), 0) into v_order from public.wells where project_id = v_project;

  with pts as (
    select f.name, (ST_Dump(f.geom)).geom as g, f.created_at, f.id
      from public.layer_features f
     where f.import_id = p_import and f.name is not null and geometrytype(f.geom) in ('POINT','MULTIPOINT')
  ), new_rows as (
    select p.name, p.g, row_number() over (order by p.created_at, p.id) as rn
      from pts p
     where not exists (select 1 from public.wells w where w.project_id = v_project and w.name = p.name)
  ), ins as (
    insert into public.wells(project_id, name, sort_order, geom)
    select v_project, name, v_order + rn, ST_SetSRID(g, 4326) from new_rows
    returning 1
  )
  select count(*) into v_n from ins;
  return v_n;
end $$;
grant execute on function public.create_wells_from_import(uuid) to authenticated;

-- ---------- Vistas GeoJSON para el mapa (respetan RLS) ----------
create or replace view public.layer_features_geojson with (security_invoker = true) as
select f.id, f.project_id, f.import_id, f.work_id, f.name,
       ST_AsGeoJSON(f.geom)::jsonb as geojson
from public.layer_features f where f.geom is not null;

create or replace view public.wells_geojson with (security_invoker = true) as
select w.id, w.project_id, w.name, ST_AsGeoJSON(w.geom)::jsonb as geojson
from public.wells w where w.geom is not null;
