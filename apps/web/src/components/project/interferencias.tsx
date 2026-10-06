"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadInterferencias } from "@/lib/data/interferencias";
import { toCsv } from "@/lib/interferencias";
import { Cruces } from "./cruces";

export function Interferencias({ orgId, projectId }: { orgId: string; projectId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["interferencias", projectId],
    queryFn: () => loadInterferencias(orgId, projectId),
  });

  const descargar = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([toCsv(data.rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "interferencias.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <p>Cargando…</p>;
  if (error || !data) {
    return (
      <p role="alert" className="text-destructive">
        No se pudo armar la tabla. {error instanceof Error ? error.message : ""}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" variant="outline" disabled={data.rows.length === 0} onClick={descargar}>
          <Download aria-hidden="true" />
          Descargar CSV
        </Button>
        <p className="tnum text-base text-muted-foreground">
          {data.rows.length} {data.rows.length === 1 ? "interferencia" : "interferencias"}
          {data.sinPosicion > 0 && (
            <span className="text-warn">
              {" "}
              · {data.sinPosicion} {data.sinPosicion === 1 ? "waypoint" : "waypoints"} sin posición: subí el GPS o tomá la
              posición desde el celular
            </span>
          )}
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        X es el norte e Y el este (POSGAR 94 faja 2, EPSG:22182). Latitud y longitud en WGS84.
      </p>

      <Cruces orgId={orgId} projectId={projectId} />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="table-cards w-full text-base md:min-w-[52rem] md:table-fixed">
            <caption className="sr-only">Tabla de interferencias</caption>
            {/* columnas fijas: las cifras no se cortan y la descripción usa el resto, en renglones */}
            <colgroup>
              <col className="w-36" />
              <col className="w-40" />
              <col className="w-40" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-20" />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted text-left">
                {["Figura", "Latitud", "Longitud", "X", "Y", "Cota", "Descripción"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Todavía no hay interferencias con posición. Se generan solas desde los waypoints del relevamiento que
                    tienen coordenadas.
                  </td>
                </tr>
              )}
              {data.rows.map((r, i) => (
                <tr key={r.id} className="enter border-b align-top last:border-0" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <td data-label="Figura" className="px-3 py-3 font-medium">{r.figura}</td>
                  <td data-label="Latitud" className="px-3 py-3 font-mono whitespace-nowrap">{r.lat}</td>
                  <td data-label="Longitud" className="px-3 py-3 font-mono whitespace-nowrap">{r.lon}</td>
                  <td data-label="X (norte)" className="px-3 py-3 font-mono">{r.x}</td>
                  <td data-label="Y (este)" className="px-3 py-3 font-mono">{r.y}</td>
                  <td data-label="Cota" className="px-3 py-3 font-mono">{r.cota ?? "—"}</td>
                  <td data-label="Descripción" data-wide className="px-3 py-3 [overflow-wrap:anywhere]">{r.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
