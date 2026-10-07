-- 0027: borrar proyectos. Solo un admin de la organización borra un proyecto (antes org_all dejaba a cualquier miembro).
-- El borrado arrastra en cascada todo lo del proyecto en la base; los archivos de Storage no se borran por SQL, así que
-- project_file_paths() le da a la web la lista de objetos bajo {org_id}/{project_id}/ para quitarlos con la API de Storage.
-- Prueba: supabase/tests/borrar_proyectos.sql.

drop policy org_all on public.projects;

create policy projects_select on public.projects for select
  using (org_id in (select public.auth_org_ids()));
create policy projects_insert on public.projects for insert
  with check (org_id in (select public.auth_org_ids()));
create policy projects_update on public.projects for update
  using (org_id in (select public.auth_org_ids()))
  with check (org_id in (select public.auth_org_ids()));
create policy projects_delete on public.projects for delete
  using (public.is_org_admin(org_id));

create or replace function public.project_file_paths(p_project uuid)
returns setof text language sql stable security definer set search_path = public, storage as $$
  select o.name
  from public.projects p
  join storage.objects o
    on o.bucket_id = 'project-files' and o.name like p.org_id::text || '/' || p.id::text || '/%'
  where p.id = p_project and public.is_org_admin(p.org_id)
$$;

revoke execute on function public.project_file_paths(uuid) from public, anon;
grant execute on function public.project_file_paths(uuid) to authenticated, service_role;
