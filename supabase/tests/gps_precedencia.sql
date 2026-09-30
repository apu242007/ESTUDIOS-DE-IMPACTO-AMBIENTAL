-- Precedencia del GPS de mano sobre el teléfono (migración 0007). No deja datos: termina en excepción GPS_RESULT.
-- Requiere rol con acceso a las tablas (SQL Editor / MCP como postgres). Cada línea debe decir OK.
do $$
declare o uuid; c uuid; p uuid; l uuid := gen_random_uuid(); w uuid := gen_random_uuid();
  g geometry; s text; e numeric; m boolean; res text := '';
begin
  insert into organizations(name) values ('t') returning id into o;
  insert into clients(org_id, name) values (o,'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o,c,'p') returning id into p;
  insert into survey_lines(id, project_id) values (l, p);
  insert into waypoints(id, project_id, line_id, number, source) values (w, p, l, 4, 'manual');
  update waypoints set geom = ST_SetSRID(ST_MakePoint(-68.568602,-38.129939),4326), elevation_m = 138, source='gps', matched=true where id = w;
  update waypoints set geom = null, elevation_m = null, source = 'manual', matched = false, description = 'editado en campo' where id = w;
  select geom, source, elevation_m, matched into g, s, e, m from waypoints where id = w;
  res := res || format(E'%s  el GPS no se pisa
', case when s='gps' and e=138 and m and g is not null then 'OK ' else 'FALLA' end);
  res := res || format(E'%s  la edición de otros campos sí se guarda
', case when (select description from waypoints where id=w) = 'editado en campo' then 'OK ' else 'FALLA' end);
  update waypoints set geom = ST_SetSRID(ST_MakePoint(-68.5,-38.1),4326), source='gps' where id = w;
  res := res || format(E'%s  el worker sí puede actualizar la posición GPS
', case when (select round(ST_X(geom)::numeric,1) from waypoints where id=w) = -68.5 then 'OK ' else 'FALLA' end);
  raise exception E'GPS_RESULT:
%', res;
end $$;
