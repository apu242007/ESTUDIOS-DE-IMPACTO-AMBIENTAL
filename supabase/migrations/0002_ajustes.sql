-- =====================================================================
-- 0002_ajustes.sql  —  Endurecimiento + dominio técnico (sprints 7-10)
-- =====================================================================

-- ---------- 1) Proyecto: zona ambiental ----------
alter table public.projects add column if not exists zone_key text;  -- ej. 'neuquen_anelo' (catálogo de ambiente)

-- ---------- 2) Medidas de obras con el CRS del proyecto (antes estaba fijo en 22182) ----------
create or replace function public.works_measures()
returns trigger language plpgsql as $$
declare v_epsg int;
begin
  new.geom_length_m := null; new.geom_area_m2 := null;
  if new.geom is not null then
    select crs_epsg into v_epsg from public.projects where id = new.project_id;
    v_epsg := coalesce(v_epsg, 22182);
    if geometrytype(new.geom) in ('LINESTRING','MULTILINESTRING') then
      new.geom_length_m := round(ST_Length(ST_Transform(new.geom, v_epsg))::numeric, 1);
    elsif geometrytype(new.geom) in ('POLYGON','MULTIPOLYGON') then
      new.geom_area_m2 := round(ST_Area(ST_Transform(new.geom, v_epsg))::numeric, 0);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_works_measures on public.works;
create trigger trg_works_measures before insert or update of geom, project_id on public.works
  for each row execute function public.works_measures();
update public.works set geom = geom where geom is not null;   -- backfill con el CRS del proyecto

create or replace function public.recalc_works_on_crs()
returns trigger language plpgsql as $$
begin
  update public.works set geom = geom where project_id = new.id and geom is not null;
  return new;
end $$;
create trigger trg_projects_crs after update of crs_epsg on public.projects
  for each row when (old.crs_epsg is distinct from new.crs_epsg)
  execute function public.recalc_works_on_crs();

-- ---------- 3) Referencias entre organizaciones ----------
-- Se llama trg_zz_* para que dispare DESPUÉS de trg_*_org (orden alfabético).
create or replace function public.guard_same_org()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'projects' then
    if not exists (select 1 from public.clients where id = new.client_id and org_id = new.org_id) then
      raise exception 'el cliente pertenece a otra organización';
    end if;
  elsif tg_table_name = 'document_builds' then
    if not exists (select 1 from public.document_templates where id = new.template_id and org_id = new.org_id) then
      raise exception 'la plantilla pertenece a otra organización';
    end if;
  end if;
  return new;
end $$;
create trigger trg_zz_projects_guard before insert or update of client_id, org_id on public.projects
  for each row execute function public.guard_same_org();
create trigger trg_zz_builds_guard before insert or update of template_id, project_id, org_id on public.document_builds
  for each row execute function public.guard_same_org();

-- org_id siempre derivado del proyecto, tambien al cambiar project_id (en 0001 solo disparaba en INSERT)
do $$
declare t text;
begin
  foreach t in array array[
    'cadastre_data','works','wells','layer_imports','layer_features','survey_lines',
    'waypoints','photos','gps_imports','gps_points','document_builds'
  ] loop
    execute format('drop trigger if exists trg_%I_org on public.%I', t, t);
    execute format(
      'create trigger trg_%I_org before insert or update of project_id on public.%I
         for each row execute function public.set_org_from_project()', t, t);
  end loop;
end $$;

-- ---------- 4) Altas de personas sin service role en el front ----------
-- El usuario se registra solo; el admin lo agrega por email.
create or replace function public.add_member_by_email(p_org uuid, p_email text, p_role text default 'miembro')
returns void language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_org_admin(p_org) then raise exception 'solo admin'; end if;
  if p_role not in ('admin','miembro') then raise exception 'rol inválido'; end if;
  select id into v from auth.users where lower(email) = lower(p_email);
  if v is null then raise exception 'el usuario debe registrarse primero'; end if;
  insert into public.memberships(user_id, org_id, role) values (v, p_org, p_role)
  on conflict (user_id, org_id) do update set role = excluded.role;
end $$;
revoke all on function public.add_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.add_member_by_email(uuid, text, text) to authenticated;

-- seed_org_defaults es SECURITY DEFINER y tenia EXECUTE para PUBLIC: cualquiera podia sembrar catalogos en otra org.
-- create_organization (definer, mismo dueño) sigue pudiendo llamarla.
revoke all on function public.seed_org_defaults(uuid) from public, anon, authenticated;

-- ---------- 5) Versión de documento sin carreras (security invoker: aplica RLS) ----------
create or replace function public.create_document_build(p_project uuid, p_template uuid, p_params jsonb default '{}'::jsonb)
returns uuid language plpgsql as $$
declare v_id uuid; v_n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_project::text));
  select coalesce(max(version_num), 0) + 1 into v_n from public.document_builds where project_id = p_project;
  insert into public.document_builds(project_id, template_id, version_num, params)
  values (p_project, p_template, v_n, p_params) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_document_build(uuid, uuid, jsonb) to authenticated;

-- ---------- 6) Storage: tamaño y lista blanca de extensiones (A.10) ----------
update storage.buckets set file_size_limit = 209715200 where id = 'project-files';  -- 200 MB
drop policy if exists storage_org_insert on storage.objects;
create policy storage_org_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files'
    and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid())
    and lower(storage.extension(name)) in
      ('shp','dbf','shx','prj','cpg','qix','qmd','kmz','kml','gpx','gdb','jpg','jpeg','png','docx','zip'));
-- Los archivos que genera el worker (pdf, png de figuras) los sube con service role, que no pasa por esta política.

-- ---------- 7) Catálogos técnicos por organización (se siembran por script desde los documentos reales) ----------
create table public.catalog_impact_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null, name text not null,
  stage text check (stage in ('construccion','perforacion','complementarias','operacion','abandono')),
  sort_order int not null default 0,
  unique (org_id, code)
);
create table public.catalog_impact_factors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null, name text not null,
  medio text not null check (medio in ('fisico','biotico','socioeconomico','cultural')),
  sort_order int not null default 0,
  unique (org_id, code)
);
-- Opciones de cada atributo de la fórmula (desplegables). Los valores salen de la matriz real, no se inventan.
create table public.catalog_impact_attrs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  attr text not null check (attr in ('IN','EX','MO','PE','RV','SI','AC','EF','PR','MC')),
  label text not null, value numeric not null,
  sort_order int not null default 0,
  unique (org_id, attr, label)
);
-- Rangos de |I| → categoría (irrelevante, moderado, severo, crítico…). max_abs null = sin tope.
create table public.catalog_impact_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null, min_abs numeric not null, max_abs numeric,
  sort_order int not null default 0,
  unique (org_id, label)
);
create table public.catalog_measures (            -- biblioteca del PGA
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  program text not null, name text not null, body text not null,
  stage text check (stage in ('construccion','perforacion','complementarias','operacion','abandono')),
  sort_order int not null default 0
);
create table public.catalog_measure_factors (     -- qué medida atiende qué factor (para sugerir de forma determinista)
  org_id uuid not null references public.organizations(id) on delete cascade,
  measure_id uuid not null references public.catalog_measures(id) on delete cascade,
  factor_id uuid not null references public.catalog_impact_factors(id) on delete cascade,
  primary key (measure_id, factor_id)
);
create table public.catalog_environment (         -- descripción del ambiente por zona
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  zone_key text not null, section text not null, label text not null, body text not null,
  sort_order int not null default 0
);
create table public.catalog_text_blocks (         -- redacción por plantilla con variables {var}; sin IA
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  scope text not null check (scope in ('interferencia','declaracion','resumen','obra','otro')),
  template text not null,
  unique (org_id, key)
);

-- ---------- 8) Selecciones por proyecto ----------
create table public.project_impacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.catalog_impact_actions(id),
  factor_id uuid not null references public.catalog_impact_factors(id),
  sign smallint not null check (sign in (-1, 1)),
  attrs jsonb not null default '{}'::jsonb,       -- {"IN":4,"EX":2,...} valores elegidos en los desplegables
  importance numeric,                             -- calculado por trigger
  category text,                                  -- calculado por trigger
  note text,
  unique (project_id, action_id, factor_id)
);
create table public.project_measures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  measure_id uuid not null references public.catalog_measures(id),
  selected boolean not null default true,
  note text,
  unique (project_id, measure_id)
);
create table public.project_environment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid not null references public.catalog_environment(id),
  included boolean not null default true,
  body_override text,                             -- ajuste puntual del profesional
  unique (project_id, item_id)
);
create table public.figure_builds (               -- cola del worker (mapas/figuras)
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('ubicacion','implantacion','interferencias','otra')),
  params jsonb not null default '{}'::jsonb,      -- {base:'satelite'|'osm', escala, leyenda, ...}
  status text not null default 'pendiente'
    check (status in ('pendiente','procesando','listo','error')),
  file_path text, error text,
  created_at timestamptz not null default now()
);
create table public.project_reviews (             -- visado INTERNO de la consultora
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  build_id uuid not null references public.document_builds(id) on delete cascade,
  reviewer uuid default auth.uid(),
  decision text not null check (decision in ('aprobado','observado')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- 8b) Integridad entre organizaciones y rangos ----------
-- Las FK no pasan por RLS: se atan tambien por org_id / project_id.
alter table public.catalog_impact_actions add unique (id, org_id);
alter table public.catalog_impact_factors add unique (id, org_id);
alter table public.catalog_measures       add unique (id, org_id);
alter table public.catalog_environment    add unique (id, org_id);
alter table public.document_builds        add unique (id, project_id);

alter table public.catalog_measure_factors
  add foreign key (measure_id, org_id) references public.catalog_measures(id, org_id),
  add foreign key (factor_id,  org_id) references public.catalog_impact_factors(id, org_id);
alter table public.project_impacts
  add foreign key (action_id, org_id) references public.catalog_impact_actions(id, org_id),
  add foreign key (factor_id, org_id) references public.catalog_impact_factors(id, org_id);
alter table public.project_measures
  add foreign key (measure_id, org_id) references public.catalog_measures(id, org_id);
alter table public.project_environment
  add foreign key (item_id, org_id) references public.catalog_environment(id, org_id);
alter table public.project_reviews
  add foreign key (build_id, project_id) references public.document_builds(id, project_id);

-- Rangos de categoria: sin solapamientos ni limites invertidos (los huecos se detectan en la lista de chequeo).
create extension if not exists btree_gist;
alter table public.catalog_impact_categories
  add check (max_abs is null or max_abs > min_abs),
  add exclude using gist (org_id with =, numrange(min_abs, coalesce(max_abs, 1000000000), '[)') with &&);

-- ---------- 9) Triggers ----------
do $$
declare t text;
begin
  foreach t in array array['project_impacts','project_measures','project_environment','figure_builds','project_reviews'] loop
    execute format(
      'create trigger trg_%I_org before insert on public.%I
         for each row execute function public.set_org_from_project()', t, t);
  end loop;
end $$;

-- Importancia I = ±(3·IN + 2·EX + MO + PE + RV + SI + AC + EF + PR + MC) y categoria por rango.
-- Valida attrs contra el catalogo y SIEMPRE recalcula (nadie puede escribir importance/category a mano).
create or replace function public.calc_impact()
returns trigger language plpgsql as $$
declare s numeric; k text; v jsonb;
begin
  if jsonb_typeof(new.attrs) <> 'object' then raise exception 'attrs debe ser un objeto'; end if;
  for k, v in select * from jsonb_each(new.attrs) loop
    if k not in ('IN','EX','MO','PE','RV','SI','AC','EF','PR','MC') then
      raise exception 'atributo invalido: %', k;
    end if;
    if jsonb_typeof(v) <> 'number' or not exists (
         select 1 from public.catalog_impact_attrs
          where org_id = new.org_id and attr = k and value = (v #>> '{}')::numeric) then
      raise exception 'valor fuera de catalogo para %', k;
    end if;
  end loop;
  s := 3 * coalesce((new.attrs->>'IN')::numeric, 0) + 2 * coalesce((new.attrs->>'EX')::numeric, 0)
     + coalesce((new.attrs->>'MO')::numeric, 0) + coalesce((new.attrs->>'PE')::numeric, 0)
     + coalesce((new.attrs->>'RV')::numeric, 0) + coalesce((new.attrs->>'SI')::numeric, 0)
     + coalesce((new.attrs->>'AC')::numeric, 0) + coalesce((new.attrs->>'EF')::numeric, 0)
     + coalesce((new.attrs->>'PR')::numeric, 0) + coalesce((new.attrs->>'MC')::numeric, 0);
  new.importance := new.sign * s;
  select label into new.category from public.catalog_impact_categories
   where org_id = new.org_id and abs(new.importance) >= min_abs and abs(new.importance) < coalesce(max_abs, 1000000000)
   order by min_abs limit 1;
  return new;
end $$;
create trigger trg_zz_impact_calc before insert or update on public.project_impacts
  for each row execute function public.calc_impact();

-- Solo el worker cambia el estado de los trabajos. El usuario: altas en pendiente/incompleto/requiere_crs
-- y reencolar ('pendiente') unicamente desde estados terminales (nunca desde 'procesando').
create or replace function public.guard_job_status()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('pendiente','incompleto','requiere_crs') then
      raise exception 'estado inicial invalido';
    end if;
  elsif new.status is distinct from old.status then
    if not (new.status = 'pendiente' and old.status in ('requiere_crs','incompleto','error','listo')) then
      raise exception 'solo el worker cambia el estado del trabajo';
    end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['layer_imports','gps_imports','document_builds','figure_builds'] loop
    execute format(
      'create trigger trg_%I_status before insert or update on public.%I
         for each row execute function public.guard_job_status()', t, t);
  end loop;
end $$;

-- Cola del worker: se agrega figure_builds
create or replace function public.claim_job(p_table text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_table not in ('layer_imports','gps_imports','document_builds','figure_builds') then
    raise exception 'tabla inválida';
  end if;
  execute format(
    $f$update public.%1$I set status = 'procesando'
       where id = (select id from public.%1$I where status = 'pendiente'
                   order by created_at for update skip locked limit 1)
       returning to_jsonb(%1$I.*)$f$, p_table) into r;
  return r;
end $$;
revoke all on function public.claim_job(text) from public, anon, authenticated;
grant execute on function public.claim_job(text) to service_role;

-- ---------- 10) RLS ----------
-- Catálogos: leen los miembros, escriben solo admins.
do $$
declare t text;
begin
  foreach t in array array[
    'catalog_impact_actions','catalog_impact_factors','catalog_impact_attrs','catalog_impact_categories',
    'catalog_measures','catalog_measure_factors','catalog_environment','catalog_text_blocks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy cat_read on public.%I for select
         using (org_id in (select public.auth_org_ids()))', t);
    execute format(
      'create policy cat_write on public.%I for all
         using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id))', t);
  end loop;
end $$;

-- Datos del proyecto: cualquier miembro de la organización.
do $$
declare t text;
begin
  foreach t in array array['project_impacts','project_measures','project_environment','figure_builds','project_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy org_all on public.%I for all
         using (org_id in (select public.auth_org_ids()))
         with check (org_id in (select public.auth_org_ids()))', t);
  end loop;
end $$;
