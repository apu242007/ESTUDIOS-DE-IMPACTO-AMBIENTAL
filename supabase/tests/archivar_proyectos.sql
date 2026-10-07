-- Archivar proyectos (migración 0028): cualquier miembro archiva, solo un admin desarchiva. No deja datos: termina en
-- excepción ARCHIVAR_RESULT. Requiere rol postgres (SQL Editor / MCP). Cada línea debe decir OK.
do $$
declare ua uuid := gen_random_uuid(); um uuid := gen_random_uuid(); o uuid; c uuid; p uuid; res text := ''; ok boolean; a timestamptz;
begin
  insert into auth.users(id, instance_id, aud, role, email) values
    (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ua || '@test.local'),
    (um, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', um || '@test.local');
  insert into organizations(name) values ('t') returning id into o;
  insert into memberships(user_id, org_id, role) values (ua, o, 'admin'), (um, o, 'miembro');
  insert into clients(org_id, name) values (o, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o, c, 'p') returning id into p;

  perform set_config('request.jwt.claims', json_build_object('sub', um, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update projects set archived_at = now() where id = p;
  res := res || format(E'%s  un miembro archiva\n', case when found then 'OK ' else 'FALLA' end);
  begin
    update projects set archived_at = null where id = p; ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  un miembro no puede desarchivar\n', case when ok then 'OK ' else 'FALLA' end);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update projects set archived_at = null where id = p;
  reset role;
  select archived_at into a from projects where id = p;
  res := res || format(E'%s  un admin desarchiva\n', case when a is null then 'OK ' else 'FALLA' end);

  raise exception E'ARCHIVAR_RESULT:\n%', res;
end $$;
