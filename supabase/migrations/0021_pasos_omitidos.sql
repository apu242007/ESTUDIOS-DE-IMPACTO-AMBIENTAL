-- 0021: pasos del recorrido que un admin da por cumplidos aunque falten datos ("Omitir").
-- Solo cambia cómo se cuenta el avance en la app y queda registrado en Control; el informe no cambia
-- (las secciones sin datos siguen saliendo incompletas). Prueba: supabase/tests/pasos_omitidos.sql.

alter table public.projects add column skipped_steps text[] not null default '{}';

-- RLS org_all deja a cualquier miembro editar el proyecto: este trigger reserva skipped_steps a los admins.
-- Sin usuario (service role, SQL como postgres) no se restringe.
create or replace function public.guard_skipped_steps()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.skipped_steps is distinct from old.skipped_steps
     and auth.uid() is not null and not public.is_org_admin(new.org_id) then
    raise exception 'Solo un administrador puede omitir pasos del proyecto' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger trg_projects_skipped_steps before update of skipped_steps on public.projects
  for each row execute function public.guard_skipped_steps();

revoke execute on function public.guard_skipped_steps() from public, anon, authenticated;
