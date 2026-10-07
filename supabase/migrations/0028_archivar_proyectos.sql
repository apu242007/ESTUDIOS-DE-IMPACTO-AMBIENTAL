-- 0028: archivar proyectos. Cualquier miembro archiva (sale de la lista sin perder nada); solo un admin lo devuelve.
-- Prueba: supabase/tests/archivar_proyectos.sql.

alter table public.projects add column archived_at timestamptz;

create or replace function public.guard_project_unarchive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.archived_at is not null and new.archived_at is null
     and coalesce(auth.role(), '') <> 'service_role' and not public.is_org_admin(old.org_id) then
    raise exception 'Solo un administrador puede desarchivar un proyecto' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.guard_project_unarchive() from public, anon, authenticated;

create trigger guard_project_unarchive before update of archived_at on public.projects
  for each row execute function public.guard_project_unarchive();
