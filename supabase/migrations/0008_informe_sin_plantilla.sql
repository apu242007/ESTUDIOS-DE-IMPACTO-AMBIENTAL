-- =====================================================================
-- 0008_informe_sin_plantilla.sql  —  El informe puede generarse sin plantilla de cliente (armado base)
-- =====================================================================
alter table public.document_builds alter column template_id drop not null;

-- Misma función de 0002 (+ search_path de 0006): la plantilla solo se valida si se eligió una.
create or replace function public.guard_same_org()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if tg_table_name = 'projects' then
    if not exists (select 1 from public.clients where id = new.client_id and org_id = new.org_id) then
      raise exception 'el cliente pertenece a otra organización';
    end if;
  elsif tg_table_name = 'document_builds' then
    if new.template_id is not null
       and not exists (select 1 from public.document_templates where id = new.template_id and org_id = new.org_id) then
      raise exception 'la plantilla pertenece a otra organización';
    end if;
  end if;
  return new;
end $$;

-- p_template ahora es opcional (null = informe base). Sigue siendo SECURITY INVOKER: aplica RLS.
create or replace function public.create_document_build(p_project uuid, p_template uuid default null, p_params jsonb default '{}'::jsonb)
returns uuid language plpgsql set search_path = public, extensions as $$
declare v_id uuid; v_n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_project::text));
  select coalesce(max(version_num), 0) + 1 into v_n from public.document_builds where project_id = p_project;
  insert into public.document_builds(project_id, template_id, version_num, params)
  values (p_project, p_template, v_n, p_params) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_document_build(uuid, uuid, jsonb) to authenticated;
