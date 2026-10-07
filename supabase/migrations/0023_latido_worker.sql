-- 0023: latido del worker. El worker (service role) actualiza seen_at cada ~30 s mientras corre; la web lo lee
-- para decir si un archivo "en cola" se va a procesar en segundos o si el procesador está apagado.
-- Sin datos de organizaciones: una sola fila global. Prueba: supabase/tests/latido_worker.sql.

create table public.worker_heartbeat (
  id text primary key default 'main',
  seen_at timestamptz not null default now()
);

alter table public.worker_heartbeat enable row level security;

-- lectura para cualquier usuario logueado; sin políticas de escritura: solo el worker (service role) escribe
create policy heartbeat_read on public.worker_heartbeat for select to authenticated using (true);

revoke all on public.worker_heartbeat from anon;
grant select on public.worker_heartbeat to authenticated;
