-- 0025: al entrar un trabajo en la cola, la base dispara el worker de la nube (GitHub Actions, .github/workflows/worker.yml).
-- La llamada es asíncrona (pg_net) y nunca traba la escritura: si falla o no hay token, el respaldo es la corrida
-- programada cada 15 min. El token (fine-grained, permiso "Actions: read and write" solo sobre este repo) se guarda en
-- Vault con el nombre 'github_worker_token'; sin él, esta función no hace nada.
-- Prueba: supabase/tests/avisar_worker.sql.

create extension if not exists pg_net with schema extensions;

create or replace function public.avisar_worker()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tok text;
begin
  if new.status <> 'pendiente' or (tg_op = 'UPDATE' and old.status = 'pendiente') then
    return new;
  end if;
  begin
    select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_worker_token' limit 1;
    if tok is not null then
      perform net.http_post(
        url := 'https://api.github.com/repos/exertion-solutions/ESTUDIOS-DE-IMPACTO-AMBIENTAL/actions/workflows/worker.yml/dispatches',
        body := jsonb_build_object('ref', 'main'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || tok,
          'Accept', 'application/vnd.github+json',
          'X-GitHub-Api-Version', '2022-11-28',
          'User-Agent', 'eia-app-worker'));
    end if;
  exception when others then
    raise warning 'avisar_worker: no se pudo disparar el worker de la nube: %', sqlerrm;
  end;
  return new;
end $$;

revoke execute on function public.avisar_worker() from public, anon, authenticated;

create trigger trg_layer_imports_avisar after insert or update of status on public.layer_imports
  for each row execute function public.avisar_worker();
create trigger trg_gps_imports_avisar after insert or update of status on public.gps_imports
  for each row execute function public.avisar_worker();
create trigger trg_document_builds_avisar after insert or update of status on public.document_builds
  for each row execute function public.avisar_worker();
create trigger trg_figure_builds_avisar after insert or update of status on public.figure_builds
  for each row execute function public.avisar_worker();
