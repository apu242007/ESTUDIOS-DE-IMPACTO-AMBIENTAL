-- =====================================================================
-- 0006_hardening_funciones.sql  —  Advisors de seguridad de Supabase
-- =====================================================================

-- 1) Los usuarios sin sesión (anon) no necesitan ejecutar funciones SECURITY DEFINER de la app.
--    Las políticas RLS y los RPC los usan solo usuarios autenticados.
revoke execute on function public.auth_org_ids()               from public, anon;
revoke execute on function public.is_org_admin(uuid)           from public, anon;
revoke execute on function public.create_organization(text)    from public, anon;
grant  execute on function public.auth_org_ids()               to authenticated, service_role;
grant  execute on function public.is_org_admin(uuid)           to authenticated, service_role;
grant  execute on function public.create_organization(text)    to authenticated;

-- 2) search_path fijo en las funciones de la app. Incluye `extensions` porque los triggers usan PostGIS
--    (ST_Transform, ST_Collect, geometrytype...), que vive en ese schema.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('set_org_from_project','works_measures','touch_updated_at','recalc_works_on_crs',
                         'guard_same_org','create_document_build','calc_impact','guard_job_status',
                         'guard_parent_project','duplicate_project','recalc_work_geom','sync_work_geom',
                         'create_wells_from_import')
  loop
    execute format('alter function %s set search_path = public, extensions', r.fn);
  end loop;
end $$;
