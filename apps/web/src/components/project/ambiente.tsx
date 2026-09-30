"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NativeSelect } from "@/components/ui/native-select";
import { listEnvironment, listProjectEnvironment, saveEnvItem, setZone } from "@/lib/data/texts";
import { errMsg } from "@/lib/data/util";
import type { ProjectRow } from "@/lib/schemas";
import { fillVars, projectVars } from "@/lib/text-template";
import { cn } from "@/lib/utils";
import { TextoEditable } from "./texto-editable";

const SECTION_LABEL: Record<string, string> = {
  geologia: "Geología y geomorfología", suelos: "Suelos", hidrologia: "Topografía y drenaje", clima: "Clima",
  flora: "Flora", fauna: "Fauna", paisaje: "Paisaje", patrimonio: "Patrimonio", socioeconomico: "Medio socioeconómico", otro: "Otros",
};
const SECTION_ORDER = Object.keys(SECTION_LABEL);
const zoneName = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Ambiente({ orgId, project }: { orgId: string; project: ProjectRow }) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["environment", orgId], queryFn: () => listEnvironment(orgId) });
  const { data: rows = new Map() } = useQuery({ queryKey: ["project-env", project.id], queryFn: () => listProjectEnvironment(project.id) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["project-env", project.id] });
    void qc.invalidateQueries({ queryKey: ["checklist", project.id] });
  };
  const zone = useMutation({
    mutationFn: (z: string | null) => setZone(project.id, z),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["project", project.id] });
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const save = useMutation({
    mutationFn: (a: { id: string; patch: { included?: boolean; body_override?: string | null } }) => saveEnvItem(project.id, a.id, a.patch),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });

  const zones = useMemo(() => [...new Set(items.map((i) => i.zone_key))], [items]);
  const vars = useMemo(() => projectVars({ ...project, clientName: project.clients?.name }), [project]);
  const current = project.zone_key ?? "";
  const inZone = useMemo(() => items.filter((i) => i.zone_key === current), [items, current]);
  const groups = useMemo(() => {
    const g = new Map<string, typeof inZone>();
    for (const i of inZone) g.set(i.section, [...(g.get(i.section) ?? []), i]);
    return [...g.entries()].sort((a, b) => SECTION_ORDER.indexOf(a[0]) - SECTION_ORDER.indexOf(b[0]));
  }, [inZone]);
  const incluidos = inZone.filter((i) => rows.get(i.id)?.included ?? true).length;

  if (isLoading) return <p>Cargando…</p>;
  if (zones.length === 0) {
    return <p role="note" className="max-w-prose text-warn">Sección incompleta: no hay descripciones de ambiente en el catálogo.</p>;
  }

  return (
    <div className="grid gap-5">
      <label className="grid max-w-md gap-1 text-sm">
        <span className="text-muted-foreground">Zona del proyecto</span>
        <NativeSelect value={current} onChange={(e) => zone.mutate(e.target.value || null)}>
          <option value="">Elegí la zona…</option>
          {zones.map((z) => <option key={z} value={z}>{zoneName(z)}</option>)}
        </NativeSelect>
      </label>

      {!current ? (
        <p role="note" className="max-w-prose text-base text-warn">
          Sección incompleta: elegí la zona para cargar la descripción del ambiente. Se cargan todos los apartados tildados; destildá los que no apliquen.
        </p>
      ) : (
        <>
          <p className="tnum text-base text-muted-foreground">{incluidos} de {inZone.length} apartados incluidos en el informe.</p>
          {groups.map(([section, list]) => (
            <section key={section} aria-labelledby={`amb-${section}`} className="grid gap-3">
              <h2 id={`amb-${section}`} className="font-heading text-xl font-semibold">{SECTION_LABEL[section] ?? section}</h2>
              {list.map((it) => {
                const row = rows.get(it.id);
                const included = row?.included ?? true;
                return (
                  <div key={it.id} className={cn("rounded-xl border bg-card p-4", !included && "opacity-70")}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-6 accent-primary"
                        checked={included}
                        onChange={(e) => save.mutate({ id: it.id, patch: { included: e.target.checked } })}
                      />
                      <span className="font-heading text-lg font-semibold">{it.label}</span>
                    </label>
                    {included && (
                      <div className="mt-2">
                        <TextoEditable
                          id={`amb-${it.id}`}
                          label="Texto del apartado"
                          base={fillVars(it.body, vars)}
                          override={row?.body_override ?? null}
                          rows={8}
                          onSave={(body) => save.mutate({ id: it.id, patch: { body_override: body } })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
