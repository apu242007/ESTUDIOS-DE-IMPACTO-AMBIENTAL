-- =====================================================================
-- 0007_gps_precedencia.sql  —  La posición del GPS de mano manda sobre la del teléfono
-- =====================================================================
-- El celular sincroniza waypoints desde su copia local (que puede no tener coordenadas o tener las del
-- teléfono). Si el waypoint ya fue cruzado con el GPS (.gdb), una edición posterior desde el celular
-- NO debe pisar geom / cota / origen. El worker (source='gps') sí puede reemplazarlas.
create or replace function public.keep_gps_position()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if old.source = 'gps' and new.source is distinct from 'gps' then
    new.geom := old.geom;
    new.elevation_m := old.elevation_m;
    new.source := old.source;
    new.gps_point_id := old.gps_point_id;
    new.matched := old.matched;
  end if;
  return new;
end $$;

create trigger trg_waypoints_keep_gps before update on public.waypoints
  for each row execute function public.keep_gps_position();
