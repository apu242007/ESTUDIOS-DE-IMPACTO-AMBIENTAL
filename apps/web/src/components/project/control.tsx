"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CircleAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SectionId } from "@/lib/checklist";
import { counts, runControl, type Finding } from "@/lib/control";
import { loadControlData } from "@/lib/data/control";
import { getChecklist } from "@/lib/data/summary";
import type { ProjectRow } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const SECTION_NAME: Partial<Record<SectionId, string>> = {
  datos: "Datos", alcance: "Alcance", capas: "Capas", relevamiento: "Relevamiento", gps: "GPS", comparacion: "Comparación",
  mapa: "Mapa", interferencias: "Interferencias", fotos: "Fotos", impactos: "Impactos", declaracion: "Declaración", pga: "PGA",
  ambiente: "Ambiente", figuras: "Figuras", informe: "Informe", textos: "Textos",
};

function Item({ f, onGo }: { f: Finding; onGo: (s: SectionId) => void }) {
  const crit = f.severity === "critico";
  const Icon = crit ? CircleAlert : AlertTriangle;
  return (
    <li className={cn("flex flex-wrap items-start gap-3 rounded-xl border bg-card p-4", crit && "border-destructive/50")}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-6 shrink-0", crit ? "text-destructive" : "text-warn")} />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="text-base font-medium">
          <span className={cn("mr-2 text-sm font-semibold", crit ? "text-destructive" : "text-warn")}>{crit ? "Crítico" : "Advertencia"}</span>
          {f.title}
        </p>
        <p className="text-sm text-muted-foreground">{f.detail}</p>
      </div>
      <Button variant="outline" onClick={() => onGo(f.section)}>
        Ir a {SECTION_NAME[f.section] ?? f.section}
        <ArrowRight aria-hidden="true" />
      </Button>
    </li>
  );
}

export function Control({ orgId, project, onGo }: { orgId: string; project: ProjectRow; onGo: (s: SectionId) => void }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["control", project.id],
    queryFn: () => loadControlData(orgId, project),
    staleTime: 0,
  });

  // los pasos omitidos salen del mismo checklist que el Resumen (misma clave de caché)
  const { data: items = [] } = useQuery({ queryKey: ["checklist", project.id], queryFn: () => getChecklist(project) });

  if (isLoading) return <p>Revisando el proyecto…</p>;
  if (error || !data) return <p role="alert" className="text-destructive">No se pudo revisar el proyecto. {error instanceof Error ? error.message : ""}</p>;

  const skipped = items.filter((i) => i.skipped).map((i) => ({ id: i.id, label: i.label, detail: i.detail, section: i.section }));
  const hallazgos = runControl({ ...data, skipped });
  const c = counts(hallazgos);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>{isFetching ? "Revisando…" : "Volver a revisar"}</Button>
        <p className="tnum text-base text-muted-foreground" aria-live="polite">
          {c.critico} {c.critico === 1 ? "crítico" : "críticos"} · {c.advertencia} {c.advertencia === 1 ? "advertencia" : "advertencias"}
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Los críticos conviene resolverlos antes de aprobar la versión final. Las advertencias no bloquean, pero salen marcadas como incompletas o pueden ser errores.
      </p>
      {hallazgos.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-ok bg-card p-5">
          <ShieldCheck aria-hidden="true" className="size-8 text-ok" />
          <p className="text-base font-medium">Sin hallazgos: el proyecto pasa todas las reglas de control.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {hallazgos.map((f) => <Item key={f.id} f={f} onGo={onGo} />)}
        </ul>
      )}
    </div>
  );
}
