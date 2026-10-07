-- 0029: tipo y etapa de obra cargables a mano. Los desplegables del alcance ofrecen los valores conocidos y además
-- "Escribir otro…"; un tipo nuevo (ej. "Batería") se guarda tal cual y el informe lo muestra como está escrito
-- (docs.py ya usa KIND_LABEL.get(kind, kind)). Se reemplazan las listas cerradas por "no vacío".

alter table public.works drop constraint works_kind_check;
alter table public.works drop constraint works_stage_check;
alter table public.works add constraint works_kind_check check (length(btrim(kind)) between 1 and 80);
alter table public.works add constraint works_stage_check check (stage is null or length(btrim(stage)) between 1 and 80);
