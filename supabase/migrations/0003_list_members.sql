-- =====================================================================
-- 0003_list_members.sql  —  Listado de miembros con email (sprint 1)
-- auth.users no es legible desde el cliente: se expone solo para admins de la organización.
-- =====================================================================
create or replace function public.list_members(p_org uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org
    and p_org in (select public.auth_org_ids())
$$;
revoke all on function public.list_members(uuid) from public, anon;
grant execute on function public.list_members(uuid) to authenticated;
