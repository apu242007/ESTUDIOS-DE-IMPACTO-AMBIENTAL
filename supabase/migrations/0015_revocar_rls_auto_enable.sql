-- =====================================================================
-- 0015_revocar_rls_auto_enable.sql  —  Función interna de Supabase que nadie debe invocar por la API
-- =====================================================================
-- rls_auto_enable() la usa un event trigger de la plataforma (corre con los privilegios de su dueño, no del que llama).
-- No tiene sentido que anon ni authenticated puedan ejecutarla vía /rest/v1/rpc.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
