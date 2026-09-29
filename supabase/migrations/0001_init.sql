-- =====================================================================
-- 0001_init.sql  —  Esquema MVP app de informes ambientales
-- =====================================================================
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------- Organizaciones y membresías ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'miembro' check (role in ('admin','miembro')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create or replace function public.auth_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.memberships where user_id = auth.uid()
$$;

create or replace function public.is_org_admin(o uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where user_id = auth.uid() and org_id = o and role = 'admin')
$$;

-- ---------- Tablas de negocio ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  cuit text,
  address text,
  contact jsonb not null default '{}'::jsonb,
  logo_path text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  code text,                                   -- ej. 2947-26
  doc_type text not null default 'IA' check (doc_type in ('IA','MTD','IA+MTD')),
  field_area text,                             -- yacimiento/área
  province text not null default 'Neuquén',
  status text not null default 'borrador'
    check (status in ('borrador','revision','entregado','cerrado')),
  applicant jsonb not null default '{}'::jsonb,   -- empresa solicitante
  consultant jsonb not null default '{}'::jsonb,  -- consultora + responsable técnico
  crs_epsg int not null default 22182,
  thresholds jsonb not null default '{"pct":1,"abs_m":5}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.projects(org_id);

create table public.cadastre_data (           -- SENSIBLE: solo admin
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  nomenclature text,
  lot text,
  owners text,
  created_at timestamptz not null default now()
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in (
    'locacion','camino','ducto','acueducto_temporal','linea_electrica',
    'fibra_optica','predio','apendice','instalacion_aux','pozo_area')),
  name text not null,
  code text,
  stage text check (stage in ('construccion','perforacion','complementarias','operacion','abandono')),
  sort_order int not null default 0,
  declared_length_m numeric,
  declared_area_m2 numeric,
  diameter_in numeric,
  material text,
  description text,
  attrs jsonb not null default '{}'::jsonb,
  geom geometry(Geometry,4326),
  geom_length_m numeric,                       -- calculado por trigger
  geom_area_m2 numeric,                        -- calculado por trigger
  created_at timestamptz not null default now()
);
create index on public.works(project_id);
create index works_geom_gix on public.works using gist(geom);

create table public.wells (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  attrs jsonb not null default '{}'::jsonb,
  geom geometry(Point,4326),
  created_at timestamptz not null default now()
);
create index on public.wells(project_id);

create table public.layer_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  base_name text not null,
  format text not null check (format in ('shp','kmz','kml','gpx')),
  files jsonb not null default '[]'::jsonb,     -- [{path,ext,size}]
  missing text[] not null default '{}',
  status text not null default 'pendiente'
    check (status in ('pendiente','requiere_crs','procesando','listo','incompleto','error')),
  crs_detected text,
  crs_confirmed_epsg int,
  n_features int,
  error text,
  created_at timestamptz not null default now()
);
create index on public.layer_imports(project_id, status);

create table public.layer_features (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  import_id uuid not null references public.layer_imports(id) on delete cascade,
  name text,
  props jsonb not null default '{}'::jsonb,
  geom geometry(Geometry,4326),
  elevation_m numeric,
  length_m numeric,
  area_m2 numeric,
  work_id uuid references public.works(id) on delete set null,
  created_at timestamptz not null default now()
);
create index layer_features_gix on public.layer_features using gist(geom);
create index on public.layer_features(import_id);

create table public.survey_lines (
  id uuid primary key,                          -- lo genera el cliente (offline)
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_id uuid references public.works(id) on delete set null,
  kind text,                                    -- Tipo (ducto, acueducto, camino…)
  start_label text,
  end_label text,
  ficha_no int,
  job_no text,
  survey_date date,
  company text,
  dominant text,
  cover text,
  companions text,
  notes text,
  closed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.survey_lines(project_id);

create table public.catalog_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  meaning text not null,
  sort_order int not null default 0,
  unique (org_id, code)
);

create table public.catalog_photo_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,                          -- título en el anexo
  sort_order int not null default 0,
  unique (org_id, key)
);

create table public.waypoints (
  id uuid primary key,                          -- lo genera el cliente (offline)
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  line_id uuid not null references public.survey_lines(id) on delete cascade,
  number int,                                   -- N° de waypoint del GPS (004, 005…)
  code text,                                    -- sigla (CR, Q, CP…)
  description text,
  views text,                                   -- direcciones de fotos ej. "O-SO"
  geom geometry(Point,4326),
  elevation_m numeric,
  source text not null default 'manual' check (source in ('gps','telefono','manual')),
  gps_point_id uuid,
  matched boolean not null default false,
  chainage_m numeric,                           -- progresiva (orden en la traza)
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.waypoints(project_id, number);
create index on public.waypoints(line_id);
create index waypoints_gix on public.waypoints using gist(geom);

create table public.photos (
  id uuid primary key,                          -- lo genera el cliente (offline)
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  line_id uuid references public.survey_lines(id) on delete set null,
  waypoint_id uuid references public.waypoints(id) on delete set null,
  category text not null,
  path_original text,
  path_reduced text,
  caption text,
  heading text,
  taken_at timestamptz,
  geom geometry(Point,4326),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.photos(project_id, category);

create table public.gps_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  file_kind text not null default 'gdb' check (file_kind in ('gdb','gpx','kml','kmz')),
  status text not null default 'pendiente'
    check (status in ('pendiente','procesando','listo','error')),
  n_points int,
  n_matched int,
  n_unmatched int,
  report jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.gps_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  import_id uuid not null references public.gps_imports(id) on delete cascade,
  name text,
  number int,                                   -- dígitos extraídos del nombre
  geom geometry(Point,4326),
  elevation_m numeric,
  recorded_at timestamptz
);
create index on public.gps_points(project_id, number);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  doc_type text not null check (doc_type in ('IA','MTD','ANEXOS')),
  name text not null,
  version int not null default 1,
  file_path text not null,                      -- .docx en Storage
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.document_builds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid not null references public.document_templates(id),
  version_num int not null,
  params jsonb not null default '{}'::jsonb,    -- {photo_max_px, jpeg_quality, ...}
  status text not null default 'pendiente'
    check (status in ('pendiente','procesando','listo','error')),
  docx_path text,
  pdf_path text,
  log text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (project_id, version_num)
);

-- ---------- Triggers ----------
-- org_id siempre proviene del proyecto (evita manipulación desde el cliente)
create or replace function public.set_org_from_project()
returns trigger language plpgsql as $$
begin
  select org_id into new.org_id from public.projects where id = new.project_id;
  if new.org_id is null then raise exception 'proyecto inexistente'; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'cadastre_data','works','wells','layer_imports','layer_features','survey_lines',
    'waypoints','photos','gps_imports','gps_points','document_builds'
  ] loop
    execute format(
      'create trigger trg_%I_org before insert on public.%I
         for each row execute function public.set_org_from_project()', t, t);
  end loop;
end $$;

-- medidas calculadas en EPSG:22182 (POSGAR faja 2)
create or replace function public.works_measures()
returns trigger language plpgsql as $$
begin
  new.geom_length_m := null; new.geom_area_m2 := null;
  if new.geom is not null then
    if geometrytype(new.geom) in ('LINESTRING','MULTILINESTRING') then
      new.geom_length_m := round(ST_Length(ST_Transform(new.geom, 22182))::numeric, 1);
    elsif geometrytype(new.geom) in ('POLYGON','MULTIPOLYGON') then
      new.geom_area_m2 := round(ST_Area(ST_Transform(new.geom, 22182))::numeric, 0);
    end if;
  end if;
  return new;
end $$;
create trigger trg_works_measures before insert or update of geom on public.works
  for each row execute function public.works_measures();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_lines_upd before update on public.survey_lines
  for each row execute function public.touch_updated_at();
create trigger trg_wp_upd before update on public.waypoints
  for each row execute function public.touch_updated_at();

-- ---------- Vistas (respetan RLS) ----------
create or replace view public.works_compare with (security_invoker = true) as
select w.*,
  case when w.declared_length_m > 0 and w.geom_length_m is not null
       then round(w.geom_length_m - w.declared_length_m, 1) end as diff_length_m,
  case when w.declared_length_m > 0 and w.geom_length_m is not null
       then round(100 * (w.geom_length_m - w.declared_length_m) / w.declared_length_m, 2) end as diff_length_pct,
  case when w.declared_area_m2 > 0 and w.geom_area_m2 is not null
       then round(w.geom_area_m2 - w.declared_area_m2, 0) end as diff_area_m2,
  case when w.declared_area_m2 > 0 and w.geom_area_m2 is not null
       then round(100 * (w.geom_area_m2 - w.declared_area_m2) / w.declared_area_m2, 2) end as diff_area_pct
from public.works w;

-- Convención argentina: X = NORTE, Y = ESTE (POSGAR faja 2, EPSG:22182)
create or replace view public.waypoints_view with (security_invoker = true) as
select wp.*,
  ST_Y(wp.geom)                                   as lat,
  ST_X(wp.geom)                                   as lon,
  ST_Y(ST_Transform(wp.geom, 22182))              as gk_x_norte,
  ST_X(ST_Transform(wp.geom, 22182))              as gk_y_este
from public.waypoints wp;

-- ---------- Semillas por organización ----------
create or replace function public.seed_org_defaults(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into catalog_codes(org_id, code, meaning, sort_order) values
    (p_org,'CR','Cruce',1),(p_org,'CC','Cauce',2),(p_org,'Q','Quiebre',3),
    (p_org,'CA','Camino acceso',4),(p_org,'CP','Camino principal',5),
    (p_org,'CS','Camino secundario',6),(p_org,'P','Picada',7),
    (p_org,'PR','Picada revegetada',8),(p_org,'D','Ducto',9),(p_org,'G','Gasoducto',10),
    (p_org,'O','Oleoducto',11),(p_org,'A','Acueducto',12),(p_org,'L','Locación',13),
    (p_org,'LE','Línea eléctrica',14),(p_org,'RT','Resalto topográfico',15),
    (p_org,'C','Cárcavas',16),(p_org,'CaC','Caño camisa',17),(p_org,'CaA','Caño aéreo',18),
    (p_org,'SaN','Soterrado a nivel',19),(p_org,'SO','Sin obra',20),(p_org,'RM','Rampa metálica',21)
  on conflict do nothing;
  insert into catalog_photo_categories(org_id, key, label, sort_order) values
    (p_org,'locacion','Locación',1),(p_org,'pozos','Pozos',2),
    (p_org,'camino_troncal','Camino troncal',3),
    (p_org,'camino_ingreso_perforacion','Camino de ingreso perforación',4),
    (p_org,'camino_ingreso_fractura','Camino de ingreso fractura',5),
    (p_org,'camino_egreso_fractura','Camino de egreso fractura',6),
    (p_org,'camino_ingreso_secundario','Camino de ingreso secundario',7),
    (p_org,'lmt','Línea eléctrica de media tensión',8),
    (p_org,'apendice_agua','Apéndice para acopio de agua de producción',9),
    (p_org,'predio_tls','Predio TLS',10),(p_org,'predio_interconexion','Predio de interconexión de ductos',11),
    (p_org,'ductos','Ductos',12),(p_org,'acueductos_flexibles','Acueductos flexibles',13),
    (p_org,'transecta_1','Transecta 1',14),(p_org,'transecta_2','Transecta 2',15),
    (p_org,'otro','Otros',99)
  on conflict do nothing;
end $$;

create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  insert into organizations(name) values (p_name) returning id into v;
  insert into memberships(user_id, org_id, role) values (auth.uid(), v, 'admin');
  perform seed_org_defaults(v);
  return v;
end $$;

-- ---------- Cola de trabajos para el worker (solo service_role) ----------
create or replace function public.claim_job(p_table text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_table not in ('layer_imports','gps_imports','document_builds') then
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

-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;

create policy org_select on public.organizations for select
  using (id in (select public.auth_org_ids()));
create policy org_update on public.organizations for update
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy mem_select on public.memberships for select
  using (org_id in (select public.auth_org_ids()));
create policy mem_admin_ins on public.memberships for insert
  with check (public.is_org_admin(org_id));
create policy mem_admin_upd on public.memberships for update
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy mem_admin_del on public.memberships for delete
  using (public.is_org_admin(org_id));

do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','works','wells','layer_imports','layer_features',
    'survey_lines','catalog_codes','catalog_photo_categories','waypoints','photos',
    'gps_imports','gps_points','document_templates','document_builds'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy org_all on public.%I for all
         using (org_id in (select public.auth_org_ids()))
         with check (org_id in (select public.auth_org_ids()))', t);
  end loop;
end $$;

alter table public.cadastre_data enable row level security;
create policy cad_admin on public.cadastre_data for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------- Storage ----------
insert into storage.buckets (id, name, public)
values ('project-files','project-files', false)
on conflict (id) do nothing;

-- ruta: {org_id}/{project_id}/{tipo}/{archivo}
create policy storage_org_select on storage.objects for select to authenticated
  using (bucket_id = 'project-files'
         and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid()));
create policy storage_org_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files'
         and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid()));
create policy storage_org_update on storage.objects for update to authenticated
  using (bucket_id = 'project-files'
         and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid()));
create policy storage_org_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files'
         and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid()));
