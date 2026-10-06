-- Rutas de archivos de capas y GPS dentro del proyecto (migración 0019). No deja datos: termina en excepción RUTAS_RESULT.
-- Requiere rol con acceso a las tablas (SQL Editor / MCP como postgres). Cada línea debe decir OK.
do $$
declare o uuid; o2 uuid; c uuid; p uuid; p2 uuid; res text := ''; ok boolean;
begin
  insert into organizations(name) values ('t') returning id into o;
  insert into organizations(name) values ('ajena') returning id into o2;
  insert into clients(org_id, name) values (o,'c') returning id into c;
  insert into projects(org_id, client_id, name) values (o,c,'p') returning id into p;
  insert into projects(org_id, client_id, name) values (o,c,'p2') returning id into p2;

  insert into layer_imports(project_id, base_name, format, files)
    values (p, 'bien', 'shp', jsonb_build_array(jsonb_build_object('path', o||'/'||p||'/layers/x/a.shp', 'ext','shp', 'size',1)));
  res := res || E'OK   capa con ruta propia se guarda\n';

  begin
    insert into layer_imports(project_id, base_name, format, files)
      values (p, 'mal', 'shp', jsonb_build_array(jsonb_build_object('path', o2||'/'||p||'/layers/x/a.shp', 'ext','shp', 'size',1)));
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  capa con ruta de otra organización se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  begin
    insert into layer_imports(project_id, base_name, format, files)
      values (p, 'mal', 'shp', jsonb_build_array(jsonb_build_object('path', o||'/'||p2||'/layers/x/a.shp', 'ext','shp', 'size',1)));
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  capa con ruta de otro proyecto se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  begin
    insert into layer_imports(project_id, base_name, format, files)
      values (p, 'mal', 'shp', jsonb_build_array(jsonb_build_object('path', o||'/'||p||'/../../'||o2||'/x/a.shp', 'ext','shp', 'size',1)));
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  capa con ".." se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  begin
    update layer_imports set files = jsonb_build_array(jsonb_build_object('path', o2||'/x/a.shp', 'ext','shp', 'size',1))
      where project_id = p;
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  cambiar la ruta a una ajena con UPDATE se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  insert into gps_imports(project_id, file_path, file_kind) values (p, o||'/'||p||'/gps/x/t.gdb', 'gdb');
  res := res || E'OK   GPS con ruta propia se guarda\n';

  begin
    insert into gps_imports(project_id, file_path, file_kind) values (p, o2||'/'||p||'/gps/x/t.gdb', 'gdb');
    ok := false;
  exception when others then ok := true; end;
  res := res || format(E'%s  GPS con ruta de otra organización se rechaza\n', case when ok then 'OK ' else 'FALLA' end);

  raise exception E'RUTAS_RESULT:\n%', res;
end $$;
