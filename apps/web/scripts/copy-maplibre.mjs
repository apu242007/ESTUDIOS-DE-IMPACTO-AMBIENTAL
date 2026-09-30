// MapLibre 6 carga su worker como módulo aparte (y este importa un módulo compartido por ruta relativa).
// Webpack no lo empaqueta, así que se sirve tal cual desde /maplibre/ y se indica con setWorkerUrl (components/project/mapa.tsx).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const dist = dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json"));
const out = join(process.cwd(), "public", "maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, "dist", f), join(out, f));
