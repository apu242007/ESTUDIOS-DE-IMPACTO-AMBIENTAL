-- Borrar proyectos (migración 0027): solo un admin borra, y el borrado arrastra lo del proyecto. No deja datos: termina
-- en excepción BORRAR_RESULT. Requiere rol postgres (SQL Editor / MCP). Cada línea debe decir OK.
do $$
declare ua uuid := gen_random_uuid(); um uuid := gen_random_uuid(); o uuid; c uuid; p uuid; res text := ''; n int;
begin
  insert into auth.users(id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ua || '@test.local'),
    (um, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', um || '@test.local');
  insert into organizations(name) values ('t') returning id into o;
  insert into memberships(user_id, org_id, role) values (ua, o, 'admin'), (um, o, 'miembro');
  insert into clients(org_id, name) values (o, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o, c, 'p') returning id into p;
  insert into works(project_id, kind, name, declared_length_m) values (p, 'camino', 'Camino', 100);

  -- miembro: RLS no le muestra la fila para borrar
  perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from projects where id = p;
  get diagnostics n = row_count;
  res := res || format(E'%s  un miembro no puede borrar el proyecto\n', case when n = 0 then 'OK ' else 'FALLA' end);
  select count(*) into n from project_file_paths(p);
  res := res || format(E'%s  un miembro no lista los archivos del proyecto\n', case when n = 0 then 'OK ' else 'FALLA' end);
  update projects set name = 'p2' where id = p;
  res := res || format(E'%s  un miembro sigue editando el proyecto\n', case when found then 'OK ' else 'FALLA' end);
  reset role;

  -- admin: borra y arrastra las obras
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from projects where id = p;
  get diagnostics n = row_count;
  reset role;
  res := res || format(E'%s  un admin borra el proyecto\n', case when n = 1 then 'OK ' else 'FALLA' end);
  select count(*) into n from works where project_id = p;
  res := res || format(E'%s  las obras se borran con el proyecto\n', case when n = 0 then 'OK ' else 'FALLA' end);

  raise exception E'BORRAR_RESULT:\n%', res;
end $$;
