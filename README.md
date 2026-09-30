# eia-app

Sistema interno de la consultora para generar Informes Ambientales (IA) y Memorias Técnicas Descriptivas (MTD).

## Estructura
```
apps/web        Next.js 15 + TypeScript + Tailwind 4 + shadcn/ui (exportación estática)
apps/worker     Python + FastAPI (/health) + sondeo de trabajos: capas, GPS, informes y figuras
supabase/       migraciones SQL (0001 → 0015) y pruebas SQL en supabase/tests
fixtures/       datos reales de prueba (no versionados)
docs/           plantillas.md (marcadores de las plantillas de cliente)
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

**Worker** (en la PC de la consultora; sin él las capas, el GPS, los informes y las figuras quedan "En cola"):
```bash
cd apps/worker
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # primera vez
.venv/Scripts/uvicorn app.main:app --env-file .env --port 8000
```

> No ejecutes `pnpm build` mientras `pnpm dev` está corriendo: ambos escriben en `.next` y el servidor de
> desarrollo queda con archivos rotos (404 en los chunks, formularios sin JS). Si pasa: detener, borrar `apps/web/.next` y reiniciar.

## Base de datos (Supabase)
Aplicar **en orden** `supabase/migrations/0001` … `0015` (cada una una sola vez; no se editan las ya aplicadas).
Con la CLI: `supabase login && supabase link --project-ref <ref> && supabase db push`.
Sin la CLI: pegar en el SQL Editor. `supabase/ALL_MIGRATIONS.sql` (se regenera, no se versiona) junta todo en un solo script.

> Si `postgis` quedó instalado en el schema `tiger` (viene así en algunos proyectos nuevos), antes de 0001 hay que
> reinstalarlo en `extensions`: ver el prelude al comienzo de `ALL_MIGRATIONS.sql`.

**Pruebas en la base** (no dejan datos; terminan con una excepción con el resultado; cada línea debe decir OK):
`supabase/tests/`: `rls_dos_orgs.sql` (aislamiento entre organizaciones), `gps_precedencia.sql`, `revision_visado.sql`
(solo el admin aprueba), `cruces_proximidad.sql`.

## Catálogos técnicos (se siembran desde los documentos reales, nunca se inventan)
Los catálogos son datos por organización. Se cargan desde los documentos de la consultora con scripts que **no versionan**
el contenido (los textos del cliente quedan en `fixtures/`, ignorado por git):

```bash
# 1) Matriz de impactos (acciones, factores con UIP, opciones de atributos, categorías) → SQL para el SQL Editor
cd apps/worker
python scripts/seed_matriz.py --org <uuid-de-la-organización> --out seed.sql
python scripts/seed_matriz.py --project <uuid-del-proyecto> --out matriz.sql   # opcional: los valores del Excel en un proyecto

# 2) Textos del IA (declaraciones, secciones, ambiente, PGA) → JSON local → catálogos con tu sesión (RLS, sin service role)
python scripts/extract_ia.py "<IA de referencia>.docx" --out ../../fixtures/extract/ia.json
cd ../web
EIA_EMAIL=... EIA_PASS=... node scripts/seed-texts.mjs --json ../../fixtures/extract/ia.json \
    --org <uuid> --zone <clave_de_zona> --pad "PAD 58"      # --dry para ver qué haría
```
Lo que el Excel/Word no trae (nombres de las opciones de los atributos, límites exactos entre categorías) queda en el
reporte del script y se completa en Administración → Catálogos.

## Comandos
| Comando | Qué hace |
|---|---|
| `pnpm dev` | web en modo desarrollo |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm test` | Vitest (web) |
| `EIA_EMAIL=… EIA_PASS=… pnpm e2e` | Playwright contra `pnpm dev` y la base real (usa el Edge instalado; crea y borra sus datos) |
| `cd apps/worker && .venv/Scripts/python -m pytest -q` | pytest (worker) |

## Cómo se arma un informe
Datos → alcance → capas → relevamiento (celular, offline) → GPS → **Control** (reglas de calidad) → **Contenido** (textos,
ambiente, matriz de impactos, declaraciones, PGA) → **Informe**: cada generación es una versión con encabezado BORRADOR;
un administrador la aprueba y se genera la **versión final** (sin marca) con su **paquete final** (DOCX + PDF + KMZ de
interferencias + anexos georreferenciados). Plantillas por cliente: ver `docs/plantillas.md`.

## Seguridad
- La `SUPABASE_SERVICE_ROLE_KEY` vive solo en `apps/worker/.env`. Nunca en el front ni en git.
- `.env*` está ignorado salvo `.env.example`. `fixtures/`, los documentos del cliente y los prompts maestros no se versionan.
- Los formularios de credenciales usan `method="post"`: si el JS no cargó, la contraseña no viaja en la URL.
- RLS en todas las tablas; solo un administrador aprueba versiones (`approve_build`) y la versión final solo nace de esa aprobación.

## Publicación
La web se exporta como sitio estático y se publica en GitHub Pages con `.github/workflows/deploy.yml` en cada push a `main`. Variables del repo (Settings → Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. En Supabase → Auth → URL Configuration agregar la URL del sitio.
