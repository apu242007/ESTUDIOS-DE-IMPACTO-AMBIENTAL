"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listProjects } from "@/lib/data/projects";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import {
  copyImpacts, deleteImpacts, listImpacts, loadImpactCatalog, saveImpacts, stageName, stageOrder,
  type ActionRow, type FactorRow, type ImpactCatalog, type ImpactInput, type ImpactRow, type StageKey,
} from "@/lib/data/impacts";
import { errMsg } from "@/lib/data/util";
import {
  ATTRS, ATTR_LABEL, categoryFor, importance, severityLevel, totalsByAction, weighted, type Attr, type Attrs, type Sign,
} from "@/lib/impacts";
import { cn } from "@/lib/utils";

const MEDIO: Record<string, string> = {
  fisico: "Medio inerte", biotico: "Medio biótico", perceptual: "Medio perceptual",
  cultural: "Medio sociocultural", socioeconomico: "Medio socioeconómico",
};
const MEDIO_ORDER = ["fisico", "biotico", "perceptual", "cultural", "socioeconomico"];

const fmt = (n: number, d = 0) => n.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (n: number, d = 0) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d);

/** Color por gravedad. Nunca es el único indicador: la celda muestra el valor y la inicial de la categoría. */
function tone(level: "positivo" | number | null): string {
  if (level === null) return "text-muted-foreground";
  if (level === "positivo") return "bg-primary/10 text-primary";
  if (level === 0) return "bg-ok/10 text-ok";
  if (level === 1) return "bg-warn/15 text-warn";
  if (level === 2) return "bg-destructive/15 text-destructive";
  return "bg-destructive text-white";
}

function CopyDialog({
  orgId, projectId, onClose, onDone,
}: { orgId: string; projectId: string; onClose: () => void; onDone: (n: number) => void }) {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects", orgId], queryFn: () => listProjects(orgId) });
  const otros = projects.filter((p) => p.id !== projectId);
  const [from, setFrom] = useState("");
  const copy = useMutation({
    mutationFn: () => copyImpacts(from, projectId),
    onSuccess: onDone,
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copiar la matriz de otro proyecto</DialogTitle>
          <DialogDescription>Se copian los signos y valores de cada celda. Las celdas que ya cargaste se reemplazan.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p>Cargando…</p>
        ) : otros.length === 0 ? (
          <p className="text-muted-foreground">No hay otros proyectos en la organización.</p>
        ) : (
          <NativeSelect aria-label="Proyecto de origen" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Elegí un proyecto…</option>
            {otros.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>
            ))}
          </NativeSelect>
        )}
        <Button size="lg" disabled={!from || copy.isPending} onClick={() => copy.mutate()}>
          {copy.isPending ? "Copiando…" : "Copiar matriz"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CellDialog({
  cat, factor, action, existing, onClose, onSave, onDelete, onApplyRow, onApplyColumn, busy,
}: {
  cat: ImpactCatalog;
  factor: FactorRow;
  action: ActionRow;
  existing: ImpactRow | undefined;
  onClose: () => void;
  onSave: (i: ImpactInput) => void;
  onDelete: () => void;
  onApplyRow: (i: Omit<ImpactInput, "action_id" | "factor_id">) => void;
  onApplyColumn: (i: Omit<ImpactInput, "action_id" | "factor_id">) => void;
  busy: boolean;
}) {
  const [sign, setSign] = useState<Sign>((existing?.sign as Sign) ?? -1);
  const [attrs, setAttrs] = useState<Attrs>(() =>
    Object.fromEntries(ATTRS.map((k) => [k, existing?.attrs[k] ?? cat.options[k][0]?.value ?? 0])) as Attrs,
  );
  const faltan = ATTRS.filter((k) => cat.options[k].length === 0);
  const imp = importance(sign, attrs);
  const categoria = categoryFor(imp, cat.categories);
  const pond = weighted(imp, factor.uip);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{factor.name}</DialogTitle>
          <DialogDescription>{action.name}</DialogDescription>
        </DialogHeader>

        {faltan.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            Faltan opciones en el catálogo para: {faltan.map((k) => ATTR_LABEL[k]).join(", ")}. Cargalas en Administración → Catálogos.
          </p>
        )}

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-muted-foreground">Signo del efecto</legend>
          <div className="grid grid-cols-2 gap-2">
            {([-1, 1] as Sign[]).map((s) => (
              <Button key={s} type="button" variant={sign === s ? "default" : "outline"} aria-pressed={sign === s} onClick={() => setSign(s)}>
                {s === -1 ? "Negativo (−)" : "Positivo (+)"}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          {ATTRS.map((k: Attr) => (
            <label key={k} className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                {ATTR_LABEL[k]} <span className="font-mono">({k})</span>
              </span>
              <NativeSelect value={attrs[k] ?? ""} onChange={(e) => setAttrs((a) => ({ ...a, [k]: Number(e.target.value) }))}>
                {cat.options[k].map((o) => (
                  <option key={o.label} value={o.value}>{o.label}</option>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>

        <div className="rounded-lg border bg-muted p-3" role="status" aria-live="polite">
          <p className="text-base">
            Importancia: <strong className="tnum font-mono text-lg">{signed(imp)}</strong>
            {categoria ? <> — categoría <strong>{categoria}</strong></> : null}
          </p>
          {pond !== null && <p className="tnum text-sm text-muted-foreground">Ponderada por UIP ({fmt(factor.uip ?? 0)}): {signed(pond, 2)}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={busy || faltan.length > 0} onClick={() => onSave({ action_id: action.id, factor_id: factor.id, sign, attrs })}>
            Guardar
          </Button>
          {existing && (
            <Button variant="outline" size="lg" disabled={busy} onClick={onDelete}>Quitar impacto</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button variant="outline" disabled={busy || faltan.length > 0} onClick={() => onApplyRow({ sign, attrs })}>
            Aplicar a todas las acciones de este factor
          </Button>
          <Button variant="outline" disabled={busy || faltan.length > 0} onClick={() => onApplyColumn({ sign, attrs })}>
            Aplicar a todos los factores de esta acción
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Impactos({ orgId, projectId }: { orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const key = ["impacts", projectId];
  const { data: cat, isLoading: l1 } = useQuery({ queryKey: ["impact-catalog", orgId], queryFn: () => loadImpactCatalog(orgId) });
  const { data: impacts = [], isLoading: l2 } = useQuery({ queryKey: key, queryFn: () => listImpacts(projectId) });
  const [stage, setStage] = useState<StageKey | "todas">("todas");
  const [open, setOpen] = useState<{ factorId: string; actionId: string } | null>(null);
  const [copying, setCopying] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["checklist", projectId] });
  };
  const fail = (e: unknown) => toast.error(errMsg(e));
  const save = useMutation({ mutationFn: (rows: ImpactInput[]) => saveImpacts(projectId, rows), onSuccess: refresh, onError: fail });
  const del = useMutation({ mutationFn: (ids: string[]) => deleteImpacts(ids), onSuccess: refresh, onError: fail });

  const byCell = useMemo(() => new Map(impacts.map((i) => [`${i.factor_id}|${i.action_id}`, i])), [impacts]);
  const actions = useMemo(
    () => (cat?.actions ?? []).filter((a) => stage === "todas" || a.stage === stage),
    [cat, stage],
  );
  const factorsByMedio = useMemo(() => {
    const g = new Map<string, FactorRow[]>();
    for (const f of cat?.factors ?? []) g.set(f.medio, [...(g.get(f.medio) ?? []), f]);
    return MEDIO_ORDER.filter((m) => g.has(m)).map((m) => [m, g.get(m)!] as const);
  }, [cat]);
  const totals = useMemo(
    () =>
      totalsByAction(
        impacts.map((i) => ({ actionId: i.action_id, factorId: i.factor_id, importance: i.importance ?? 0 })),
        new Map((cat?.factors ?? []).map((f) => [f.id, f.uip])),
      ),
    [impacts, cat],
  );

  if (l1 || l2) return <p>Cargando…</p>;
  if (!cat || cat.actions.length === 0 || cat.factors.length === 0) {
    return (
      <p role="note" className="max-w-prose text-base text-warn">
        Sección incompleta: faltan las acciones y los factores en el catálogo. Un administrador los carga en Administración → Catálogos.
      </p>
    );
  }

  const openFactor = cat.factors.find((f) => f.id === open?.factorId);
  const openAction = cat.actions.find((a) => a.id === open?.actionId);
  const stageGroups = stageOrder.map((s) => [s, actions.filter((a) => a.stage === s)] as const).filter(([, l]) => l.length > 0);
  const sinEtapa = actions.filter((a) => !a.stage || !(stageOrder as readonly string[]).includes(a.stage));
  const orderedActions = [...stageGroups.flatMap(([, l]) => l), ...sinEtapa];
  const negCats = cat.categories.filter((c) => c.applies_to === "negativo").sort((a, b) => a.min_abs - b.min_abs);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Etapa</span>
          <NativeSelect className="w-64" value={stage} onChange={(e) => setStage(e.target.value as StageKey | "todas")}>
            <option value="todas">Todas las etapas</option>
            {stageOrder.map((s) => <option key={s} value={s}>{stageName[s]}</option>)}
          </NativeSelect>
        </label>
        <Button variant="outline" onClick={() => setCopying(true)}>Copiar de otro proyecto</Button>
        <Button
          variant="outline"
          disabled={impacts.length === 0 || del.isPending}
          onClick={() => {
            if (window.confirm(`¿Limpiar toda la matriz del proyecto (${impacts.length} impactos)?`)) del.mutate(impacts.map((i) => i.id));
          }}
        >
          Limpiar matriz
        </Button>
        <p className="tnum text-base text-muted-foreground">{impacts.length} {impacts.length === 1 ? "impacto cargado" : "impactos cargados"}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="min-w-full border-collapse text-sm">
          <caption className="sr-only">Matriz de impactos: factores del medio por acciones del proyecto</caption>
          <thead>
            <tr className="border-b bg-muted">
              <th scope="col" rowSpan={2} className="sticky left-0 z-10 min-w-56 bg-muted px-3 py-2 text-left font-semibold">Factor</th>
              {stageGroups.map(([s, list]) => (
                <th key={s} scope="colgroup" colSpan={list.length} className="border-l px-2 py-2 text-center font-semibold">{stageName[s]}</th>
              ))}
              {sinEtapa.length > 0 && <th scope="colgroup" colSpan={sinEtapa.length} className="border-l px-2 py-2 text-center font-semibold">Sin etapa</th>}
            </tr>
            <tr className="border-b bg-muted">
              {orderedActions.map((a) => (
                <th key={a.id} scope="col" className="w-24 min-w-24 border-l px-1 py-2 align-bottom text-xs font-medium leading-tight">
                  <span className="line-clamp-4 block" title={a.name}>{a.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorsByMedio.map(([medio, list]) => (
              <Fragment key={medio}>
                <tr className="bg-accent">
                  <th scope="rowgroup" colSpan={orderedActions.length + 1} className="sticky left-0 px-3 py-1.5 text-left text-sm font-semibold">
                    {MEDIO[medio] ?? medio}
                  </th>
                </tr>
                {list.map((f) => (
                  <tr key={f.id} className="border-b">
                    <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1 text-left font-normal">
                      <span className="block">{f.name}</span>
                      {f.uip !== null && <span className="tnum text-xs text-muted-foreground">UIP {fmt(f.uip)}</span>}
                    </th>
                    {orderedActions.map((a) => {
                      const im = byCell.get(`${f.id}|${a.id}`);
                      const level = im ? severityLevel(im.category, cat.categories) : null;
                      const label = im?.importance != null ? `${signed(im.importance)} ${im.category ?? ""}` : "sin impacto";
                      return (
                        <td key={a.id} className="border-l p-0.5">
                          <button
                            type="button"
                            onClick={() => setOpen({ factorId: f.id, actionId: a.id })}
                            aria-label={`${f.name}, ${a.name}: ${label}. Editar`}
                            className={cn(
                              "flex h-11 w-full min-w-11 cursor-pointer flex-col items-center justify-center rounded-md text-sm font-medium transition-colors hover:ring-2 hover:ring-ring",
                              tone(level),
                            )}
                          >
                            {im?.importance != null ? (
                              <>
                                <span className="tnum font-mono leading-none">{signed(im.importance)}</span>
                                <span aria-hidden="true" className="text-xs leading-none">{im.category?.[0] ?? ""}</span>
                              </>
                            ) : (
                              <span aria-hidden="true">+</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t-2 bg-muted font-medium">
              <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left">Total ponderado</th>
              {orderedActions.map((a) => {
                const t = totals.get(a.id);
                return (
                  <td key={a.id} className="tnum border-l px-1 py-2 text-center font-mono text-xs">
                    {t ? signed(t.relativo, 2) : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Referencias de color">
        {negCats.map((c, i) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("inline-block size-4 rounded", tone(i))} />
            {c.label} ({c.label[0]}): |I| {fmt(c.min_abs)}{c.max_abs === null ? " o más" : ` a ${fmt(c.max_abs)}`}
          </span>
        ))}
        {cat.categories.filter((c) => c.applies_to === "positivo").map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("inline-block size-4 rounded", tone("positivo"))} />
            {c.label} ({c.label[0]}): efecto positivo
          </span>
        ))}
      </div>

      {copying && (
        <CopyDialog
          orgId={orgId}
          projectId={projectId}
          onClose={() => setCopying(false)}
          onDone={(n) => {
            toast.success(n === 0 ? "El proyecto de origen no tiene impactos cargados" : `${n} impactos copiados`);
            setCopying(false);
            refresh();
          }}
        />
      )}

      {open && openFactor && openAction && (
        <CellDialog
          key={`${open.factorId}|${open.actionId}`}
          cat={cat}
          factor={openFactor}
          action={openAction}
          existing={byCell.get(`${open.factorId}|${open.actionId}`)}
          busy={save.isPending || del.isPending}
          onClose={() => setOpen(null)}
          onSave={(i) => save.mutate([i], { onSuccess: () => setOpen(null) })}
          onDelete={() => {
            const im = byCell.get(`${open.factorId}|${open.actionId}`);
            if (im) del.mutate([im.id], { onSuccess: () => setOpen(null) });
          }}
          onApplyRow={(v) => {
            if (window.confirm(`Se cargan estos valores en las ${cat.actions.length} acciones de “${openFactor.name}” (reemplaza las existentes). ¿Seguir?`)) {
              save.mutate(cat.actions.map((a) => ({ ...v, action_id: a.id, factor_id: openFactor.id })), { onSuccess: () => setOpen(null) });
            }
          }}
          onApplyColumn={(v) => {
            if (window.confirm(`Se cargan estos valores en los ${cat.factors.length} factores de “${openAction.name}” (reemplaza los existentes). ¿Seguir?`)) {
              save.mutate(cat.factors.map((f) => ({ ...v, action_id: openAction.id, factor_id: f.id })), { onSuccess: () => setOpen(null) });
            }
          }}
        />
      )}
    </div>
  );
}
