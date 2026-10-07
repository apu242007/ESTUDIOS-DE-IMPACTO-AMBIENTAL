# Pendientes

Estado al 06/10/2026. Origen: comparación del informe generado (v6/v10) contra el IA entregado
2947-26 (`2947-26 IA Perforación de 6 pozos en PAD58_BPO_VF.pdf`), más lo que quedó abierto en la sesión.
Orden = importancia para el cliente. Tachar o borrar al cerrar cada ítem.

## Acciones del usuario (no son código)

- [ ] **Rotar la clave service role** en Supabase → API Keys (quedó en el historial del chat) y pegar la nueva en `apps/worker/.env`.
- [ ] **Subir el logo de Vista**: Datos del proyecto → "Subir logo" (o Clientes → "Subir logo").
- [ ] **Reemplazar el encabezado de BIOSUM** por el original en alta resolución: Administración → Encabezado (el actual es una captura de 571×94 px).
- [ ] **Instalar GPSBabel** (pide administrador) para leer `.gdb` reales. El ejemplo usa un GPX exportado del KMZ.
- [ ] **Fecha del informe** del ejemplo: cargarla en Datos (la carátula dice el mes de generación).
- [ ] **Revisar las lecturas dudosas** de las fichas transcriptas (033, 043–047, 123–125, 93–94, 136–139, 037): están en "Observaciones" de cada ficha.
- [ ] **Revisar datos declarados**: el texto del IA dice 33.440 m² y 2.280 m; el alcance cargado dice 34.400 m² y 2.270 m.
- [ ] **Aprobar la versión final** (Informe → "Aprobar y generar versión final"): lo hace un admin, no se automatiza.
- [ ] **Arrancar el worker desde tu propia terminal** (`powershell -ExecutionPolicy Bypass -File apps\worker\run_worker.ps1`)
  y dejarla abierta. Lanzado desde la sesión de Claude Code muere a los minutos sin dejar rastro (lo cierra el entorno de
  herramientas, no es un bug del worker). Lo definitivo es la tarea programada al iniciar sesión (ver Worker).
- [ ] **Activar "Leaked password protection"** en Supabase → Authentication → Passwords (aviso de seguridad del linter).
- [ ] **Usuario demo** `demoinformeamb@exertion.demo` (rol miembro, contraseña débil): cambiarle la contraseña o darlo de baja
  después de la demo.

## Requiere decisión (auditoría 06/10/2026)

- [ ] **Quién puede borrar un proyecto.** RLS `org_all` deja a cualquier miembro borrar un proyecto por la API, y el borrado
  arrastra en cascada relevamiento, fotos, GPS y versiones. ¿Solo admin? Requiere migración en `projects` (DELETE solo
  `is_org_admin`). Clientes ya está protegido: no se borra uno con proyectos (FK RESTRICT).
- [ ] **Versión final que no entra en 50 MB.** Ahora da un mensaje claro en vez de "Error inesperado", pero un informe
  grande sigue sin poder cerrar su paquete. Opciones: no incluir el DOCX en el zip, partirlo, o subir el límite del plan.
- [ ] **Versión final sin PDF.** Si LibreOffice falla, la FINAL sale solo con DOCX y el aviso queda en el log
  (`docs.py`, bloque del PDF). ¿Debe fallar la FINAL en ese caso?
- [ ] **Títulos con " / ".** El separador de jerarquía de `catalog_text_blocks.title` es " / ": un título real con barra
  (p. ej. "Flora / Fauna") se partiría. Hoy ninguno lo tiene; arreglarlo pide otro separador o una columna de nivel.

## Informe (worker / plantillas)

1. [ ] **Tablas técnicas 1–43 del IA** (coordenadas de pozos e instalaciones, catastro, volúmenes, prognosis, fluidos,
   contención, ductos, residuos, áridos, edafología, área de afectación). El texto las nombra ("ver Tabla 34") y no están.
   Mientras falten, marcar la sección "incompleta" en lugar de dejar la referencia colgada.
2. [ ] **Mapas y figuras automáticas** (`apps/worker/app/jobs/figures.py`): ubicación, acceso, pozos, interferencias,
   temáticos (geología, geomorfología, suelos, DEM, vegetación) + figuras fijas del catálogo de ambiente (Fig. 10–26).
3. [ ] **Vincular fotos con waypoints** para que la columna "Figura" de interferencias diga "Figura N" (hoy muestra la categoría).
4. [ ] **Anexo fotográfico curado**: epígrafe descriptivo (obra + vista), coordenadas GK por foto, subsecciones por obra
   (pozos con vistas cardinales, LMT, TLS, apéndice, ingresos) y selección de fotos (IA: 85 figuras; app: 305 fotos).
5. [ ] **Numeración jerárquica de títulos** (3.1, 3.6.1…) e **índice con números de página** (campo TOC de Word).
6. [ ] **Datos generales completos**: solicitante (domicilio real, teléfono, email, actividad) y consultora (teléfono,
   domicilio legal, responsables legales, RePPSA, párrafo del Colegio/visado). Requiere ampliar la ficha de cliente/consultora.
7. [ ] **Sección 5 completa**: tablas de acciones, factores y atributos, matriz causa-efecto (desde catálogos) y en el
   anexo matrices por factor con IN, EX, MO…
8. [ ] **Interferencias**: filtrar a las trazas que pide el informe (el IA trae 23 filas de la traza de ductos; la app 66
   de todas las fichas) y expandir siglas en plural/de una letra ("Ds (3)").
9. [ ] **Anexos adjuntos**: visado, ficha del acueducto, Tablas 45–46 de obras en cruces de acueductos, monografía,
   movimiento de suelo, habilitaciones (cantera, agua, residuos), hojas de seguridad. Archivos que sube el usuario.
10. [ ] **Párrafo introductorio del PGA** (el extractor no lo lee del IA).
11. [ ] **Agrupadores del ambiente** 4.1–4.6 (medio inerte, climática, biótico, perceptual, patrimonial, socioeconómico)
    y subsecciones 1.1/1.2, 5.1–5.3.2.

## App (web)

- [ ] **Obras con cantidad** (ej. "Líneas de control 3" (2)"): la comparación suma las dos líneas (4.597 m) contra 2.300 m
  declarados por línea. Requiere migración (campo cantidad) y ajuste de `works_compare`.
- [ ] **Esqueletos de carga** en los ~20 lugares que todavía muestran "Cargando…" en texto (componente `Skeleton` ya existe).
- [ ] **Letra chica** (`text-xs`) en encabezados de la matriz y textos de ayuda (los componentes sin uso ya se borraron).
- [ ] **Tests de componentes**: no hay `@testing-library`; el arreglo de Enter repetido en `select-add.tsx` quedó sin test
  automático.
- [ ] **Zonas de ambiente** no se pueden crear desde el desplegable (necesitan textos): hoy solo desde Administración → Catálogos.
- [ ] Atributo nuevo de la matriz con el mismo **valor** que uno existente muestra la etiqueta anterior (se elige por valor).

## Worker / infraestructura

- [ ] **Velocidad de generación** (~8–10 min con 305 fotos): bajar fotos en paralelo y elegir el tamaño antes de armar el
  DOCX (hoy lo arma dos veces cuando supera 50 MB).
- [ ] **RAM de la PC del worker** (7,8 GB, quedaba 0,2 GB libre): el informe + LibreOffice compiten con el resto.
  Arranque: `powershell -ExecutionPolicy Bypass -File apps\worker\run_worker.ps1` (log en `apps/worker/worker.log`).
  Falta que arranque solo con Windows (tarea programada).
- [ ] `requeue_orphans` supone **un solo worker**; con varios, reclamar con marca de tiempo y vencimiento.
- [ ] **Escrituras no atómicas** en el worker: delete+insert de `layer_features` y de `gps_points`, y UPDATE de waypoints uno
  por uno (`poller.py`). Una falla a mitad deja estado parcial; pasarlas a una función SQL por trabajo.
- [ ] **Helpers duplicados** del worker: paginador en `poller._fetch_all`, `docs._all` y `figures.rows`; `render_template`
  de `docs.py` contra `text_template.fill_vars` (variable desconocida: vacío contra visible).
- [ ] **pytest y los tests SQL no corren en CI** (`deploy.yml` solo corre la web). Los SQL se corren a mano con MCP o SQL Editor.
- [ ] **Avisos de rendimiento** del linter: 59 claves foráneas sin índice, políticas permisivas duplicadas en catálogos,
  `mem_select` sin `(select auth.uid())`. Ninguno pesa con el volumen actual.
- [ ] **No dejar `next dev` corriendo al hacer `pnpm build`**: escriben los dos en `.next` y el build falla con
  "Cannot read properties of undefined (reading 'call')". Cerrar el dev antes (en Windows, a veces el proceso `node`
  queda vivo aunque se cierre la terminal).
- [ ] **Re-sembrar textos** con `apps/web/scripts/seed-texts.mjs` usa usuario admin (EIA_EMAIL/EIA_PASS); en esta sesión
  se actualizaron secciones, ambiente y medidas directo con service role.
