-- Pasos omitidos del recorrido (migración 0021): solo un admin los cambia. No deja datos: termina en excepción
-- OMITIR_RESULT. Requiere rol postgres (SQL Editor / MCP). Cada línea debe decir OK.
do $$
declare ua uuid := gen_random_uuid(); um uuid := gen_random_uuid(); o uuid; c uuid; p uuid; res text := ''; ok boolean; v text[];
begin
  insert into auth.users(id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ua || '@test.local'),
    (um, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', um || '@test.local');
  insert into organizations(name) values ('t') returning id into o;
  insert into memberships(user_id, org_id, role) values (ua, o, 'admin'), (um, o, 'miembro');
  insert into clients(org_id, name) values (o, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o, c, 'p') returning id into p;

  select skipped_steps into v from projects where id = p;
  res := res || format(E'%s  un proyecto nuevo no tiene pasos omitidos\n', case when v = '{}' then 'OK ' else 'FALLA' end);

  -- miembro
  perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update projects set skipped_steps = '{gps}' where id = p;
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  un miembro no puede omitir pasos\n', case when ok then 'OK ' else 'FALLA' end);
  update projects set name = 'p2' where id = p;
  res := res || format(E'%s  un miembro sigue editando el resto del proyecto\n', case when found then 'OK ' else 'FALLA' end);
  reset role;

  -- admin
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update projects set skipped_steps = '{gps}' where id = p;
  reset role;
  select skipped_steps into v from projects where id = p;
  res := res || format(E'%s  un admin puede omitir pasos\n', case when v = '{gps}' then 'OK ' else 'FALLA' end);

  raise exception E'OMITIR_RESULT:\n%', res;
end $$;
