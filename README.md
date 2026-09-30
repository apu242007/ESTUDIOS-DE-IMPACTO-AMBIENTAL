# eia-app

Sistema interno de la consultora para generar Informes Ambientales (IA) y Memorias Técnicas Descriptivas (MTD).

## Estructura
```
apps/web        Next.js 15 + TypeScript + Tailwind 4 + shadcn/ui (exportación estática)
apps/worker     Python + FastAPI (/health) + sondeo de trabajos: capas, GPS e informes
supabase/       migraciones SQL (0001 → 0008) y pruebas SQL en supabase/tests
fixtures/       datos reales de prueba (no versionados)
docs/
```

## Requisitos
Node 22+, pnpm, Python 3.12+. En la PC del worker, instalados de forma nativa (sin Docker):
- **GPSBabel** (`gpsbabel -V` debe responder): convierte el `.gdb` de Garmin.
- **LibreOffice** (`soffice`): convierte el informe a PDF. Sin él se entrega solo el DOCX y el registro lo avisa.

## Puesta en marcha
```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # completar URL y clave publishable
cp apps/worker/.env.example apps/worker/.env        # SOLO en la PC del worker (lleva la service role)
pnpm dev                                            # web en http://localhost:3000
```

**Worker** (en la PC de la consultora; sin él las capas, el GPS y los informes quedan "En cola"):
```bash
cd apps/worker
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # primera vez
.venv/Scripts/uvicorn app.main:app --env-file .env --port 8000
```

> No ejecutes `pnpm build` mientras `pnpm dev` está corriendo: ambos escriben en `.next` y el servidor de
> desarrollo queda con archivos rotos (404 en los chunks, formularios sin JS). Si pasa: detener, borrar `apps/web/.next` y reiniciar.

## Base de datos (Supabase)
Aplicar **en orden** `supabase/migrations/0001` … `0008` (cada una una sola vez; no se editan las ya aplicadas).
Con la CLI: `supabase login && supabase link --project-ref <ref> && supabase db push`.
Sin la CLI: pegar en el SQL Editor. `supabase/ALL_MIGRATIONS.sql` (se regenera, no se versiona) junta todo en un solo script.

> Si `postgis` quedó instalado en el schema `tiger` (viene así en algunos proyectos nuevos), antes de 0001 hay que
> reinstalarlo en `extensions`: ver el prelude al comienzo de `ALL_MIGRATIONS.sql`.

Pruebas en la base (no dejan datos; terminan con una excepción con el resultado; cada línea debe decir OK):
- `supabase/tests/rls_dos_orgs.sql`: aislamiento entre dos organizaciones.
- `supabase/tests/gps_precedencia.sql`: el GPS de mano no se pisa con la posición del teléfono.

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm dev` | web en modo desarrollo |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (web) |
| `cd apps/worker && .venv/Scripts/python -m pytest` | pytest (worker) |

## Seguridad
- La `SUPABASE_SERVICE_ROLE_KEY` vive solo en `apps/worker/.env`. Nunca en el front ni en git.
- `.env*` está ignorado salvo `.env.example`. `fixtures/` no se versiona.
- Los formularios de credenciales usan `method="post"`: si el JS no cargó, la contraseña no viaja en la URL.

## Publicación
La web se exporta como sitio estático y se publica en GitHub Pages con `.github/workflows/deploy.yml` en cada push a `main`. Variables del repo (Settings → Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. En Supabase → Auth → URL Configuration agregar la URL del sitio.
