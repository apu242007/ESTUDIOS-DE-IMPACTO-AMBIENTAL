-- 0019: las rutas de archivos de capas y GPS deben estar dentro del proyecto de la fila.
-- El worker descarga con service role (salta el RLS de Storage) la ruta que el usuario escribió en la fila:
-- sin este control, un miembro de otra organización podía apuntar a archivos ajenos y el worker los importaba.
-- Formato que usa la web: {org_id}/{project_id}/{layers|gps}/{id}/{archivo}. Prueba: supabase/tests/rutas_propias.sql.
-- El worker repite el control (apps/worker/app/jobs/poller.py, _own_path).

create or replace function public.path_in_project(p_path text, p_org uuid, p_project uuid)
returns boolean language sql immutable set search_path = '' as $$
  select p_path is not null
     and starts_with(p_path, p_org::text || '/' || p_project::text || '/')
     and not ('..' = any (string_to_array(p_path, '/')))
$$;

create or replace function public.guard_import_paths()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'layer_imports' then
    if exists (
      select 1 from jsonb_array_elements(coalesce(new.files, '[]'::jsonb)) f
      where not public.path_in_project(f ->> 'path', new.org_id, new.project_id)
    ) then
      raise exception 'Ruta de archivo fuera del proyecto' using errcode = '42501';
    end if;
  elsif not public.path_in_project(new.file_path, new.org_id, new.project_id) then
    raise exception 'Ruta de archivo fuera del proyecto' using errcode = '42501';
  end if;
  return new;
end $$;

-- Nombre "zz": los BEFORE corren en orden alfabético y este tiene que ir después de trg_*_org (que completa org_id).
create trigger trg_zz_layer_imports_paths before insert or update of files, org_id, project_id on public.layer_imports
  for each row execute function public.guard_import_paths();
create trigger trg_zz_gps_imports_paths before insert or update of file_path, org_id, project_id on public.gps_imports
  for each row execute function public.guard_import_paths();

revoke execute on function public.guard_import_paths() from public, anon, authenticated;
