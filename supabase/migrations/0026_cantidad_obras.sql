-- 0026: cantidad por obra. El alcance declara "2 líneas de control 3" de 2.300 m" (por línea) y la capa trae las dos
-- (4.597 m): la comparación daba +99,9 %. works.quantity (por defecto 1) multiplica lo declarado en works_compare,
-- que alimenta Comparación, el tablero, Control y la tabla del informe. declared_unit_* conserva el valor por unidad.
-- Prueba: supabase/tests/cantidad_obras.sql.

alter table public.works add column quantity int not null default 1 check (quantity >= 1);

create or replace view public.works_compare with (security_invoker = true) as
select
  w.id, w.org_id, w.project_id, w.kind, w.name, w.code, w.stage, w.sort_order,
  w.declared_length_m * w.quantity as declared_length_m,
  w.declared_area_m2 * w.quantity as declared_area_m2,
  w.diameter_in, w.material, w.description, w.attrs, w.geom, w.geom_length_m, w.geom_area_m2, w.created_at,
  case when w.declared_length_m > 0 and w.geom_length_m is not null
       then round(w.geom_length_m - w.declared_length_m * w.quantity, 1) end as diff_length_m,
  case when w.declared_length_m > 0 and w.geom_length_m is not null
       then round(100 * (w.geom_length_m - w.declared_length_m * w.quantity) / (w.declared_length_m * w.quantity), 2) end as diff_length_pct,
  case when w.declared_area_m2 > 0 and w.geom_area_m2 is not null
       then round(w.geom_area_m2 - w.declared_area_m2 * w.quantity, 0) end as diff_area_m2,
  case when w.declared_area_m2 > 0 and w.geom_area_m2 is not null
       then round(100 * (w.geom_area_m2 - w.declared_area_m2 * w.quantity) / (w.declared_area_m2 * w.quantity), 2) end as diff_area_pct,
  w.quantity,
  w.declared_length_m as declared_unit_length_m,
  w.declared_area_m2 as declared_unit_area_m2
from public.works w;
