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
- [ ] **Letra chica** (`text-xs`) en encabezados de la matriz y textos de ayuda; borrar `ui/select.tsx` y
  `ui/dropdown-menu.tsx` (sin uso).
- [ ] **Zonas de ambiente** no se pueden crear desde el desplegable (necesitan textos): hoy solo desde Administración → Catálogos.
- [ ] Atributo nuevo de la matriz con el mismo **valor** que uno existente muestra la etiqueta anterior (se elige por valor).

## Worker / infraestructura

- [ ] **Velocidad de generación** (~8–10 min con 305 fotos): bajar fotos en paralelo y elegir el tamaño antes de armar el
  DOCX (hoy lo arma dos veces cuando supera 50 MB).
- [ ] **RAM de la PC del worker** (7,8 GB, quedaba 0,2 GB libre): el informe + LibreOffice compiten con el resto.
  Arranque: `powershell -ExecutionPolicy Bypass -File apps\worker\run_worker.ps1` (log en `apps/worker/worker.log`).
  Falta que arranque solo con Windows (tarea programada).
- [ ] `requeue_orphans` supone **un solo worker**; con varios, reclamar con marca de tiempo y vencimiento.
- [ ] **Re-sembrar textos** con `apps/web/scripts/seed-texts.mjs` usa usuario admin (EIA_EMAIL/EIA_PASS); en esta sesión
  se actualizaron secciones, ambiente y medidas directo con service role.
