"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import "maplibre-gl/dist/maplibre-gl.css";
import { listMapFeatures, type MapFeature } from "@/lib/data/features";

type Pos = [number, number];

/** Recorre cualquier coordenada anidada y devuelve los pares [lon, lat]. */
function positions(c: unknown, out: Pos[] = []): Pos[] {
  if (Array.isArray(c)) {
    if (typeof c[0] === "number" && typeof c[1] === "number") out.push([c[0], c[1]]);
    else c.forEach((x) => positions(x, out));
  }
  return out;
}

const SRC = "proyecto";

export function Mapa({ projectId }: { projectId: string }) {
  const el = useRef<HTMLDivElement>(null);
  const { data: feats = [], isLoading } = useQuery({
    queryKey: ["map", projectId],
    queryFn: () => listMapFeatures(projectId),
  });

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled) return;
      const collection = {
        type: "FeatureCollection" as const,
        features: feats.map((f: MapFeature) => ({
          type: "Feature" as const,
          geometry: f.geojson,
          properties: { name: f.name ?? "", src: f.src },
        })),
      };
      const m = new maplibre.Map({
        container: node,
        center: [-68.6, -38.1],
        zoom: 8,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      map = m;
      m.addControl(new maplibre.NavigationControl(), "top-right");
      m.on("load", () => {
        m.addSource(SRC, { type: "geojson", data: collection as never });
        m.addLayer({ id: "poligonos", type: "fill", source: SRC, filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#2563eb", "fill-opacity": 0.25 } });
        m.addLayer({ id: "lineas", type: "line", source: SRC, filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]],
          paint: { "line-color": "#dc2626", "line-width": 3 } });
        m.addLayer({ id: "puntos", type: "circle", source: SRC, filter: ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]],
          paint: { "circle-radius": 6, "circle-color": ["case", ["==", ["get", "src"], "pozo"], "#16a34a", "#f59e0b"],
            "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

        const all = feats.flatMap((f) => positions((f.geojson as { coordinates?: unknown }).coordinates));
        if (all.length) {
          const b = new maplibre.LngLatBounds(all[0], all[0]);
          all.forEach((p) => b.extend(p));
          m.fitBounds(b, { padding: 40, maxZoom: 16, duration: 0 });
        }
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [feats]);

  return (
    <div className="grid gap-2">
      <div ref={el} className="h-[28rem] w-full rounded-lg border sm:h-[34rem]" aria-label="Mapa del proyecto" />
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Cargando…" : feats.length === 0 ? "Todavía no hay capas ni pozos para mostrar." : `${feats.length} elementos.`}
        {" "}Rojo: líneas · Amarillo: puntos de capa · Verde: pozos.
      </p>
    </div>
  );
}
