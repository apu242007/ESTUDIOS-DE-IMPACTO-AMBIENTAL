-- 0020: la lista blanca de extensiones (A.10) también al actualizar objetos de Storage.
-- storage_org_update no tenía WITH CHECK: un miembro podía renombrar o mover un archivo propio a una extensión
-- prohibida (.html, .exe…) y saltear la lista que sí exige storage_org_insert (0002). Prueba: supabase/tests/storage_extensiones.sql.

drop policy if exists storage_org_update on storage.objects;
create policy storage_org_update on storage.objects for update
  using (bucket_id = 'project-files'
         and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid()))
  with check (bucket_id = 'project-files'
              and (storage.foldername(name))[1] in (select org_id::text from public.memberships where user_id = auth.uid())
              and lower(storage.extension(name)) = any (array['shp','dbf','shx','prj','cpg','qix','qmd','kmz','kml',
                                                              'gpx','gdb','jpg','jpeg','png','docx','zip']));
