-- =====================================================================
-- 0010_copiar_impactos_pga.sql  —  Copiar la matriz de otro proyecto; responsable y momento del PGA
-- =====================================================================

-- Copia (o pisa) los impactos de un proyecto en otro de la MISMA organización. SECURITY INVOKER: la RLS decide
-- qué puede leer y escribir la persona que llama. Devuelve cuántas celdas copió. importance/category las recalcula el trigger.
create or replace function public.copy_project_impacts(p_from uuid, p_to uuid)
returns int language plpgsql set search_path = public, extensions as $$
declare n int;
begin
  if p_from = p_to then raise exception 'el proyecto de origen y el de destino son el mismo'; end if;
  if not exists (select 1 from public.projects where id = p_from) then raise exception 'proyecto de origen inexistente o sin acceso'; end if;
  if not exists (select 1 from public.projects where id = p_to) then raise exception 'proyecto de destino inexistente o sin acceso'; end if;
  if (select org_id from public.projects where id = p_from) is distinct from (select org_id from public.projects where id = p_to) then
    raise exception 'los proyectos son de organizaciones distintas';
  end if;
  with ins as (
    insert into public.project_impacts(project_id, action_id, factor_id, sign, attrs, note)
    select p_to, action_id, factor_id, sign, attrs, note from public.project_impacts where project_id = p_from
    on conflict (project_id, action_id, factor_id) do update set sign = excluded.sign, attrs = excluded.attrs, note = excluded.note
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;
grant execute on function public.copy_project_impacts(uuid, uuid) to authenticated;

-- PGA (Sprint 8): el cuadro por etapa lleva responsable y momento por desplegable.
alter table public.project_measures
  add column if not exists responsible text,
  add column if not exists timing text;
