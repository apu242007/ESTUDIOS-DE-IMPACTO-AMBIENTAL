-- 0016: params.final debe ser un booleano JSON. Antes {"final":"false"} (texto) pasaba el guard de 0012 (el cast a
-- boolean lo leía como false) y el worker lo trataba como verdadero → versión FINAL sin aprobación.
create or replace function public.guard_final_build()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.params ? 'final' and jsonb_typeof(new.params -> 'final') <> 'boolean' then
    raise exception 'params.final debe ser true o false';
  end if;
  if coalesce((new.params ->> 'final')::boolean, false)
     and coalesce(current_setting('eia.approving', true), '') <> 'on' then
    raise exception 'la versión final solo se genera al aprobar una versión';
  end if;
  return new;
end $$;
