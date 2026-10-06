-- Fecha que figura en la carátula del informe (mes y año). Vacía = la de generación.
alter table public.projects add column if not exists report_date date;
