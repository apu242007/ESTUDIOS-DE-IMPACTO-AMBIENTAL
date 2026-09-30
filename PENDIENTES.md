# Pendientes — eia-app

Estado al 2026-09-30. Rama `main`, último commit `ec17432` (Catálogos de administración). **Nada pusheado.**

## Antes de reiniciar la PC

- [ ] Detener `pnpm dev` y el worker si están corriendo.
- [ ] `git status`: debe estar limpio, salvo este archivo (no está commiteado).
- [ ] No hay secretos por guardar. El login de prueba `jcastro@tackertools.com` es ficticio.

## Después de reiniciar: instalar (requiere tu acción)

- [ ] **LibreOffice** (`soffice` en el PATH): convierte el informe a PDF. Sin él solo sale el DOCX.
- [ ] **GPSBabel** (`gpsbabel -V` responde): convierte el `.gdb` de Garmin.
- [ ] Verificar en una terminal nueva: `soffice --version` y `gpsbabel -V`.

## Configuración que solo puedes hacer tú

- [ ] Crear `apps/worker/.env` copiando `.env.example` y pegar `SUPABASE_SERVICE_ROLE_KEY` a mano. Nunca en el chat, en el front ni en git.
- [ ] Supabase → Auth → activar **Leaked password protection** (solo desde el panel).
- [ ] Supabase → Auth → URL Configuration: agregar la URL de GitHub Pages cuando se publique.
- [ ] Repo GitHub → Settings → Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Limpieza de datos (pendiente de autorización)

El clasificador bloqueó el borrado. Quedan en la base:

- [ ] Proyecto de prueba `ZZ prueba UI proyecto` (id `396e8819-a9a1-43ff-9f21-1bec1b392913`) y cliente `ZZ prueba UI cliente` / `ZZ e2e cliente`. Borrar primero el proyecto, luego el cliente:

  ```sql
  delete from public.projects where name like 'ZZ%';
  delete from public.clients where name like 'ZZ%';
  ```

- [ ] Organización duplicada vacía `EXERTION SOLUTIONS` (id `782b5dc3-4c73-40ad-a4af-f8fd09ae440f`). Decidir si se borra. La org con los catálogos sembrados es `0fb59293-…`.

## Pruebas que faltan

- [ ] Worker de punta a punta con datos reales (necesita `.env` y el paso anterior).
- [ ] PDF real: generar un informe con LibreOffice instalado y revisar el resultado.
- [ ] Cruce de waypoints con `fixtures/gps/waypoint 4-9.gdb` (necesita GPSBabel).
- [ ] Abrir el DOCX generado en Word y revisar el formato a ojo.
- [ ] Prueba en celular real a 360 px: relevamiento offline con fotos y sincronización.
- [ ] PWA: íconos y manifest (no verificados).
- [ ] E2E completo (`EIA_EMAIL=… EIA_PASS=… pnpm e2e`) después de la pantalla Catálogos. El último run fue anterior.

## Revisión de código pendiente

- [ ] Leer `codex_admin_result.md` y `codex_review2_result.md` (carpeta scratchpad de la sesión). El segundo es la revisión de seguridad de las migraciones 0009-0014 y de `docs.py`/`report_sections.py`. Actuar sobre los hallazgos reales.

## Cierre

- [ ] `pnpm typecheck`, `pnpm lint` y `pnpm test` (web) sin errores. Los tests del worker se corren con `apps/worker/.venv/Scripts/python -m pytest -q`, porque `pnpm test` usa el python global sin pytest.
- [ ] `pnpm build` final **con `pnpm dev` detenido** (si no, se rompe `.next`).
- [ ] Revisar que no haya datos del cliente en git (repo público): `fixtures/`, documentos del cliente y prompts maestros deben seguir ignorados.
- [ ] `git push` a `main` (dispara el deploy a GitHub Pages).
- [ ] Actualizar HANDOFF/docs y corregir el dato: la matriz tiene **132 celdas**, no 116.

## Cómo retomar

```bash
cd C:\Users\jcastro\eia-app
pnpm install
pnpm dev                                  # web en http://localhost:3000
cd apps/worker
.venv/Scripts/uvicorn app.main:app --env-file .env --port 8000
```

Reglas del proyecto en `CLAUDE.md`. Migraciones aplicadas: 0001-0015. Sin IA/LLM, sin inventar contenido técnico.
