"use client";

import { EnCola } from "@/components/project/en-cola";
import { useConfirm } from "@/components/confirm";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteGps, gpsStatusLabel, listGpsImports, requeueGps, uploadGps, type GpsImport, type GpsStatus } from "@/lib/data/gps";
import { errMsg } from "@/lib/data/util";

const variant: Record<GpsStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  procesando: "secondary",
  listo: "default",
  error: "destructive",
};

const list = (xs: (string | number)[]) => xs.join(", ");
const nombre = (p: string) => p.split("/").pop() ?? p;

function Informe({ imp }: { imp: GpsImport }) {
  const r = imp.report;
  if (!r) return null;
  const items: { label: string; values: (string | number)[]; tone?: "warn" }[] = [
    { label: "Puntos GPS sin waypoint en el relevamiento", values: r.unmatched_points, tone: "warn" },
    { label: "Waypoints del relevamiento sin punto GPS", values: r.unmatched_waypoints, tone: "warn" },
    { label: "N° repetido en varias fichas (no se asignó, hay que resolverlo)", values: r.ambiguous, tone: "warn" },
    { label: "N° con varios puntos GPS (se usó el más reciente)", values: r.duplicates },
  ];
  const visibles = items.filter((i) => i.values.length > 0);
  if (visibles.length === 0) return <p className="text-sm text-muted-foreground">Sin observaciones: todo cruzó.</p>;
  return (
    <ul className="grid gap-1 text-sm">
      {visibles.map((i) => (
        <li key={i.label} className={i.tone === "warn" ? "text-warn" : "text-muted-foreground"}>
          <strong>{i.label}:</strong> {list(i.values)}
        </li>
      ))}
    </ul>
  );
}

export function Gps({ orgId, projectId }: { orgId: string; projectId: string }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const key = ["gps-imports", projectId];
  const input = useRef<HTMLInputElement>(null);
  const { data: imports = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listGpsImports(projectId),
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === "pendiente" || i.status === "procesando") ? 4000 : false),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["map", projectId] });
  };
  const fail = (e: unknown) => toast.error(errMsg(e));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await uploadGps(orgId, projectId, f);
      return files.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} archivo(s) en cola de procesamiento`);
      refresh();
    },
    onError: fail,
  });
  const requeue = useMutation({ mutationFn: requeueGps, onSuccess: refresh, onError: fail });
  const del = useMutation({ mutationFn: deleteGps, onSuccess: refresh, onError: fail });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".gdb,.gpx"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) upload.mutate(files);
          }}
        />
        <Button size="lg" className="h-12 text-base" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? "Subiendo…" : "Subir GPS (.gdb / .gpx)"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Se cruza por el N° del waypoint: el nombre del punto GPS (ej. “008”) con el N° de la ficha de campo. La posición
          del GPS de mano reemplaza a la del teléfono.
        </p>
      </div>

      {isLoading && <p>Cargando…</p>}
      {!isLoading && imports.length === 0 && <p className="text-sm text-muted-foreground">Sin archivos GPS importados.</p>}

      {imports.map((imp) => (
        <Card key={imp.id}>
          <CardContent className="grid gap-3 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <strong className="break-all text-base">{nombre(imp.file_path)}</strong>
              <Badge variant="secondary">{imp.file_kind.toUpperCase()}</Badge>
              <Badge variant={variant[imp.status]}>{gpsStatusLabel[imp.status]}</Badge>
              {imp.status === "listo" && (
                <span className="text-sm">
                  {imp.n_points ?? 0} puntos · <strong>{imp.n_matched ?? 0} cruzados</strong> · {imp.n_unmatched ?? 0} sin cruzar
                </span>
              )}
            </div>
            {imp.status === "pendiente" && <EnCola desde={imp.created_at} />}
            {imp.status === "error" && imp.error && (
              <p role="alert" className="text-sm text-destructive">
                {imp.error}
              </p>
            )}
            {imp.status === "listo" && <Informe imp={imp} />}
            <div className="flex flex-wrap gap-2">
              {(imp.status === "listo" || imp.status === "error") && (
                <Button variant="outline" className="h-12" onClick={() => requeue.mutate(imp.id)}>
                  {imp.status === "listo" ? "Volver a cruzar" : "Reintentar"}
                </Button>
              )}
              <Button
                variant="outline"
                className="h-12"
                disabled={imp.status === "procesando"}
                onClick={() => {
                  void confirm({ title: `¿Quitar “${nombre(imp.file_path)}”?`, details: ["Las posiciones ya cruzadas con los waypoints se conservan."], confirmLabel: "Quitar", danger: true }).then((ok) => ok && del.mutate(imp));
                }}
              >
                Quitar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
