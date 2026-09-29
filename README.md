# eia-app

Sistema interno de la consultora para generar Informes Ambientales (IA) y Memorias Técnicas Descriptivas (MTD). 

## Estructura
```
apps/web        Next.js 15 + TypeScript + Tailwind 4 + shadcn/ui
apps/worker     Python + FastAPI (/health) + trabajos en segundo plano (desde sprint 2)
supabase/       migraciones SQL (0001_init, 0002_ajustes)
fixtures/       datos reales de prueba (no versionados)
docs/
```

## Requisitos
Node 22+, pnpm, Python 3.12+, GPSBabel y LibreOffice (para el worker, instalados en la PC), Supabase CLI (opcional).

## Puesta en marcha
```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # completar URL y clave publishable
cp apps/worker/.env.example apps/worker/.env        # SOLO en el servidor del worker
pnpm dev                                            # web en http://localhost:3000
# worker (sin Docker): ver apps/worker
```

## Base de datos (Supabase)
Aplicar **en orden** sobre el proyecto Supabase:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_ajustes.sql`

Con la CLI: `supabase login && supabase link --project-ref <ref-del-proyecto> && supabase db push`.
Sin la CLI: pegar cada archivo, en orden, en el SQL Editor del panel de Supabase.
Luego generar tipos: `pnpm db:types`.

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm dev` | web en modo desarrollo |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (web) + pytest (worker) |

Worker local sin Docker: `cd apps/worker && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m pytest`.

## Seguridad
- La `SUPABASE_SERVICE_ROLE_KEY` vive solo en `apps/worker/.env`. Nunca en el front ni en git.
- `.env*` está ignorado salvo `.env.example`. `fixtures/` no se versiona.

## Publicación
La web se exporta como sitio estático y se publica en GitHub Pages con `.github/workflows/deploy.yml` en cada push a `main`. Variables del repo (Settings → Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. En Supabase → Auth → URL Configuration agregar la URL del sitio.
