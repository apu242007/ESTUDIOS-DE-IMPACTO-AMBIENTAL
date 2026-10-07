"use client";

import { useConfirm } from "@/components/confirm";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  parseAlcance,
  workKindLabel,
  workKinds,
  type ParsedWork,
  type WorkKind,
} from "@/lib/alcance-parser";
import { errMsg } from "@/lib/data/util";
import {
  addWorks,
  deleteWork,
  listWorks,
  stageLabel,
  stages,
  updateWork,
  type Stage,
  type WorkPatch,
  type WorkRow,
} from "@/lib/data/works";

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }));
const toNum = (v: string): number | null => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function NumCell({
  value,
  label,
  onSave,
}: {
  value: number | null;
  label: string;
  onSave: (v: number | null) => void;
}) {
  return (
    <Input
      className="h-11 w-full min-w-0 px-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      type="number"
      step="any"
      min={0}
      defaultValue={value ?? ""}
      aria-label={label}
      onBlur={(e) => {
        const n = toNum(e.target.value);
        if (Number.isNaN(n)) return;
        if (n !== value) onSave(n);
      }}
    />
  );
}

function TextCell({
  value,
  label,
  onSave,
  className,
}: {
  value: string | null;
  label: string;
  onSave: (v: string | null) => void;
  className?: string;
}) {
  return (
    <Input
      className={className ?? "h-11"}
      defaultValue={value ?? ""}
      aria-label={label}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== (value ?? "")) onSave(v === "" ? null : v);
      }}
    />
  );
}

export function Alcance({ projectId }: { projectId: string }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const key = ["works", projectId];
  const { data: works = [], isLoading } = useQuery({ queryKey: key, queryFn: () => listWorks(projectId) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast.error(errMsg(e));

  const upd = useMutation({
    mutationFn: (a: { id: string; patch: WorkPatch }) => updateWork(a.id, a.patch),
    onSuccess: refresh,
    onError: fail,
  });
  const del = useMutation({ mutationFn: deleteWork, onSuccess: refresh, onError: fail });
  const add = useMutation({
    mutationFn: (rows: ParsedWork[]) => addWorks(projectId, rows, works.at(-1)?.sort_order ?? 0),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["works-compare", projectId] });
    },
    onError: fail,
  });

  const [importing, setImporting] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedWork[]>([]);
  const save = (w: WorkRow, patch: WorkPatch) => upd.mutate({ id: w.id, patch });

  const closeImport = () => {
    setImporting(false);
    setText("");
    setPreview([]);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          className="h-11"
          onClick={() =>
            add.mutate([
              { kind: "camino", name: "Nueva obra", declared_length_m: null, declared_area_m2: null, diameter_in: null, quantity: 1 },
            ])
          }
        >
          Agregar obra
        </Button>
        <Button size="lg" variant="outline" className="h-11" onClick={() => setImporting(true)}>
          Importar alcance desde texto
        </Button>
      </div>

      <Card>
        <CardContent className="p-2">
          {/* columnas proporcionales: la tabla llena el ancho sin barra lateral; en el celular cada obra es una ficha */}
          <table className="table-cards w-full text-sm md:table-fixed">
            <colgroup>
              {[11, 17, 6, 9, 6, 10, 10, 6, 9, 10, 6].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr className="text-left text-muted-foreground">
                {["Tipo", "Nombre", "Código", "Etapa", "Cant.", "Long. decl. (m)", "Sup. decl. (m²)", "Ø (pulg)", "Material", "Medido", ""].map((h) => (
                  <th key={h} className="p-1.5 align-bottom font-medium leading-tight">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="p-4">
                    Cargando…
                  </td>
                </tr>
              )}
              {!isLoading && works.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-muted-foreground">
                    Sin obras. Agregalas una por una o pegá el listado del alcance.
                  </td>
                </tr>
              )}
              {works.map((w) => (
                <tr key={w.id} className="border-t align-top">
                  <td data-label="Tipo" className="p-1.5">
                    <NativeSelect
                      className="h-11 w-full min-w-0 px-1.5 text-sm"
                      aria-label="Tipo de obra"
                      value={w.kind}
                      onChange={(e) => save(w, { kind: e.target.value as WorkKind })}
                    >
                      {workKinds.map((k) => (
                        <option key={k} value={k}>
                          {workKindLabel[k]}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td data-label="Nombre" data-wide className="p-1.5">
                    <TextCell className="h-11 w-full min-w-0 px-1.5 text-sm" value={w.name} label="Nombre" onSave={(v) => v && save(w, { name: v })} />
                  </td>
                  <td data-label="Código" className="p-1.5">
                    <TextCell className="h-11 w-full min-w-0 px-1.5 text-sm" value={w.code} label="Código" onSave={(v) => save(w, { code: v })} />
                  </td>
                  <td data-label="Etapa" className="p-1.5">
                    <NativeSelect
                      className="h-11 w-full min-w-0 px-1.5 text-sm"
                      aria-label="Etapa"
                      value={w.stage ?? ""}
                      onChange={(e) => save(w, { stage: (e.target.value || null) as Stage | null })}
                    >
                      <option value="">—</option>
                      {stages.map((s) => (
                        <option key={s} value={s}>
                          {stageLabel[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td data-label="Cantidad" className="p-1.5">
                    {/* obras iguales declaradas juntas ("2 líneas de control"): lo declarado es por unidad */}
                    <NativeSelect
                      className="h-11 w-full min-w-0 px-1.5 text-sm"
                      aria-label="Cantidad de obras iguales"
                      value={w.quantity}
                      onChange={(e) => save(w, { quantity: Number(e.target.value) })}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </NativeSelect>
                  </td>
                  <td data-label="Longitud declarada (m)" className="p-1.5">
                    <NumCell value={w.declared_length_m} label="Longitud declarada (por unidad)" onSave={(v) => save(w, { declared_length_m: v })} />
                  </td>
                  <td data-label="Superficie declarada (m²)" className="p-1.5">
                    <NumCell value={w.declared_area_m2} label="Superficie declarada" onSave={(v) => save(w, { declared_area_m2: v })} />
                  </td>
                  <td data-label="Diámetro (pulg)" className="p-1.5">
                    <NumCell value={w.diameter_in} label="Diámetro" onSave={(v) => save(w, { diameter_in: v })} />
                  </td>
                  <td data-label="Material" className="p-1.5">
                    <TextCell className="h-11 w-full min-w-0 px-1.5 text-sm" value={w.material} label="Material" onSave={(v) => save(w, { material: v })} />
                  </td>
                  <td data-label="Medido" className="p-1.5 whitespace-nowrap text-muted-foreground">
                    {w.geom_length_m !== null && `${fmt(w.geom_length_m)} m`}
                    {w.geom_area_m2 !== null && `${fmt(w.geom_area_m2)} m²`}
                    {w.geom_length_m === null && w.geom_area_m2 === null && "sin geometría"}
                  </td>
                  <td data-wide className="p-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Quitar ${w.name} del alcance`}
                      title="Quitar"
                      onClick={() => {
                        void confirm({ title: `¿Quitar “${w.name}” del alcance?`, confirmLabel: "Quitar", danger: true }).then((ok) => ok && del.mutate(w.id));
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={importing} onOpenChange={(o) => !o && closeImport()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Importar alcance desde texto</DialogTitle>
            <DialogDescription>
              Pegá el listado (uno por renglón o separado por “;”). Revisá lo propuesto antes de guardar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Locación 34.400 m²; Camino troncal 2.270 m; Línea de captación 8" 1.850 m'}
          />
          <div>
            <Button variant="outline" className="h-11" disabled={!text.trim()} onClick={() => setPreview(parseAlcance(text))}>
              Interpretar
            </Button>
          </div>
          {preview.length > 0 && (
            <div className="grid gap-2">
              {preview.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[11rem_1fr_7rem_7rem_5rem_auto] sm:items-center">
                  <NativeSelect
                    className="h-11"
                    aria-label="Tipo"
                    value={p.kind}
                    onChange={(e) =>
                      setPreview((rows) => rows.map((r, j) => (j === i ? { ...r, kind: e.target.value as WorkKind } : r)))
                    }
                  >
                    {workKinds.map((k) => (
                      <option key={k} value={k}>
                        {workKindLabel[k]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input
                    className="h-11"
                    aria-label="Nombre"
                    value={p.name}
                    onChange={(e) => setPreview((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  />
                  <span className="text-sm">{p.declared_length_m !== null ? `${fmt(p.declared_length_m)} m` : ""}</span>
                  <span className="text-sm">{p.declared_area_m2 !== null ? `${fmt(p.declared_area_m2)} m²` : ""}</span>
                  <span className="text-sm">{p.diameter_in !== null ? `${p.diameter_in}"` : ""}</span>
                  <Button variant="outline" onClick={() => setPreview((rows) => rows.filter((_, j) => j !== i))}>
                    Descartar
                  </Button>
                </div>
              ))}
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={add.isPending}
                onClick={() =>
                  add.mutate(
                    preview.filter((p) => p.name.trim()),
                    {
                      onSuccess: () => {
                        toast.success(`${preview.length} obras agregadas`);
                        closeImport();
                      },
                    },
                  )
                }
              >
                Guardar {preview.length} obras
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
