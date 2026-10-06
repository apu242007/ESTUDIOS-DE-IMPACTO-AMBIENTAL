-- Encabezado de la consultora (logo + datos de contacto) que va arriba de cada página del informe.
-- Archivo en Storage: {org_id}/branding/{uuid}.{png|jpg}; lo cambia un admin (política org_update ya existente).
alter table public.organizations add column if not exists header_image_path text;
