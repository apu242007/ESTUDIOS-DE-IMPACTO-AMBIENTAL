"use client";

import { EnCola } from "@/components/project/en-cola";
import { useConfirm } from "@/components/confirm";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { createWellsFromImport, linkFeature, listFeatures } from "@/lib/data/features";
import { errMsg } from "@/lib/data/util";
import { listWorks, type WorkRow } from "@/lib/data/works";
import {
  deleteImport,
  listLayerImports,
  requeueImport,
  statusLabel,
  uploadLayer,
  type ImportStatus,
  type LayerImport,
} from "@/lib/data/layers";
import { crsOptions, groupLayerFiles, layerExts } from "@/lib/layer-files";

const badgeVariant: Record<ImportStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  procesando: "secondary",
  listo: "default",
  incompleto: "outline",
  requiere_crs: "destructive",
  error: "destructive",
};

function CrsConfirm({ imp, onConfirm, busy }: { imp: LayerImport; onConfirm: (epsg: number) => void; busy: boolean }) {
  const [epsg, setEpsg] = useState<number>(crsOptions[0].epsg);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        className="h-12 w-full sm:w-72"
        aria-label="Sistema de coordenadas de la capa"
        value={epsg}
        onChange={(e) => setEpsg(Number(e.target.value))}
      >
        {crsOptions.map((o) => (
          <option key={o.epsg} value={o.epsg}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <Button size="lg" className="h-12" disabled={busy} onClick={() => onConfirm(epsg)}>
        Confirmar y procesar
      </Button>
      <span className="w-full text-sm text-muted-foreground">
        {imp.error ?? "La capa no trae sistema de coordenadas: confirmalo, no se asume."}
      </span>
    </div>
  );
}

function Elementos({ imp, projectId, works }: { imp: LayerImport; projectId: string; works: WorkRow[] }) {
  const qc = useQueryClient();
  const { data: feats = [], isLoading } = useQuery({ queryKey: ["features", imp.id], queryFn: () => listFeatures(imp.id) });
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["features", imp.id] });
    void qc.invalidateQueries({ queryKey: ["works", projectId] });
    void qc.invalidateQueries({ queryKey: ["works-compare", projectId] });
    void qc.invalidateQueries({ queryKey: ["map", projectId] });
  };
  const link = useMutation({
    mutationFn: (a: { id: string; workId: string | null }) => linkFeature(a.id, a.workId),
    onSuccess: refreshAll,
    onError: (e) => toast.error(errMsg(e)),
  });
  const wells = useMutation({
    mutationFn: () => createWellsFromImport(imp.id),
    onSuccess: (n) => {
      toast.success(n === 0 ? "No hay pozos nuevos para crear" : `${n} pozo(s) creados`);
      refreshAll();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const hasPoints = feats.some((f) => f.length_m === null && f.area_m2 === null);

  return (
    <div className="grid gap-2 border-t pt-3">
      {hasPoints && (
        <div>
          <Button variant="outline" className="h-12" disabled={wells.isPending} onClick={() => wells.mutate()}>
            Crear pozos desde esta capa
          </Button>
        </div>
      )}
      {isLoading && <p className="text-sm">Cargando elementos…</p>}
      {feats.map((f) => (
        <div key={f.id} className="grid gap-2 sm:grid-cols-[1fr_9rem_18rem] sm:items-center">
          <span className="text-sm font-medium">{f.name ?? "(sin nombre)"}</span>
          <span className="text-sm text-muted-foreground">
            {f.length_m !== null && `${f.length_m.toLocaleString("es-AR", { maximumFractionDigits: 1 })} m`}
            {f.area_m2 !== null && `${f.area_m2.toLocaleString("es-AR", { maximumFractionDigits: 0 })} m²`}
            {f.length_m === null && f.area_m2 === null && "punto"}
          </span>
          <NativeSelect
            className="h-12"
            aria-label={`Obra de ${f.name ?? "elemento"}`}
            value={f.work_id ?? ""}
            onChange={(e) => link.mutate({ id: f.id, workId: e.target.value || null })}
          >
            <option value="">Sin vincular</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
    </div>
  );
}

export function Capas({ orgId, projectId }: { orgId: string; projectId: string }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const key = ["layer-imports", projectId];
  const input = useRef<HTMLInputElement>(null);
  const { data: imports = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listLayerImports(projectId),
    // mientras el worker procesa, se refresca solo
    refetchInterval: (q) =>
      q.state.data?.some((i) => i.status === "pendiente" || i.status === "procesando") ? 4000 : false,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast.error(errMsg(e));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const { groups, ignored } = groupLayerFiles(files);
      if (ignored.length) toast.warning(`Se ignoraron: ${ignored.join(", ")}`);
      if (groups.length === 0) throw new Error("No hay ninguna capa válida (.shp, .kmz o .kml) en la selección.");
      for (const g of groups) await uploadLayer(orgId, projectId, g);
      return groups.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} capa(s) en cola de procesamiento`);
      refresh();
    },
    onError: fail,
  });
  const requeue = useMutation({
    mutationFn: (a: { id: string; epsg?: number }) => requeueImport(a.id, a.epsg),
    onSuccess: refresh,
    onError: fail,
  });
  const { data: works = [] } = useQuery({ queryKey: ["works", projectId], queryFn: () => listWorks(projectId) });
  const [open, setOpen] = useState<string | null>(null);
  const del = useMutation({ mutationFn: deleteImport, onSuccess: refresh, onError: fail });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={layerExts.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) upload.mutate(files);
          }}
        />
        <Button size="lg" className="h-12 text-base" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? "Subiendo…" : "Subir capas (SHP / KMZ / KML)"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Elegí todos los archivos de cada SHP juntos (.shp, .dbf, .shx, .prj). Si falta alguno se importa igual y se avisa.
        </p>
      </div>

      {isLoading && <p>Cargando…</p>}
      {!isLoading && imports.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin capas importadas.</p>
      )}

      {imports.map((imp) => (
        <Card key={imp.id}>
          <CardContent className="grid gap-3 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <strong className="text-base">{imp.base_name}</strong>
              <Badge variant="secondary">{imp.format.toUpperCase()}</Badge>
              <Badge variant={badgeVariant[imp.status]}>{statusLabel[imp.status]}</Badge>
              {imp.n_features !== null && <span className="text-sm">{imp.n_features} elementos</span>}
              {imp.crs_detected && <span className="text-sm text-muted-foreground">{imp.crs_detected}</span>}
            </div>

            {imp.missing.length > 0 && (
              <p className="text-sm text-warn">
                Faltan: {imp.missing.map((m) => `.${m}`).join(", ")}
              </p>
            )}

            {imp.status === "requiere_crs" && (
              <CrsConfirm imp={imp} busy={requeue.isPending} onConfirm={(epsg) => requeue.mutate({ id: imp.id, epsg })} />
            )}
            {imp.status === "pendiente" && <EnCola desde={imp.created_at} />}
            {imp.status === "error" && imp.error && (
              <p role="alert" className="text-sm text-destructive">
                {imp.error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(imp.status === "error" || imp.status === "listo" || imp.status === "incompleto") && (
                <Button variant="outline" className="h-12" onClick={() => requeue.mutate({ id: imp.id })}>
                  Reprocesar
                </Button>
              )}
              {(imp.status === "listo" || imp.status === "incompleto") && (
                <Button variant="outline" className="h-12" onClick={() => setOpen(open === imp.id ? null : imp.id)}>
                  {open === imp.id ? "Ocultar elementos" : "Ver elementos y vincular a obras"}
                </Button>
              )}
              <Button
                variant="outline"
                className="h-12"
                disabled={imp.status === "procesando"}
                onClick={() => {
                  void confirm({ title: `¿Quitar la capa “${imp.base_name}”?`, details: ["Se eliminan también sus elementos y las medidas calculadas."], confirmLabel: "Quitar", danger: true }).then((ok) => ok && del.mutate(imp));
                }}
              >
                Quitar
              </Button>
            </div>
            {open === imp.id && <Elementos imp={imp} projectId={projectId} works={works} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
