-- Vista project_progress (migración 0022): conteos por proyecto para el índice de Proyectos, con RLS (security_invoker).
-- No deja datos: termina en excepción AVANCE_RESULT. Requiere rol postgres. Cada línea debe decir OK.
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); oa uuid; ob uuid; c uuid; pa uuid; pb uuid; l uuid;
  r record; n int; res text := '';
begin
  insert into auth.users(id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ua || '@test.local'),
    (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ub || '@test.local');
  insert into organizations(name) values ('a') returning id into oa;
  insert into organizations(name) values ('b') returning id into ob;
  insert into memberships(user_id, org_id, role) values (ua, oa, 'admin'), (ub, ob, 'admin');
  insert into clients(org_id, name) values (oa, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (oa, c, 'p') returning id into pa;
  insert into clients(org_id, name) values (ob, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (ob, c, 'q') returning id into pb;
  insert into works(project_id, kind, name) values (pa, 'camino', 'c1'), (pa, 'camino', 'c2');
  l := gen_random_uuid();
  insert into survey_lines(id, project_id, closed) values (l, pa, true), (gen_random_uuid(), pa, false);
  insert into waypoints(id, project_id, line_id, number, matched) values
    (gen_random_uuid(), pa, l, 1, true), (gen_random_uuid(), pa, l, 2, false), (gen_random_uuid(), pa, l, 3, true);

  select * into r from project_progress where project_id = pa;
  res := res || format(E'%s  cuenta obras, fichas y waypoints (%s/%s/%s/%s/%s)\n',
    case when r.works = 2 and r.lines = 2 and r.lines_closed = 1 and r.waypoints = 3 and r.waypoints_matched = 2 then 'OK ' else 'FALLA' end,
    r.works, r.lines, r.lines_closed, r.waypoints, r.waypoints_matched);
  select * into r from project_progress where project_id = pb;
  res := res || format(E'%s  un proyecto vacío da ceros, no nulos\n', case when r.works = 0 and r.photos = 0 and r.gps_statuses = '{}' then 'OK ' else 'FALLA' end);

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from project_progress where project_id = pa;
  res := res || format(E'%s  otra organización no ve el avance ajeno\n', case when n = 0 then 'OK ' else 'FALLA' end);
  reset role;

  raise exception E'AVANCE_RESULT:\n%', res;
end $$;
