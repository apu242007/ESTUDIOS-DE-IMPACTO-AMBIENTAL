-- Prueba de RLS con dos organizaciones. Pegar en el SQL Editor (o vía MCP): NO deja datos, siempre termina
-- con una excepción 'RLS_RESULT' que revierte todo y trae el resultado. Cada línea debe decir OK.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  oa uuid; ob uuid; ca uuid; cb uuid; pa uuid; pb uuid; wa uuid;
  n int; res text := '';
begin
  insert into auth.users(id, aud, role, email, instance_id) values
    (ua,'authenticated','authenticated','rls-a@test.local','00000000-0000-0000-0000-000000000000'),
    (ub,'authenticated','authenticated','rls-b@test.local','00000000-0000-0000-0000-000000000000');

  -- ===== usuario A crea su organización con datos =====
  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ua::text, true);
  set local role authenticated;
  oa := public.create_organization('Org A');
  insert into public.clients(org_id, name) values (oa, 'Cliente A') returning id into ca;
  insert into public.projects(org_id, client_id, name) values (oa, ca, 'Proyecto A') returning id into pa;
  insert into public.works(project_id, kind, name) values (pa, 'camino', 'Camino A') returning id into wa;
  insert into public.cadastre_data(project_id, owners) values (pa, 'Titular A');
  reset role;

  -- ===== usuario B crea la suya =====
  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  ob := public.create_organization('Org B');
  insert into public.clients(org_id, name) values (ob, 'Cliente B') returning id into cb;
  insert into public.projects(org_id, client_id, name) values (ob, cb, 'Proyecto B') returning id into pb;

  -- ===== B intenta tocar lo de A =====
  select count(*) into n from public.projects;
  res := res || format(E'%s  B ve solo sus proyectos (ve %s, esperado 1)\n', case when n = 1 then 'OK ' else 'FALLA' end, n);
  select count(*) into n from public.projects where id = pa;
  res := res || format(E'%s  B no ve el proyecto de A\n', case when n = 0 then 'OK ' else 'FALLA' end);
  select count(*) into n from public.works where project_id = pa;
  res := res || format(E'%s  B no ve las obras de A\n', case when n = 0 then 'OK ' else 'FALLA' end);
  select count(*) into n from public.clients;
  res := res || format(E'%s  B ve solo su cliente (ve %s)\n', case when n = 1 then 'OK ' else 'FALLA' end, n);
  select count(*) into n from public.memberships;
  res := res || format(E'%s  B ve solo su membresía (ve %s)\n', case when n = 1 then 'OK ' else 'FALLA' end, n);
  select count(*) into n from public.catalog_codes where org_id = oa;
  res := res || format(E'%s  B no ve el catálogo de A\n', case when n = 0 then 'OK ' else 'FALLA' end);

  update public.projects set name = 'hack' where id = pa;
  get diagnostics n = row_count;
  res := res || format(E'%s  B no puede modificar el proyecto de A\n', case when n = 0 then 'OK ' else 'FALLA' end);
  delete from public.projects where id = pa;
  get diagnostics n = row_count;
  res := res || format(E'%s  B no puede borrar el proyecto de A\n', case when n = 0 then 'OK ' else 'FALLA' end);

  begin
    insert into public.works(project_id, kind, name) values (pa, 'camino', 'intruso');
    res := res || E'FALLA  B pudo insertar una obra en el proyecto de A\n';
  exception when others then res := res || E'OK   B no puede insertar obras en el proyecto de A\n'; end;

  begin
    insert into public.clients(org_id, name) values (oa, 'intruso');
    res := res || E'FALLA  B pudo crear un cliente en la org de A\n';
  exception when others then res := res || E'OK   B no puede crear clientes en la org de A\n'; end;

  begin
    insert into public.projects(org_id, client_id, name) values (ob, ca, 'cliente ajeno');
    res := res || E'FALLA  B pudo usar un cliente de otra org en su proyecto\n';
  exception when others then res := res || E'OK   B no puede referenciar clientes de otra org\n'; end;

  begin
    perform public.add_member_by_email(oa, 'rls-b@test.local', 'admin');
    res := res || E'FALLA  B pudo auto-agregarse como admin de A\n';
  exception when others then res := res || E'OK   B no puede agregarse como admin de A\n'; end;

  select count(*) into n from public.list_members(oa);
  res := res || format(E'%s  B no lista los miembros de A\n', case when n = 0 then 'OK ' else 'FALLA' end);

  begin
    insert into public.memberships(user_id, org_id, role) values (ub, oa, 'admin');
    res := res || E'FALLA  B pudo insertarse una membresía en A\n';
  exception when others then res := res || E'OK   B no puede insertarse membresías en A\n'; end;

  select count(*) into n from public.cadastre_data;
  res := res || format(E'%s  catastro de A invisible para B\n', case when n = 0 then 'OK ' else 'FALLA' end);

  -- ===== sin sesión =====
  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    select count(*) into n from public.projects;
    res := res || format(E'%s  anon ve 0 proyectos (ve %s)\n', case when n = 0 then 'OK ' else 'FALLA' end, n);
  exception when others then res := res || E'OK   anon rechazado en projects\n'; end;
  begin
    perform public.create_organization('anon org');
    res := res || E'FALLA  anon pudo crear organización\n';
  exception when others then res := res || E'OK   anon no puede crear organizaciones\n'; end;
  reset role;

  raise exception E'RLS_RESULT:\n%', res;  -- fuerza el rollback: no queda nada en la base
end $$;
