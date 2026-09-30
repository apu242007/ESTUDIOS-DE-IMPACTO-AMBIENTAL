"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listSectionOverrides, listTextBlocks, saveSectionText } from "@/lib/data/texts";
import { errMsg } from "@/lib/data/util";
import type { ProjectRow } from "@/lib/schemas";
import { fillVars, projectVars, unresolved } from "@/lib/text-template";
import { TextoEditable } from "./texto-editable";

/** Secciones narrativas del informe (resumen, ubicación y descripción, identificación de impactos, referencias). */
export function Textos({ orgId, project }: { orgId: string; project: ProjectRow }) {
  const qc = useQueryClient();
  const { data: blocks = [], isLoading } = useQuery({ queryKey: ["blocks", orgId, "seccion"], queryFn: () => listTextBlocks(orgId, "seccion") });
  const { data: overrides = new Map<string, string>() } = useQuery({ queryKey: ["sec-overrides", project.id], queryFn: () => listSectionOverrides(project.id) });
  const save = useMutation({
    mutationFn: (a: { key: string; body: string | null }) => saveSectionText(project.id, a.key, a.body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sec-overrides", project.id] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const vars = useMemo(() => projectVars({ ...project, clientName: project.clients?.name }), [project]);
  const chapters = useMemo(() => {
    const g = new Map<string, typeof blocks>();
    for (const b of blocks) {
      const cap = (b.title ?? b.key).split(" / ")[0];
      g.set(cap, [...(g.get(cap) ?? []), b]);
    }
    return [...g.entries()];
  }, [blocks]);

  if (isLoading) return <p>Cargando…</p>;
  if (blocks.length === 0) {
    return (
      <p role="note" className="max-w-prose text-warn">
        Sección incompleta: no hay textos base en el catálogo. Un administrador los carga en Administración → Catálogos.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-base text-muted-foreground">
        Textos de las secciones del informe. Vienen del catálogo con los datos del proyecto ya puestos; ajustá lo que cambie en este proyecto.
      </p>
      {chapters.map(([cap, list], ci) => (
        <details key={cap} className="rounded-xl border bg-card" open={ci === 0}>
          <summary className="flex min-h-14 cursor-pointer items-center px-4 font-heading text-lg font-semibold">{cap}</summary>
          <div className="grid gap-6 border-t p-4">
            {list.map((b) => {
              const sub = (b.title ?? "").includes(" / ") ? (b.title ?? "").split(" / ").slice(1).join(" / ") : null;
              const faltan = unresolved(b.template, vars);
              return (
                <div key={b.key} className="grid gap-2">
                  {sub && <h3 className="font-heading text-base font-semibold">{sub}</h3>}
                  <TextoEditable
                    id={`sec-${b.key}`}
                    label={sub ?? cap}
                    base={fillVars(b.template, vars)}
                    override={overrides.get(b.key) ?? null}
                    rows={7}
                    onSave={(body) => save.mutate({ key: b.key, body })}
                  />
                  {faltan.length > 0 && (
                    <p role="alert" className="text-sm text-destructive">Variables sin resolver: {faltan.map((v) => `{${v}}`).join(", ")}.</p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
