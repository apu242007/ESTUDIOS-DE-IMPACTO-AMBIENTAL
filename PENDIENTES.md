# Pendientes — eia-app

Estado al 2026-09-30. Rama `main` pusheada, deploy a GitHub Pages OK. Migraciones aplicadas: 0001-0016.

## Hecho

- Revisión de seguridad 0009-0015 y worker: Jinja en sandbox, rutas de Storage solo de la organización, `params.final` estricto (0016).
- Manifest PWA, íconos y tema oscuro con la paleta del producto.
- Datos de prueba `ZZ*` borrados. Variables de GitHub cargadas. `typecheck`, `lint`, tests web (115) y worker (82) en verde.

## Solo lo puedes hacer tú

- [ ] Instalar **LibreOffice** (`soffice`, genera el PDF) y **GPSBabel** (`gpsbabel -V`, convierte el `.gdb`). Verificar en una terminal nueva.
- [ ] Crear `apps/worker/.env` desde `.env.example` y pegar `SUPABASE_SERVICE_ROLE_KEY` a mano (nunca en chat, front ni git).
- [ ] Supabase → Auth → activar **Leaked password protection** y agregar la URL de GitHub Pages en URL Configuration.
- [ ] Decidir si se borra la organización vacía duplicada `EXERTION SOLUTIONS` (`782b5dc3-4c73-40ad-a4af-f8fd09ae440f`). La de los catálogos es `0fb59293-…`.
- [ ] VS Code usa Node 18 para la extensión de Playwright (error "requires Node.js 20"). La terminal usa Node 22: no afecta `pnpm e2e`.

## Pruebas que dependen de lo anterior

- [ ] Worker de punta a punta con datos reales y PDF real con LibreOffice; abrir el DOCX en Word.
- [ ] Cruce de waypoints con `fixtures/gps/waypoint 4-9.gdb`.
- [ ] Celular real a 360 px: relevamiento offline con fotos y sincronización; instalar la PWA.
- [ ] E2E completo: `EIA_EMAIL=… EIA_PASS=… pnpm e2e`.

## Nota

Los RPC `SECURITY DEFINER` que marca el advisor de Supabase son intencionales (validan admin/org adentro).

## Cómo retomar

```bash
cd C:\Users\jcastro\eia-app
pnpm install
pnpm dev                                  # web en http://localhost:3000
cd apps/worker
.venv/Scripts/uvicorn app.main:app --env-file .env --port 8000
```

Tests del worker: `apps/worker/.venv/Scripts/python -m pytest -q`. `pnpm build` con `pnpm dev` detenido.
