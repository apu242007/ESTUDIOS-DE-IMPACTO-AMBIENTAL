-- Revisión y visado interno (migración 0012). No deja datos: termina en excepción REVISION_RESULT. Cada línea debe decir OK.
do $$
declare ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  o uuid; c uuid; p uuid; b1 uuid; bf uuid; n int; st text; res text := ''; v int; fin boolean;
begin
  insert into auth.users(id, aud, role, email, instance_id) values
    (ua,'authenticated','authenticated','adm@test.local','00000000-0000-0000-0000-000000000000'),
    (ub,'authenticated','authenticated','mie@test.local','00000000-0000-0000-0000-000000000000');

  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  o := public.create_organization('Org');
  insert into public.clients(org_id, name) values (o,'c') returning id into c;
  insert into public.projects(org_id, client_id, name) values (o,c,'p') returning id into p;
  b1 := public.create_document_build(p);
  reset role;
  insert into public.memberships(user_id, org_id, role) values (ub, o, 'miembro');

  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.create_document_build(p, null, '{"final":true}'::jsonb);
    res := res || E'FALLA  el admin pudo crear una versión final sin aprobar\n';
  exception when others then res := res || E'OK   no se puede crear una versión final directamente\n'; end;
  begin
    perform public.approve_build(b1, 'ok');
    res := res || E'FALLA  aprobó una versión pendiente\n';
  exception when others then res := res || E'OK   no aprueba una versión sin generar\n'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
  update public.document_builds set status = 'listo', docx_path = 'x.docx' where id = b1;

  perform set_config('request.jwt.claims', json_build_object('sub',ub,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.approve_build(b1, 'ok'); res := res || E'FALLA  un miembro aprobó\n';
  exception when others then res := res || E'OK   un miembro no puede aprobar\n'; end;
  begin perform public.observe_build(b1, 'corregir'); res := res || E'FALLA  un miembro observó\n';
  exception when others then res := res || E'OK   un miembro no puede observar\n'; end;
  begin
    insert into public.project_reviews(project_id, build_id, decision) values (p, b1, 'aprobado');
    res := res || E'FALLA  un miembro escribió una revisión directa\n';
  exception when others then res := res || E'OK   un miembro no puede insertar revisiones\n'; end;
  begin
    insert into public.document_builds(project_id, version_num, params) values (p, 99, '{"final":true}'::jsonb);
    res := res || E'FALLA  un miembro insertó una versión final\n';
  exception when others then res := res || E'OK   un miembro no puede insertar una versión final\n'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',ua,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.observe_build(b1, '  '); res := res || E'FALLA  observó sin indicar qué corregir\n';
  exception when others then res := res || E'OK   observar exige una nota\n'; end;
  perform public.observe_build(b1, 'Falta la fecha');
  select status into st from public.projects where id = p;
  res := res || format(E'%s  observar deja el proyecto en revisión (%s)\n', case when st='revision' then 'OK ' else 'FALLA' end, st);

  bf := public.approve_build(b1, 'Aprobado');
  select version_num, (params->>'final')::boolean, status into v, fin, st from public.document_builds where id = bf;
  res := res || format(E'%s  aprobar crea la versión final (v%s, final=%s, estado %s)\n', case when v=2 and fin and st='pendiente' then 'OK ' else 'FALLA' end, v, fin, st);
  select status into st from public.projects where id = p;
  res := res || format(E'%s  el proyecto queda entregado (%s)\n', case when st='entregado' then 'OK ' else 'FALLA' end, st);
  select count(*) into n from public.project_reviews where project_id = p;
  res := res || format(E'%s  quedaron 2 constancias (observado + aprobado): %s\n', case when n=2 then 'OK ' else 'FALLA' end, n);
  begin perform public.approve_build(bf, 'x'); res := res || E'FALLA  aprobó la versión final otra vez\n';
  exception when others then res := res || E'OK   la versión final no se vuelve a aprobar\n'; end;
  reset role;

  raise exception E'REVISION_RESULT:\n%', res;
end $$;
