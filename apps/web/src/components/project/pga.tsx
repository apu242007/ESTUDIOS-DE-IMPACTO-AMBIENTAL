"use client";

import { useConfirm } from "@/components/confirm";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SelectAdd } from "@/components/select-add";
import { listImpacts, loadImpactCatalog } from "@/lib/data/impacts";
import { addMeasures, listMeasureLinks, listMeasures, listSelections, removeMeasures, updateSelection } from "@/lib/data/pga";
import { errMsg } from "@/lib/data/util";
import { fillVars, projectVars } from "@/lib/text-template";
import { STAGE_LABEL, groupByStage, suggestMeasures, type Measure } from "@/lib/pga";
import type { ProjectRow } from "@/lib/schemas";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Pga({ orgId, project }: { orgId: string; project: ProjectRow }) {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const pid = project.id;
  const { data: measures = [], isLoading } = useQuery({ queryKey: ["measures", orgId], queryFn: () => listMeasures(orgId) });
  const { data: links = [] } = useQuery({ queryKey: ["measure-links", orgId], queryFn: () => listMeasureLinks(orgId) });
  const { data: sel = new Map() } = useQuery({ queryKey: ["selections", pid], queryFn: () => listSelections(pid) });
  const { data: impacts = [] } = useQuery({ queryKey: ["impacts", pid], queryFn: () => listImpacts(pid) });
  const { data: cat } = useQuery({ queryKey: ["impact-catalog", orgId], queryFn: () => loadImpactCatalog(orgId) });

  const [stage, setStage] = useState("todas");
  const [q, setQ] = useState("");
  const [threshold, setThreshold] = useState("Moderado");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["selections", pid] });
    void qc.invalidateQueries({ queryKey: ["checklist", pid] });
  };
  const fail = (e: unknown) => toast.error(errMsg(e));
  const add = useMutation({ mutationFn: (ids: string[]) => addMeasures(pid, ids), onSuccess: refresh, onError: fail });
  const del = useMutation({ mutationFn: (ids: string[]) => removeMeasures(pid, ids), onSuccess: refresh, onError: fail });
  const upd = useMutation({
    mutationFn: (a: { id: string; patch: { responsible?: string | null; timing?: string | null } }) => updateSelection(pid, a.id, a.patch),
    onSuccess: refresh,
    onError: fail,
  });

  const vars = useMemo(() => projectVars({ ...project, clientName: project.clients?.name }), [project]);
  const text = (m: Measure) => fillVars(m.body, vars);
  const generales = measures.filter((m) => m.general);
  const negCats = (cat?.categories ?? []).filter((c) => c.applies_to === "negativo").sort((a, b) => a.min_abs - b.min_abs);
  const groups = useMemo(() => {
    const f = measures.filter((m) => {
      if (stage !== "todas" && m.stage !== stage) return false;
      return !q.trim() || norm(`${m.body} ${m.action ?? ""} ${m.resource ?? ""}`).includes(norm(q));
    });
    return groupByStage(f);
  }, [measures, stage, q]);
  const elegidas = measures.filter((m) => !m.general && sel.has(m.id));
  const opciones = useMemo(() => ({
    responsible: [...new Set(measures.map((m) => m.responsible).filter((x): x is string => !!x))],
    timing: [...new Set(measures.map((m) => m.timing).filter((x): x is string => !!x))],
  }), [measures]);

  const sugerir = () => {
    const ids = suggestMeasures(measures, links, impacts.map((i) => ({ factor_id: i.factor_id, importance: i.importance, category: i.category })), cat?.categories ?? [], threshold);
    const nuevas = ids.filter((id) => !sel.has(id));
    if (ids.length === 0) return toast.info(impacts.length === 0 ? "Primero cargá la matriz de impactos." : `Ningún impacto llega a ${threshold}.`);
    if (nuevas.length === 0) return toast.info("Las medidas sugeridas ya están todas elegidas.");
    add.mutate(nuevas, { onSuccess: () => toast.success(`${nuevas.length} medidas agregadas según la matriz`) });
  };

  if (isLoading) return <p>Cargando…</p>;
  if (measures.length === 0) {
    return <p role="note" className="max-w-prose text-warn">Sección incompleta: no hay medidas en el catálogo. Un administrador las carga en Administración → Catálogos.</p>;
  }

  return (
    <div className="grid gap-6">
      <details className="rounded-xl border bg-card">
        <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 font-heading text-lg font-semibold">
          Medidas generales <Badge variant="secondary">{generales.length} · entran siempre</Badge>
        </summary>
        <ul className="grid gap-2 border-t p-4 pl-8">
          {generales.map((m) => <li key={m.id} className="list-disc text-base">{text(m)}</li>)}
        </ul>
      </details>

      <section aria-labelledby="part" className="grid gap-4">
        <h2 id="part" className="font-heading text-xl font-semibold">Medidas particulares</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Etapa</span>
            <NativeSelect className="w-60" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="todas">Todas las etapas</option>
              {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Buscar</span>
            <Input className="w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. residuos, fauna" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Sugerir desde impactos</span>
            <NativeSelect className="w-52" value={threshold} onChange={(e) => setThreshold(e.target.value)}>
              {negCats.map((c) => <option key={c.label} value={c.label}>{c.label} o mayor</option>)}
            </NativeSelect>
          </label>
          <Button size="lg" variant="outline" disabled={add.isPending || negCats.length === 0} onClick={sugerir}>Sugerir según la matriz</Button>
          <Button variant="outline" disabled={elegidas.length === 0 || del.isPending} onClick={() => { void confirm({ title: `¿Quitar las ${elegidas.length} medidas elegidas?`, confirmLabel: "Quitar todas", danger: true }).then((ok) => ok && del.mutate(elegidas.map((m) => m.id))); }}>
            Quitar todas
          </Button>
        </div>
        <p className="tnum text-base text-muted-foreground" aria-live="polite">{elegidas.length} de {measures.length - generales.length} medidas elegidas.</p>

        {groups.length === 0 && <p className="text-muted-foreground">Ninguna medida coincide con el filtro.</p>}
        {groups.map((g) => (
          <div key={g.stage} className="grid gap-3">
            <h3 className="font-heading text-lg font-semibold">{STAGE_LABEL[g.stage] ?? "Sin etapa"}</h3>
            {g.actions.map((a) => (
              <Card key={a.action}>
                <CardContent className="grid gap-2 pt-3">
                  <p className="font-medium">{a.action}</p>
                  {a.items.map((m) => {
                    const on = sel.has(m.id);
                    return (
                      <label key={m.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-accent/60">
                        <input
                          type="checkbox"
                          className="mt-1 size-6 shrink-0 accent-primary"
                          checked={on}
                          onChange={() => (on ? del.mutate([m.id]) : add.mutate([m.id]))}
                        />
                        <span className="grid gap-1">
                          <span className="text-base">{text(m)}</span>
                          {m.resource && <span className="text-sm text-muted-foreground">Recurso afectado: {m.resource}</span>}
                        </span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="cuadro" className="grid gap-3">
        <h2 id="cuadro" className="font-heading text-xl font-semibold">Cuadro del PGA</h2>
        {elegidas.length === 0 ? (
          <p role="note" className="text-warn">Sección incompleta: todavía no elegiste medidas particulares.</p>
        ) : (
          <div className="rounded-xl border bg-card">
            {/* columnas proporcionales: el cuadro llena el ancho sin barra lateral; en el celular cada medida es una ficha */}
            <table className="table-cards w-full text-sm md:table-fixed">
              <colgroup>
                {[9, 13, 27, 12, 13, 13, 8, 5].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
              </colgroup>
              <caption className="sr-only">Medidas del Plan de Gestión Ambiental por etapa</caption>
              <thead>
                <tr className="border-b bg-muted text-left">
                  {["Etapa", "Acción", "Medida", "Recurso afectado", "Cronograma", "Responsable", "Seguimiento", ""].map((h, i) => (
                    <th key={i} scope="col" className="px-2 py-2 align-bottom font-semibold leading-tight">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupByStage(elegidas).flatMap((g) => g.actions.flatMap((a) => a.items.map((m) => {
                  const s = sel.get(m.id);
                  return (
                    <tr key={m.id} className="border-b align-top last:border-0">
                      <td data-label="Etapa" className="px-2 py-2">{STAGE_LABEL[g.stage] ?? "—"}</td>
                      <td data-label="Acción" className="px-2 py-2">{a.action}</td>
                      <td data-label="Medida" data-wide className="px-2 py-2">{text(m)}</td>
                      <td data-label="Recurso afectado" className="px-2 py-2">{m.resource ?? "—"}</td>
                      <td data-label="Cronograma" className="px-2 py-2">
                        <SelectAdd aria-label="Cronograma" className="h-11 w-full min-w-0 px-1.5 text-sm" value={s?.timing ?? m.timing ?? ""} onValue={(v) => upd.mutate({ id: m.id, patch: { timing: v || null } })} canAdd fields={["Cronograma"]} onAdd={async ([v]) => v}>
                          <option value="">—</option>
                          {[...new Set([...(s?.timing ? [s.timing] : []), ...(m.timing ? [m.timing] : []), ...opciones.timing])].map((o) => <option key={o} value={o}>{o}</option>)}
                        </SelectAdd>
                      </td>
                      <td data-label="Responsable" className="px-2 py-2">
                        <SelectAdd aria-label="Responsable" className="h-11 w-full min-w-0 px-1.5 text-sm" value={s?.responsible ?? m.responsible ?? ""} onValue={(v) => upd.mutate({ id: m.id, patch: { responsible: v || null } })} canAdd fields={["Responsable"]} onAdd={async ([v]) => v}>
                          <option value="">—</option>
                          {[...new Set([...(s?.responsible ? [s.responsible] : []), ...(m.responsible ? [m.responsible] : []), ...opciones.responsible])].map((o) => <option key={o} value={o}>{o}</option>)}
                        </SelectAdd>
                      </td>
                      <td data-label="Seguimiento" className="px-2 py-2">{m.follow_up ?? "—"}</td>
                      <td data-wide className="px-2 py-2 text-right">
                        <Button variant="outline" size="icon" aria-label={`Quitar la medida: ${text(m).slice(0, 60)}`} title="Quitar medida" disabled={del.isPending}
                          onClick={() => void confirm({ title: "¿Quitar esta medida del PGA?", details: [text(m).slice(0, 140)], confirmLabel: "Quitar", danger: true }).then((ok) => ok && del.mutate([m.id]))}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
