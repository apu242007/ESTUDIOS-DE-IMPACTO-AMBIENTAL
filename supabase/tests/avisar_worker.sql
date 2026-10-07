-- Aviso al worker de la nube (migración 0025): nunca traba las escrituras de la cola. No deja datos: termina en
-- excepción AVISO_RESULT. Requiere rol postgres. Cada línea debe decir OK.
do $$
declare o uuid; c uuid; p uuid; g uuid; res text := ''; n int;
begin
  insert into organizations(name) values ('t') returning id into o;
  insert into clients(org_id, name) values (o, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o, c, 'p') returning id into p;

  insert into gps_imports(project_id, file_path, file_kind) values (p, o || '/' || p || '/gps/x/t.gpx', 'gpx') returning id into g;
  res := res || E'OK   subir un archivo a la cola no se traba por el aviso\n';
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);  -- el estado lo cambia el worker
  update gps_imports set status = 'listo' where id = g;
  update gps_imports set status = 'pendiente' where id = g;
  get diagnostics n = row_count;
  res := res || format(E'%s  volver a la cola (reprocesar) tampoco\n', case when n = 1 then 'OK ' else 'FALLA' end);
  select count(*) into n from pg_trigger where tgname like 'trg_%_avisar' and not tgisinternal;
  res := res || format(E'%s  las cuatro colas avisan (%s triggers)\n', case when n = 4 then 'OK ' else 'FALLA' end, n);

  raise exception E'AVISO_RESULT:\n%', res;
end $$;
