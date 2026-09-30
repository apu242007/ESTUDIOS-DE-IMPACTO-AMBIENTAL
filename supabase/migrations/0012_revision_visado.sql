-- =====================================================================
-- 0012_revision_visado.sql  —  Revisión y visado INTERNO de la consultora (Sprint 10)
-- =====================================================================
-- Flujo: borrador → revisión → entregado. Todas las versiones salen con encabezado "BORRADOR" salvo la FINAL, que solo
-- se genera al aprobar (params.final = true). Solo un administrador aprueba.

alter table public.document_builds add column if not exists package_path text;   -- ZIP del paquete final (DOCX+PDF+KMZ+anexos)

-- 1) Los miembros leen las revisiones; solo los admins las escriben (antes cualquier miembro podía "aprobar").
drop policy if exists org_all on public.project_reviews;
create policy rev_read on public.project_reviews for select
  using (org_id in (select public.auth_org_ids()));
create policy rev_write on public.project_reviews for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- 2) Una versión con params.final solo puede nacer de approve_build (que marca la sesión). Cierra el atajo de pedir
--    la versión "final" por la API sin aprobación.
create or replace function public.guard_final_build()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if coalesce((new.params ->> 'final')::boolean, false)
     and coalesce(current_setting('eia.approving', true), '') <> 'on' then
    raise exception 'la versión final solo se genera al aprobar una versión';
  end if;
  return new;
end $$;
create trigger trg_zz_builds_final before insert or update of params on public.document_builds
  for each row execute function public.guard_final_build();

-- 3) Aprobar: deja constancia, encola la versión FINAL (mismos parámetros, sin marca de borrador) y pasa el proyecto a
--    "entregado". SECURITY DEFINER porque escribe con permisos propios, pero verifica que quien llama sea admin de la org.
create or replace function public.approve_build(p_build uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare b public.document_builds; v_new uuid; v_n int;
begin
  select * into b from public.document_builds where id = p_build;
  if b.id is null then raise exception 'versión inexistente'; end if;
  if not public.is_org_admin(b.org_id) then raise exception 'solo un administrador aprueba versiones'; end if;
  if b.status <> 'listo' then raise exception 'solo se aprueba una versión ya generada'; end if;
  if coalesce((b.params ->> 'final')::boolean, false) then raise exception 'esta versión ya es la final'; end if;

  insert into public.project_reviews(project_id, build_id, reviewer, decision, note)
  values (b.project_id, b.id, auth.uid(), 'aprobado', p_note);

  perform pg_advisory_xact_lock(hashtext(b.project_id::text));
  select coalesce(max(version_num), 0) + 1 into v_n from public.document_builds where project_id = b.project_id;
  perform set_config('eia.approving', 'on', true);
  insert into public.document_builds(project_id, template_id, version_num, params, created_by)
  values (b.project_id, b.template_id, v_n,
          b.params || jsonb_build_object('final', true, 'approved_from', b.id), auth.uid())
  returning id into v_new;
  perform set_config('eia.approving', 'off', true);

  update public.projects set status = 'entregado' where id = b.project_id;
  return v_new;
end $$;
revoke all on function public.approve_build(uuid, text) from public, anon;
grant execute on function public.approve_build(uuid, text) to authenticated;

-- 4) Observar (pedir cambios): deja constancia y devuelve el proyecto a revisión.
create or replace function public.observe_build(p_build uuid, p_note text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b public.document_builds;
begin
  select * into b from public.document_builds where id = p_build;
  if b.id is null then raise exception 'versión inexistente'; end if;
  if not public.is_org_admin(b.org_id) then raise exception 'solo un administrador observa versiones'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'indicá qué hay que corregir'; end if;
  insert into public.project_reviews(project_id, build_id, reviewer, decision, note)
  values (b.project_id, b.id, auth.uid(), 'observado', p_note);
  update public.projects set status = 'revision' where id = b.project_id;
end $$;
revoke all on function public.observe_build(uuid, text) from public, anon;
grant execute on function public.observe_build(uuid, text) to authenticated;
