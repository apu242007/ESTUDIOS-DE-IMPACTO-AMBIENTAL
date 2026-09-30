-- nearby_features (migración 0013) con geometrías sintéticas. No deja datos: termina en excepción CRUCES_RESULT. Cada línea debe decir OK.
do $$
declare o uuid; c uuid; p uuid; imp uuid; wk uuid; res text := ''; n int; r record;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into organizations(name) values ('t') returning id into o;
  insert into clients(org_id, name) values (o,'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o,c,'p') returning id into p;
  insert into works(project_id, kind, name, geom) values
    (p, 'ducto', 'Línea de captación',
     ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(2500000,5780000), ST_MakePoint(2500500,5780000)), 22182), 4326)) returning id into wk;
  insert into layer_imports(project_id, base_name, format, status) values (p, 'Instalaciones del cliente', 'shp', 'listo') returning id into imp;
  insert into layer_features(project_id, import_id, name, geom) values
    (p, imp, 'Cruce perpendicular', ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(2500250,5779900), ST_MakePoint(2500250,5780100)), 22182), 4326)),
    (p, imp, 'Paralelo cercano',    ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(2500000,5780030), ST_MakePoint(2500500,5780030)), 22182), 4326)),
    (p, imp, 'Paralelo lejano',     ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(2500000,5780500), ST_MakePoint(2500500,5780500)), 22182), 4326));
  insert into layer_features(project_id, import_id, name, geom, work_id) values
    (p, imp, 'Traza de la propia obra', ST_Transform(ST_SetSRID(ST_MakeLine(ST_MakePoint(2500000,5780000), ST_MakePoint(2500500,5780000)), 22182), 4326), wk);

  select count(*) into n from public.nearby_features(p, 50);
  res := res || format(E'%s  a 50 m: cruce y cercano (%s, esperado 2)\n', case when n=2 then 'OK ' else 'FALLA' end, n);
  select count(*) into n from public.nearby_features(p, 10);
  res := res || format(E'%s  a 10 m: solo el cruce (%s, esperado 1)\n', case when n=1 then 'OK ' else 'FALLA' end, n);
  select count(*) into n from public.nearby_features(p, 1000);
  res := res || format(E'%s  a 1000 m: los 3, sin la traza de la propia obra (%s, esperado 3)\n', case when n=3 then 'OK ' else 'FALLA' end, n);

  select * into r from public.nearby_features(p, 50) where feature_name = 'Cruce perpendicular';
  res := res || format(E'%s  el cruce se marca como cruce, dist 0 (crosses=%s, dist=%s)\n', case when r.crosses and r.dist_m = 0 then 'OK ' else 'FALLA' end, r.crosses, r.dist_m);
  res := res || format(E'%s  el punto del cruce cae sobre la obra (a menos de 1 m de 2500250 E, 5780000 N)\n',
    case when ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint(r.lon, r.lat),4326),22182), ST_SetSRID(ST_MakePoint(2500250,5780000),22182)) < 1 then 'OK ' else 'FALLA' end);

  select * into r from public.nearby_features(p, 50) where feature_name = 'Paralelo cercano';
  res := res || format(E'%s  el paralelo no cruza y está a 30 m (crosses=%s, dist=%s)\n', case when not r.crosses and r.dist_m = 30.0 then 'OK ' else 'FALLA' end, r.crosses, r.dist_m);
  res := res || format(E'%s  trae el nombre de la capa (%s)\n', case when r.layer_name = 'Instalaciones del cliente' then 'OK ' else 'FALLA' end, r.layer_name);
  select feature_name into r from public.nearby_features(p, 1000) order by dist_m desc limit 1;
  res := res || format(E'%s  el más lejano es el último (%s)\n', case when r.feature_name = 'Paralelo lejano' then 'OK ' else 'FALLA' end, r.feature_name);

  update works set geom = null where project_id = p;
  select count(*) into n from public.nearby_features(p, 1000);
  res := res || format(E'%s  sin obras con geometría no devuelve nada (%s)\n', case when n=0 then 'OK ' else 'FALLA' end, n);

  raise exception E'CRUCES_RESULT:\n%', res;
end $$;
