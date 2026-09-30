"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listImpacts, loadImpactCatalog } from "@/lib/data/impacts";
import { listDeclarationOverrides, listTextBlocks, saveDeclaration } from "@/lib/data/texts";
import { errMsg } from "@/lib/data/util";
import type { ProjectRow } from "@/lib/schemas";
import { fillVars, projectVars, unresolved } from "@/lib/text-template";
import { TextoEditable } from "./texto-editable";

const fmtI = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

export function Declaracion({ orgId, project }: { orgId: string; project: ProjectRow }) {
  const qc = useQueryClient();
  const { data: cat } = useQuery({ queryKey: ["impact-catalog", orgId], queryFn: () => loadImpactCatalog(orgId) });
  const { data: impacts = [] } = useQuery({ queryKey: ["impacts", project.id], queryFn: () => listImpacts(project.id) });
  const { data: blocks = [], isLoading } = useQuery({ queryKey: ["blocks", orgId, "declaracion"], queryFn: () => listTextBlocks(orgId, "declaracion") });
  const { data: overrides = new Map<string, string>() } = useQuery({ queryKey: ["decl-overrides", project.id], queryFn: () => listDeclarationOverrides(project.id) });

  const save = useMutation({
    mutationFn: (a: { factorId: string; body: string | null }) => saveDeclaration(project.id, a.factorId, a.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["decl-overrides", project.id] });
      void qc.invalidateQueries({ queryKey: ["checklist", project.id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const vars = useMemo(() => projectVars({ ...project, clientName: project.clients?.name }), [project]);
  const byCode = useMemo(() => new Map(blocks.map((b) => [b.key, b])), [blocks]);
  const resumen = useMemo(() => {
    const m = new Map<string, { neg: number; pos: number; peor: { i: number; cat: string | null } | null }>();
    for (const i of impacts) {
      const r = m.get(i.factor_id) ?? { neg: 0, pos: 0, peor: null };
      const v = i.importance ?? 0;
      if (v < 0) {
        r.neg++;
        if (!r.peor || v < r.peor.i) r.peor = { i: v, cat: i.category };
      } else if (v > 0) r.pos++;
      m.set(i.factor_id, r);
    }
    return m;
  }, [impacts]);

  if (isLoading || !cat) return <p>Cargando…</p>;
  if (cat.factors.length === 0) {
    return <p role="note" className="max-w-prose text-warn">Sección incompleta: faltan los factores en el catálogo.</p>;
  }

  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-base text-muted-foreground">
        Una declaración por factor, armada con el texto base del catálogo. Ajustala para este proyecto si hace falta: solo se
        guarda lo que cambies.
      </p>
      {cat.factors.map((f) => {
        const b = byCode.get(`decl_${f.code}`);
        const r = resumen.get(f.id);
        const ov = overrides.get(f.id) ?? null;
        const base = b ? fillVars(b.template, vars) : "";
        const faltan = unresolved(b?.template ?? "", vars);
        return (
          <Card key={f.id}>
            <CardContent className="grid gap-3 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold">{b?.title ?? f.name}</h2>
                {r ? (
                  <>
                    <Badge variant="outline">{r.neg} {r.neg === 1 ? "negativo" : "negativos"}</Badge>
                    {r.pos > 0 && <Badge variant="outline">{r.pos} {r.pos === 1 ? "positivo" : "positivos"}</Badge>}
                    {r.peor && <span className="tnum text-sm text-muted-foreground">mayor: {fmtI(r.peor.i)} {r.peor.cat ?? ""}</span>}
                  </>
                ) : (
                  <span className="text-sm text-warn">Sin impactos cargados en la matriz</span>
                )}
              </div>
              {b ? (
                <TextoEditable
                  id={`decl-${f.code}`}
                  label="Declaración de impacto"
                  base={base}
                  override={ov}
                  onSave={(body) => save.mutate({ factorId: f.id, body })}
                />
              ) : (
                <p role="note" className="text-sm text-warn">Sección incompleta: no hay plantilla de declaración para este factor en el catálogo.</p>
              )}
              {faltan.length > 0 && (
                <p role="alert" className="text-sm text-destructive">Variables sin resolver en la plantilla: {faltan.map((v) => `{${v}}`).join(", ")}.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
