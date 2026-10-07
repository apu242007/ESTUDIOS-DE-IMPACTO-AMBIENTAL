"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SectionId } from "@/lib/checklist";
import { deleteGabineteWaypoint, loadInterferencias } from "@/lib/data/interferencias";
import { errMsg } from "@/lib/data/util";
import { toCsv } from "@/lib/interferencias";
import { Cruces } from "./cruces";

export function Interferencias({ orgId, projectId, onGo }: { orgId: string; projectId: string; onGo: (s: SectionId) => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["interferencias", projectId],
    queryFn: () => loadInterferencias(orgId, projectId),
  });
  const quitar = useMutation({
    mutationFn: (a: { id: string; lineId: string }) => deleteGabineteWaypoint(a.id, a.lineId),
    onSuccess: () => {
      toast.success("Cruce quitado");
      for (const k of [["interferencias", projectId], ["relevamiento-fichas", projectId], ["checklist", projectId], ["control", projectId]]) {
        void qc.invalidateQueries({ queryKey: k });
      }
    },
    onError: (e) => toast.error(errMsg(e)),
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
        <CardContent className="p-0">
          <table className="table-cards w-full text-sm md:table-fixed lg:text-base">
            <caption className="sr-only">Tabla de interferencias</caption>
            {/* columnas fijas: las cifras no se cortan y la descripción usa el resto, en renglones */}
            <colgroup>
              {[12, 13, 13, 9, 9, 6, 32, 6].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr className="border-b bg-muted text-left">
                {["Figura", "Latitud", "Longitud", "X", "Y", "Cota", "Descripción", ""].map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
                  <td data-wide className="px-2 py-2 text-right">
                    {/* gabinete: el cruce salió de las capas y se quita acá; campo: se edita en su ficha (sincroniza el teléfono) */}
                    {data.gabinete.has(r.lineId) ? (
                      <Button variant="outline" size="icon" aria-label={`Quitar el cruce ${r.descripcion.slice(0, 40)}`} title="Quitar cruce" disabled={quitar.isPending}
                        onClick={() => void confirm({ title: "¿Quitar este cruce de gabinete?", details: [r.descripcion], confirmLabel: "Quitar", danger: true }).then((ok) => ok && quitar.mutate({ id: r.id, lineId: r.lineId }))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" aria-label={`Editar el waypoint ${r.number ?? ""} en Relevamiento`} title="Editar en Relevamiento" onClick={() => onGo("relevamiento")}>
                        <Pencil aria-hidden="true" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
