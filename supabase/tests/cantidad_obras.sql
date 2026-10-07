-- Cantidad por obra (migración 0026): "Líneas de control 3" (2)" se compara contra 2 × lo declarado por línea.
-- No deja datos: termina en excepción CANTIDAD_RESULT. Requiere rol postgres. Cada línea debe decir OK.
do $$
declare o uuid; c uuid; p uuid; w uuid; r record; res text := ''; ok boolean;
begin
  insert into organizations(name) values ('t') returning id into o;
  insert into clients(org_id, name) values (o, 'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o, c, 'p') returning id into p;
  insert into works(project_id, kind, name, declared_length_m) values (p, 'ducto', 'Líneas de control 3" (2)', 2300) returning id into w;
  update works set geom_length_m = 4596.7 where id = w;

  select * into r from works_compare where id = w;
  res := res || format(E'%s  sin cantidad cuenta una sola línea (%s %%)\n', case when r.quantity = 1 and r.diff_length_pct > 99 then 'OK ' else 'FALLA' end, r.diff_length_pct);

  update works set quantity = 2 where id = w;
  select * into r from works_compare where id = w;
  res := res || format(E'%s  con cantidad 2 compara contra 4.600 m (declarado %s, dif %s %%)\n',
    case when r.declared_length_m = 4600 and r.declared_unit_length_m = 2300 and abs(r.diff_length_pct) < 0.1 then 'OK ' else 'FALLA' end,
    r.declared_length_m, r.diff_length_pct);

  begin
    update works set quantity = 0 where id = w; ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  la cantidad no puede ser cero\n', case when ok then 'OK ' else 'FALLA' end);

  raise exception E'CANTIDAD_RESULT:\n%', res;
end $$;
