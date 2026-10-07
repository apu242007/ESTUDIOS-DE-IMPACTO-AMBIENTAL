-- Latido del worker (migración 0023): cualquier usuario logueado lo lee; nadie fuera del worker lo escribe.
-- No deja datos: termina en excepción LATIDO_RESULT. Requiere rol postgres. Cada línea debe decir OK.
do $$
declare u uuid := gen_random_uuid(); n int; ok boolean; res text := '';
begin
  insert into auth.users(id, instance_id, aud, role, email) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u || '@test.local');
  insert into worker_heartbeat(id, seen_at) values ('main', now()) on conflict (id) do update set seen_at = excluded.seen_at;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from worker_heartbeat;
  res := res || format(E'%s  un usuario logueado lee el latido\n', case when n = 1 then 'OK ' else 'FALLA' end);
  begin
    update worker_heartbeat set seen_at = now() - interval '1 day';
    get diagnostics n = row_count; ok := n = 0;
  exception when others then ok := true; end;
  res := res || format(E'%s  un usuario no puede falsear el latido\n', case when ok then 'OK ' else 'FALLA' end);
  reset role;

  set local role anon;
  begin
    select count(*) into n from worker_heartbeat; ok := n = 0;
  exception when others then ok := true; end;
  res := res || format(E'%s  sin sesión no se lee\n', case when ok then 'OK ' else 'FALLA' end);
  reset role;

  raise exception E'LATIDO_RESULT:\n%', res;
end $$;
