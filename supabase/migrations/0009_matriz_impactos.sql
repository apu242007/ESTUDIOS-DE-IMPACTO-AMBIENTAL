-- =====================================================================
-- 0009_matriz_impactos.sql  —  Lo que la matriz real (Excel Conesa ponderada) necesita y el esquema no tenía
-- =====================================================================

-- 1) Factores: peso UIP (unidades de importancia, suman 1000 en la matriz), componente (AIRE, SUELO…) y el
--    medio "perceptual" (paisaje), que el Excel separa del resto.
alter table public.catalog_impact_factors
  add column if not exists uip numeric check (uip is null or uip >= 0),
  add column if not exists component text;
alter table public.catalog_impact_factors drop constraint if exists catalog_impact_factors_medio_check;
alter table public.catalog_impact_factors
  add constraint catalog_impact_factors_medio_check
  check (medio in ('fisico','biotico','perceptual','socioeconomico','cultural'));

-- 2) Categorías: los positivos tienen su propia categoría ("Positivo(+)" en el Excel) en vez de heredar la de
--    los negativos por magnitud. Los rangos ya no se pisan dentro de cada grupo.
alter table public.catalog_impact_categories
  add column if not exists applies_to text not null default 'negativo' check (applies_to in ('negativo','positivo'));
alter table public.catalog_impact_categories drop constraint if exists catalog_impact_categories_org_id_numrange_excl;
alter table public.catalog_impact_categories
  add constraint catalog_impact_categories_range_excl
  exclude using gist (org_id with =, applies_to with =, numrange(min_abs, coalesce(max_abs, 1000000000), '[)') with &&);

-- 3) Importancia y categoría (misma fórmula de 0002; la categoría ahora depende del signo). I = 0 → sin categoría.
create or replace function public.calc_impact()
returns trigger language plpgsql set search_path = public, extensions as $$
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
  new.category := null;
  if new.importance <> 0 then
    select label into new.category from public.catalog_impact_categories
     where org_id = new.org_id
       and applies_to = case when new.importance < 0 then 'negativo' else 'positivo' end
       and abs(new.importance) >= min_abs and abs(new.importance) < coalesce(max_abs, 1000000000)
     order by min_abs limit 1;
  end if;
  return new;
end $$;

-- 4) Declaración de impacto: el texto sale de la plantilla (catalog_text_blocks scope='declaracion');
--    lo que el profesional edita se guarda acá como ajuste del proyecto (una fila por factor).
create table public.project_declarations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  factor_id uuid not null references public.catalog_impact_factors(id) on delete cascade,
  body_override text not null,
  updated_at timestamptz not null default now(),
  unique (project_id, factor_id)
);
alter table public.project_declarations
  add foreign key (project_id, org_id) references public.projects(id, org_id),
  add foreign key (factor_id, org_id) references public.catalog_impact_factors(id, org_id);
create trigger trg_project_declarations_org before insert or update of project_id on public.project_declarations
  for each row execute function public.set_org_from_project();
create trigger trg_project_declarations_upd before update on public.project_declarations
  for each row execute function public.touch_updated_at();
alter table public.project_declarations enable row level security;
create policy org_all on public.project_declarations for all
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
