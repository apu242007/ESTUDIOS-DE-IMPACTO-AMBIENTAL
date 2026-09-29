-- =====================================================================
-- 0004_hardening_rls.sql  —  Correcciones de revisión (RLS, integridad, transacciones)
-- =====================================================================

-- ---------- 1) Cada usuario solo lee SUS membresías (el listado de terceros va por list_members, solo admin) ----------
drop policy if exists mem_select on public.memberships;
create policy mem_select on public.memberships for select using (user_id = auth.uid());

create or replace function public.list_members(p_org uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org and public.is_org_admin(p_org)
$$;
revoke all on function public.list_members(uuid) from public, anon;
grant execute on function public.list_members(uuid) to authenticated;

-- ---------- 2) Catálogos de la organización: leen miembros, escriben solo admins ----------
do $$
declare t text;
begin
  foreach t in array array['catalog_codes','catalog_photo_categories'] loop
    execute format('drop policy if exists org_all on public.%I', t);
    execute format(
      'create policy cat_read on public.%I for select
         using (org_id in (select public.auth_org_ids()))', t);
    execute format(
      'create policy cat_write on public.%I for all
         using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id))', t);
  end loop;
end $$;

-- ---------- 3) Tablas nuevas: org_id derivado del proyecto también al cambiar project_id, y FK compuesta ----------
alter table public.projects add unique (id, org_id);
do $$
declare t text;
begin
  foreach t in array array['project_impacts','project_measures','project_environment','figure_builds','project_reviews'] loop
    execute format('drop trigger if exists trg_%I_org on public.%I', t, t);
    execute format(
      'create trigger trg_%I_org before insert or update of project_id on public.%I
         for each row execute function public.set_org_from_project()', t, t);
    execute format(
      'alter table public.%I add foreign key (project_id, org_id) references public.projects(id, org_id)', t);
  end loop;
end $$;

-- ---------- 4) Relaciones secundarias: el padre debe pertenecer al MISMO proyecto ----------
create or replace function public.guard_parent_project()
returns trigger language plpgsql as $$
declare v uuid; found boolean;
begin
  v := (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v is null then return new; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and project_id = $2)', tg_argv[0])
    into found using v, new.project_id;
  if not found then
    raise exception 'la referencia % apunta a otro proyecto', tg_argv[1];
  end if;
  return new;
end $$;

create trigger trg_zz_ref_import before insert or update of import_id, project_id on public.layer_features
  for each row execute function public.guard_parent_project('layer_imports', 'import_id');
create trigger trg_zz_ref_work before insert or update of work_id, project_id on public.layer_features
  for each row execute function public.guard_parent_project('works', 'work_id');
create trigger trg_zz_ref_work before insert or update of work_id, project_id on public.survey_lines
  for each row execute function public.guard_parent_project('works', 'work_id');
create trigger trg_zz_ref_line before insert or update of line_id, project_id on public.waypoints
  for each row execute function public.guard_parent_project('survey_lines', 'line_id');
create trigger trg_zz_ref_line before insert or update of line_id, project_id on public.photos
  for each row execute function public.guard_parent_project('survey_lines', 'line_id');
create trigger trg_zz_ref_wp before insert or update of waypoint_id, project_id on public.photos
  for each row execute function public.guard_parent_project('waypoints', 'waypoint_id');
create trigger trg_zz_ref_import before insert or update of import_id, project_id on public.gps_points
  for each row execute function public.guard_parent_project('gps_imports', 'import_id');

-- ---------- 5) JSON con forma esperada ----------
alter table public.clients  add check (jsonb_typeof(contact) = 'object');
alter table public.projects add check (
  jsonb_typeof(applicant) = 'object' and jsonb_typeof(consultant) = 'object'
  and jsonb_typeof(thresholds) = 'object'
  and (thresholds ->> 'pct') ~ '^[0-9.]+$' and (thresholds ->> 'abs_m') ~ '^[0-9.]+$');

-- ---------- 6) Duplicar proyecto en UNA transacción (security invoker: aplica RLS) ----------
create or replace function public.duplicate_project(p_src uuid)
returns uuid language plpgsql as $$
declare v_new uuid;
begin
  insert into public.projects(org_id, client_id, name, code, doc_type, field_area, province, applicant,
                              consultant, crs_epsg, thresholds, zone_key, status)
  select org_id, client_id, name || ' (copia)', code, doc_type, field_area, province, applicant,
         consultant, crs_epsg, thresholds, zone_key, 'borrador'
  from public.projects where id = p_src
  returning id into v_new;
  if v_new is null then raise exception 'proyecto inexistente o sin permisos'; end if;

  insert into public.works(project_id, kind, name, code, stage, sort_order, declared_length_m,
                           declared_area_m2, diameter_in, material, description, attrs, geom)
  select v_new, kind, name, code, stage, sort_order, declared_length_m,
         declared_area_m2, diameter_in, material, description, attrs, geom
  from public.works where project_id = p_src;
  return v_new;
end $$;
grant execute on function public.duplicate_project(uuid) to authenticated;
