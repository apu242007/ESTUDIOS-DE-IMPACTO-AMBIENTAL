# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo el personal profesional de la consultora ambiental que hace los estudios. La operadora (cliente, p. ej. Vista Energy) no tiene usuarios ni acceso: recibe únicamente el informe final. Roles: admin (aprueba versiones, ve catastro, administra catálogos y miembros) y miembro.

Dos escenas de uso, con prioridad confirmada en la oficina:

1. **Oficina (prioridad):** en la computadora, arma el informe: carga datos y alcance, importa capas del cliente, revisa resultados, completa contenido (matriz, ambiente, PGA), controla y entrega.
2. **Campo:** en el yacimiento (Neuquén), con el celular, al sol, con guantes y a menudo sin señal: fichas de relevamiento con waypoints y fotos.

## Product Purpose

Automatizar la producción de Informes Ambientales (IA) y Memorias Técnicas Descriptivas (MTD) de proyectos petroleros: del alcance declarado y las capas SHP/KMZ del cliente, al relevamiento de campo offline, el cruce con el GPS de mano (.gdb Garmin), la tabla de interferencias, el anexo fotográfico y la entrega en Word y PDF con versiones y visado interno. Éxito: el profesional genera un informe completo y correcto sin redactar a mano lo que ya cargó.

## Positioning

Todo el texto del informe sale de lo que el profesional selecciona más catálogos y plantillas con variables: sin IA y sin inventar contenido. Lo que falta se marca "incompleto" en vez de rellenarse.

## Operating Context

- Proyecto de ejemplo real: PAD 58 (Vista Energy, Bajada del Palo Oeste), expediente 2947-26.
- Coordenadas en POSGAR 94 / Argentina faja 2 (EPSG:22182), convención argentina X = norte, Y = este; lat/long en grados-minutos-segundos.
- Ficha de relevamiento en papel como referencia de campo; siglas de leyenda (CR cruce, CC cauce, Q quiebre, CA camino de acceso…).
- Informe con carátula, datos generales, alcance, descripción de obras, tabla de interferencias, anexo fotográfico y anexo de archivos georreferenciados.

## Capabilities and Constraints

- Carga por selección (desplegables, chips, casillas, números, fechas); texto libre solo en "Observaciones" opcional.
- Relevamiento funciona sin conexión y sincroniza solo al volver la señal.
- UI en español (Argentina); botones grandes, alto contraste, funciona a 360 px.
- Web estática en GitHub Pages; auth en el cliente; la seguridad real es RLS en Supabase. Worker Python en una PC de la consultora genera capas, GPS, figuras y documentos.
- Genérica: cualquier operadora y proyecto; nada de un cliente queda fijo en el código.

## Evidence on Hand

Datos reales del proyecto PAD 58 en la base y en `fixtures/` (capas, GPS, fotos, fichas transcriptas). No hay testimonios, clientes públicos ni métricas de negocio: no inventarlos.

## Product Principles

1. No inventar: lo que no está cargado se muestra incompleto, nunca se rellena.
2. Elegir antes que escribir: cada dato se carga de la forma más rápida y con valores por defecto.
3. Lo que se revisa en pantalla es lo que recibe el cliente.
4. El campo no puede depender de la señal.

## Accessibility & Inclusion

Uso al sol y con guantes: contraste alto, objetivos táctiles grandes (44 px o más), legible a 360 px; respetar "reducir movimiento".
