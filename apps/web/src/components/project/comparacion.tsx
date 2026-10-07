"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { NumCell } from "@/components/project/alcance";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import type { SectionId } from "@/lib/checklist";
import { setThresholds } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { workKindLabel, type WorkKind } from "@/lib/alcance-parser";
import { listCompare } from "@/lib/data/features";
import { deleteWork, updateWork, type WorkPatch } from "@/lib/data/works";
import { thresholdsSchema, verdict, type Thresholds, type Verdict } from "@/lib/threshold";

const fmt = (n: number | null, d = 1) => (n === null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: d }));
const sign = (n: number | null, d = 1) => (n === null ? "—" : `${n > 0 ? "+" : ""}${fmt(n, d)}`);

const badge: Record<Verdict, { label: string; variant: "default" | "destructive" | "outline" }> = {
  dentro: { label: "Dentro del umbral", variant: "default" },
  fuera: { label: "Fuera del umbral", variant: "destructive" },
  sin_dato: { label: "Sin dato", variant: "outline" },
};

/** Umbral del proyecto editable acá mismo: antes solo se mostraba y no había dónde cambiarlo. */
function Umbral({ projectId, thresholds }: { projectId: string; thresholds: Thresholds }) {
  const qc = useQueryClient();
  const [pct, setPct] = useState(String(thresholds.pct));
  const [abs, setAbs] = useState(String(thresholds.abs_m));
  const nuevo = { pct: Number(pct.replace(",", ".")), abs_m: Number(abs.replace(",", ".")) };
  const valido = thresholdsSchema.safeParse(nuevo).success && pct.trim() !== "" && abs.trim() !== "";
  const cambio = nuevo.pct !== thresholds.pct || nuevo.abs_m !== thresholds.abs_m;
  const guardar = useMutation({
    mutationFn: () => setThresholds(projectId, nuevo),
    onSuccess: () => {
      toast.success("Umbral guardado");
      for (const k of [["project", projectId], ["works-compare", projectId], ["checklist", projectId], ["control", projectId], ["projects"]]) {
        void qc.invalidateQueries({ queryKey: k });
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form
      className="flex flex-wrap items-end gap-3 border bg-card p-3"
      onSubmit={(e) => { e.preventDefault(); if (valido && cambio) guardar.mutate(); }}
    >
      <p className="basis-full text-sm text-muted-foreground">
        Una obra está dentro del umbral si la diferencia cumple el porcentaje <strong>o</strong> los metros (basta uno).
        En superficies solo cuenta el porcentaje.
      </p>
      <label className="grid gap-1 text-sm">
        <span>Porcentaje (%)</span>
        <Input className="h-11 w-28" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} aria-invalid={!valido} />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Metros (m)</span>
        <Input className="h-11 w-28" inputMode="decimal" value={abs} onChange={(e) => setAbs(e.target.value)} aria-invalid={!valido} />
      </label>
      <Button type="submit" size="lg" disabled={!valido || !cambio || guardar.isPending}>Guardar umbral</Button>
      {!valido && <p role="alert" className="basis-full text-sm text-destructive">Ingresá números iguales o mayores que cero.</p>}
    </form>
  );
}

export function Comparacion({ projectId, thresholds, onGo }: { projectId: string; thresholds: Thresholds; onGo: (s: SectionId) => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["works-compare", projectId], queryFn: () => listCompare(projectId) });
  // editar o quitar una obra desde acá mismo (mismos datos que Alcance)
  const refrescar = () => {
    for (const k of [["works-compare", projectId], ["works", projectId], ["checklist", projectId], ["control", projectId], ["projects"]]) {
      void qc.invalidateQueries({ queryKey: k });
    }
  };
  const save = useMutation({
    mutationFn: (a: { id: string; patch: WorkPatch }) => updateWork(a.id, a.patch),
    onSuccess: refrescar,
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({ mutationFn: deleteWork, onSuccess: () => { toast.success("Obra quitada"); refrescar(); }, onError: (e) => toast.error(errMsg(e)) });

  return (
    <div className="grid gap-3">
      <Umbral key={`${thresholds.pct}-${thresholds.abs_m}`} projectId={projectId} thresholds={thresholds} />
      <p className="text-sm text-muted-foreground">
        Lo declarado y la cantidad se corrigen acá o en Alcance; el calculado sale de la capa vinculada a la obra.
      </p>
      <Card>
        <CardContent className="p-2">
          <table className="table-cards w-full text-sm md:table-fixed">
            <colgroup>
              {[21, 9, 7, 12, 11, 10, 8, 16, 6].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr className="text-left text-muted-foreground">
                {["Obra", "Tipo", "Cant.", "Declarado por unidad", "Calculado", "Diferencia", "%", "Estado", ""].map((h, i) => (
                  <th key={i} className="p-1.5 align-bottom font-medium leading-tight">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="p-4">Cargando…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin obras en el alcance.</td></tr>
              )}
              {rows.map((r, idx) => {
                const isArea = r.declared_length_m === null && r.declared_area_m2 !== null;
                const declared = isArea ? r.declared_area_m2 : r.declared_length_m;
                const measured = isArea ? r.geom_area_m2 : r.geom_length_m;
                const diff = isArea ? r.diff_area_m2 : r.diff_length_m;
                const pct = isArea ? r.diff_area_pct : r.diff_length_pct;
                const unit = isArea ? "m²" : "m";
                const unidad = (isArea ? r.declared_unit_area_m2 : r.declared_unit_length_m) ?? null;
                // el umbral absoluto está en metros: para superficies solo aplica el porcentaje
                const v = verdict(declared, measured, isArea ? { pct: thresholds.pct, abs_m: 0 } : thresholds);
                return (
                  <tr key={r.id} className="enter border-t align-middle" style={{ "--i": Math.min(idx, 12) } as React.CSSProperties}>
                    <td data-label="Obra" data-wide className="p-1.5 font-medium">{r.name}</td>
                    <td data-label="Tipo" className="p-1.5">{workKindLabel[r.kind as WorkKind] ?? r.kind}</td>
                    <td data-label="Cantidad" className="p-1.5">
                      <NativeSelect className="h-11 w-full min-w-0 px-1.5 text-sm" aria-label={`Cantidad de ${r.name}`} value={r.quantity}
                        onChange={(e) => save.mutate({ id: r.id, patch: { quantity: Number(e.target.value) } })}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                      </NativeSelect>
                    </td>
                    <td data-label={`Declarado por unidad (${unit})`} className="p-1.5">
                      <NumCell key={`${r.id}-${unidad}`} value={unidad} label={`Declarado de ${r.name} (${unit})`}
                        onSave={(n) => save.mutate({ id: r.id, patch: isArea ? { declared_area_m2: n } : { declared_length_m: n } })} />
                    </td>
                    <td data-label="Calculado" className="p-1.5 tnum font-mono">
                      {measured === null ? <span className="font-sans text-muted-foreground">sin geometría</span> : `${fmt(measured)} ${unit}`}
                      {r.quantity > 1 && declared !== null && <span className="block font-sans text-xs text-muted-foreground">vs {fmt(declared)} {unit} ({r.quantity} ×)</span>}
                    </td>
                    <td data-label="Diferencia" className="p-1.5 tnum font-mono">{diff === null ? "—" : `${sign(diff)} ${unit}`}</td>
                    <td data-label="%" className="p-1.5 tnum font-mono">{pct === null ? "—" : `${sign(pct, 2)} %`}</td>
                    <td data-label="Estado" className="p-1.5">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge variant={badge[v].variant}>{badge[v].label}</Badge>
                        {measured === null && (
                          <button type="button" onClick={() => onGo("capas")} className="text-sm font-bold text-primary underline-offset-4 hover:underline">
                            Vincular capa
                          </button>
                        )}
                      </span>
                    </td>
                    <td data-wide className="p-1.5 text-right">
                      <Button variant="outline" size="icon" aria-label={`Quitar ${r.name}`} title="Quitar obra"
                        onClick={() => void confirm({ title: `¿Quitar “${r.name}” del alcance?`, confirmLabel: "Quitar", danger: true }).then((ok) => ok && del.mutate(r.id))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
