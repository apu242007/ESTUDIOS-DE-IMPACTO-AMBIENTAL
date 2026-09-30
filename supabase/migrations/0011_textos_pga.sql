-- =====================================================================
-- 0011_textos_pga.sql  —  Biblioteca de textos (secciones, declaraciones) y columnas reales del PGA
-- =====================================================================

-- 1) PGA: la tabla real de medidas particulares trae etapa, acción, medida, recurso afectado, cronograma,
--    responsable y metodología de seguimiento. `program` = acción; `body` = medida.
alter table public.catalog_measures
  add column if not exists action text,
  add column if not exists resource text,
  add column if not exists timing text,
  add column if not exists responsible text,
  add column if not exists follow_up text,
  add column if not exists general boolean not null default false;   -- medida general: entra siempre al PGA

-- 2) Bloques de texto: además de interferencia/declaración/resumen, las secciones narrativas del informe.
alter table public.catalog_text_blocks drop constraint if exists catalog_text_blocks_scope_check;
alter table public.catalog_text_blocks
  add constraint catalog_text_blocks_scope_check check (scope in ('interferencia','declaracion','resumen','obra','seccion','otro'));
alter table public.catalog_text_blocks
  add column if not exists title text,
  add column if not exists sort_order int not null default 0;

-- 3) Nombre corto del proyecto ("PAD 58"): variable {pad} de las plantillas de texto.
alter table public.projects add column if not exists short_name text;

-- 4) Textos de sección editados por el profesional para ESTE proyecto (pisan al bloque del catálogo).
create table public.project_section_texts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (project_id, key)
);
alter table public.project_section_texts
  add foreign key (project_id, org_id) references public.projects(id, org_id);
create trigger trg_project_section_texts_org before insert or update of project_id on public.project_section_texts
  for each row execute function public.set_org_from_project();
create trigger trg_project_section_texts_upd before update on public.project_section_texts
  for each row execute function public.touch_updated_at();
alter table public.project_section_texts enable row level security;
create policy org_all on public.project_section_texts for all
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
