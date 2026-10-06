-- Lista blanca de extensiones también al actualizar objetos de Storage (migración 0020). No deja datos: termina en
-- excepción STORAGE_RESULT. Requiere rol postgres (SQL Editor / MCP). Cada línea debe decir OK.
do $$
declare u uuid := gen_random_uuid(); o uuid; res text := ''; ok boolean;
begin
  insert into auth.users(id, instance_id, aud, role, email) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u || '@test.local');
  insert into organizations(name) values ('t') returning id into o;
  insert into memberships(user_id, org_id, role) values (u, o, 'miembro');
  insert into storage.objects(bucket_id, name, owner) values ('project-files', o || '/p/photos/a.jpg', u);

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update storage.objects set name = o || '/p/photos/b.jpg' where name = o || '/p/photos/a.jpg';
  res := res || format(E'%s  renombrar a otra extensión permitida\n', case when found then 'OK ' else 'FALLA' end);

  begin
    update storage.objects set name = o || '/p/photos/b.html' where name = o || '/p/photos/b.jpg';
    ok := not found;
  exception when others then ok := true; end;
  res := res || format(E'%s  renombrar a una extensión prohibida se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  reset role;
  raise exception E'STORAGE_RESULT:\n%', res;
end $$;
