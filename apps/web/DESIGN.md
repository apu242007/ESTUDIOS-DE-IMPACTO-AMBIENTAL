---
name: EIA Pliego de campo
description: La app de la consultora como plano técnico: pliego, cajetín y marco de coordenadas Gauss-Krüger.
colors:
  tinta: "#1e1a16"
  piedra: "#f4f3ef"
  papel: "#ffffff"
  gris-texto: "#5c544b"
  linea: "#dcd6cc"
  borde-campo: "#7a7064"
  curva: "#9a5b26"
  hidrografia: "#1d5fa6"
  monte: "#2f7d3b"
  senal: "#f2b705"
  pendiente-texto: "#8a5a00"
  rojo: "#b42318"
  calor-1: "#dcebd9"
  calor-2: "#efd9a6"
  calor-3: "#d9772b"
  calor-4: "#b42318"
typography:
  rotulo:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3.6vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  rotulo-ancho:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
  cifra:
    fontFamily: "Archivo, Arial Narrow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  cuerpo:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.12rem"
  md: "0.16rem"
  lg: "0.2rem"
spacing:
  hoja: "1px"
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.hidrografia}"
    textColor: "{colors.papel}"
    rounded: "{rounded.lg}"
    height: "48px"
  button-tinta:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.lg}"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    height: "44px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    height: "44px"
  barra-superior:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    height: "56px"
  franja-siguiente:
    backgroundColor: "{colors.senal}"
    textColor: "{colors.tinta}"
    padding: "24px"
  cajetin-sello:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    padding: "8px 12px"
---

# Design System: EIA Pliego de campo

## Overview

La app es el plano técnico de la consultora ambiental. Cada proyecto es un **pliego**: un recuadro de tinta con su **cajetín** (el bloque de datos de un plano) y un **marco de coordenadas Gauss-Krüger** en el borde, como el margen de una carta del IGN. Los colores salen de la cartografía y el fondo es claro porque se trabaja al sol. Es una interfaz para operar: navegación y controles estándar; el mundo aporta tipografía, paleta, densidad y una sola firma (pliego, cajetín y marco).

Prioridad de uso: la oficina (armado del informe). El relevamiento de campo se mantiene despojado: botones grandes, sin tableros.

## Colors

### Primary
- **Hidrografía** `#1d5fa6`: acciones (botón principal, enlaces, foco). El azul del agua en las cartas.

### Secondary
- **Curva** `#9a5b26`: estructura gráfica: marcas del marco GK, expediente, trazos de la traza del relevamiento. Nunca texto largo.

### Tertiary
- **Señal** `#f2b705`: reservado. Solo la fase activa (marca deslizante de la línea de fases, tramo activo de la traza de cada hoja) y la franja del siguiente paso. Nunca como color de texto (no da contraste): para texto de pendiente se usa **pendiente-texto** `#8a5a00`.

### Neutral
- **Tinta** `#1e1a16`: texto, bordes del pliego y del cajetín, barra superior.
- **Piedra** `#f4f3ef`: fondo de página. **Papel** `#ffffff`: superficies de trabajo (pliego, hojas, campos).
- **Gris-texto** `#5c544b`: texto secundario (6,4:1 sobre piedra). **Línea** `#dcd6cc`: divisiones de 1 px. **Borde-campo** `#7a7064`: borde de inputs, visible al sol.

### Estados y datos
- **Monte** `#2f7d3b` listo / dentro del umbral. **Rojo** `#b42318` crítico / sin cruce GPS.
- Escala de calor de la matriz de impactos: `calor-1` → `calor-4` (compatible → crítico); positivo en `#dbe7f4`. Fuera del umbral en el perfil de desvíos: `calor-3`.

### Named Rules
- **Un solo amarillo por pantalla:** el amarillo señal marca dónde sigue el trabajo; si aparece en dos lugares que no son el paso activo, sobra uno.
- **Estado en forma y color:** punto, barra o hueco además del color (el hueco rojo en la traza, la barra divergente en el perfil).

## Typography

- **Archivo** (eje de ancho 62–125): títulos y cifras, expandido (`font-stretch` 112 % en encabezados, 125 % en el rótulo "EIA" y el título de Proyectos). Números tabulares para coordenadas, conteos y porcentajes; reemplaza a la monoespaciada.
- **Atkinson Hyperlegible Next**: toda la interfaz y el cuerpo; diseñada para legibilidad (sol, apuro, guantes).

### Hierarchy
- Título de página: Archivo 800, 2.5–3rem (Proyectos 125 %).
- Título del proyecto en el pliego: Archivo 800, 1.5rem en celular → 3rem en escritorio, máximo 24ch.
- Bloque del tablero: Archivo 700 a 100 % de ancho, 1.25rem, con regla de tinta de 1,5 px debajo.
- Cuerpo 16 px / 1.5; secundario 14 px en gris-texto.

### Named Rules
- **Sin etiquetas encima de títulos:** el dato va debajo o al lado (el expediente va en la línea de datos de la hoja, no arriba del nombre).
- **Siglas intactas:** al bajar a minúscula se baja solo la inicial ("cruce con el GPS").

## Layout

- Barra superior de tinta de 56 px con el rótulo y la escala gráfica; contenido hasta 96rem con 16 px de margen (32 px en escritorio).
- Proyectos: **índice de hojas**, grilla `auto-fill minmax(20rem, 1fr)` con 1 px entre hojas (cada hoja dibuja su línea).
- Proyecto: pliego arriba (título | cajetín de 21rem desde `lg`), línea de seis fases fija al bajar en escritorio, franja del siguiente paso a todo el ancho y tablero asimétrico `1.55fr / 1fr`; la matriz ocupa las dos columnas.
- Celular: el cajetín se pliega en una línea (expediente y avance); el marco muestra tres marcas; la navegación entre secciones va en la barra inferior.

## Elevation & Depth

Plano, como el papel: profundidad por bordes y reglas, no por sombras. El pliego y el cajetín llevan borde de tinta de 1,5 px; las hojas y bloques, líneas de 1 px. Los diálogos usan la sombra del sistema de componentes.

## Shapes

Radio mínimo (`--radius` 0.2rem). Esquinas casi rectas en botones, campos y hojas; el pliego y el cajetín son rectángulos de dibujo técnico.

## Components

### Buttons
Principal en hidrografía; "tinta" para la acción dentro de la franja amarilla; outline con borde-campo. Altura mínima 44 px (48 px en `lg`), texto en negrita.

### Chips
Filtros de estado en Proyectos: rectángulo de borde línea; activo en tinta con texto blanco y el conteo en cifra Archivo.

### Cards / Containers
No hay tarjetas genéricas. Contenedores con sentido: la **hoja** (índice), el **pliego** (proyecto) y el **bloque** del tablero (sin caja: título con regla de tinta).

### Inputs / Fields
Fondo papel, borde-campo de 1 px, 44 px de alto.

### Navigation
Barra superior con pestañas y marca amarilla bajo la activa; línea de fases con marca amarilla que se desliza (Motion, resorte corto, respeta reducir movimiento); barra inferior en el celular.

### Pliego (componente firma)
`PliegoHeader`: recuadro de tinta con el **marco GK** (marcas cada 500 m de Y este alrededor del centro del proyecto, `marcasEste`) y el **cajetín** (cliente, expediente, tipo, yacimiento, sistema y sello de avance en tinta).

### Tablero
Perfil de desvíos (barras divergentes con la franja del umbral, escala ±10 %), traza del relevamiento (waypoints en su posición GK real, norte arriba), interferencias por tipo (tira apilada) y matriz de calor (en celular, los impactos más fuertes en lista). SVG y CSS propios.

## Do's and Don'ts

### Do:
- Mostrar datos reales del proyecto; si falta, decirlo ("La matriz todavía está vacía").
- Reservar el amarillo para el paso activo.
- Usar cifras Archivo tabulares para coordenadas y conteos.
- Una sola animación orquestada por pantalla y movimiento que responda a acciones.

### Don't:
- Tarjetas idénticas con ícono, título y texto como estructura.
- Etiquetas o "eyebrows" encima de títulos.
- Bordes laterales gruesos de color en bloques o avisos.
- Caracteres Unicode o emoji como íconos (la flecha de norte es SVG).
- Volver a las curvas de nivel o al verde basalto del diseño anterior.
