"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { nextStep, type CheckItem } from "@/lib/checklist";
import { getProjectCenter } from "@/lib/data/control";
import { porFase } from "@/lib/fases";
import { marcasEste } from "@/lib/geo/coords";
import type { ProjectRow } from "@/lib/schemas";

/** Baja solo la inicial: "Cruce con el GPS" → "cruce con el GPS" (no rompe siglas). */
export const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const DOC_LABEL: Record<string, string> = { IA: "Informe ambiental", MTD: "Memoria técnica descriptiva" };

/** Marcas de coordenadas Gauss-Krüger (Y, este) del área del proyecto en el borde del pliego, como el margen de una carta IGN. */
function MarcoGK({ projectId }: { projectId: string }) {
  const { data: c } = useQuery({ queryKey: ["center", projectId], queryFn: () => getProjectCenter(projectId), staleTime: 5 * 60_000 });
  if (!c) return null;
  return (
    <div aria-hidden="true" className="marco-gk pointer-events-none absolute inset-x-4 -top-5 flex justify-between font-heading text-[0.7rem] text-curva sm:inset-x-8">
      {marcasEste(c.lat, c.lon).map((y, i) => (
        <span key={y} className="relative tnum after:absolute after:left-1/2 after:top-[1.05rem] after:h-2 after:w-px after:bg-curva max-sm:[&:not(:nth-child(4n+1))]:hidden" style={{ "--i": i } as React.CSSProperties}>
          {y.toLocaleString("es-AR")}
        </span>
      ))}
    </div>
  );
}

/** Celda del cajetín: `ancho` ocupa las dos columnas; las de la izquierda llevan línea a la derecha. */
function Dato({ label, children, ancho, izq }: { label: string; children: React.ReactNode; ancho?: boolean; izq?: boolean }) {
  return (
    <div className={`border-b border-foreground px-3 py-2 ${ancho ? "col-span-2" : ""} ${izq ? "border-r" : ""}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}

/** Cajetín: el bloque de datos de un plano. En el celular se pliega en una línea (expediente y avance). */
function Cajetin({ project, avance }: { project: ProjectRow; avance: number | null }) {
  const filas = (
    <dl className="grid grid-cols-2 border-[1.5px] border-foreground bg-card text-sm">
      <Dato label="Cliente" ancho>{project.clients?.name ?? "—"}</Dato>
      <Dato label="Expediente" izq><span className="tnum font-heading">{project.code ?? "—"}</span></Dato>
      <Dato label="Tipo">{DOC_LABEL[project.doc_type] ?? project.doc_type}</Dato>
      <Dato label="Yacimiento" izq>{project.field_area ?? "—"}</Dato>
      <Dato label="Sistema">EPSG:{project.crs_epsg}</Dato>
      <div className="col-span-2 flex items-center justify-between bg-foreground px-3 py-2 text-white">
        <dt className="text-sm">Avance</dt>
        <dd className="tnum font-heading text-2xl font-extrabold">{avance === null ? "—" : `${avance} %`}</dd>
      </div>
    </dl>
  );
  return (
    <>
      <div className="cajetin hidden lg:block">{filas}</div>
      <details className="group lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 border-[1.5px] border-foreground bg-card px-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="tnum font-heading font-bold">{project.code ? `Expte. ${project.code}` : "Sin expediente"}</span>
          <span className="flex items-center gap-2">
            <span className="tnum font-heading font-extrabold">{avance === null ? "" : `${avance} %`}</span>
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
            <span className="sr-only">Ver datos del proyecto</span>
          </span>
        </summary>
        <div className="mt-2">{filas}</div>
      </details>
    </>
  );
}

/** Encabezado del proyecto como pliego técnico: título, qué sigue, cajetín y marco GK. */
export function PliegoHeader({ project, items, children }: { project: ProjectRow; items: CheckItem[]; children?: React.ReactNode }) {
  const fases = items.length ? porFase(items, project.status) : [];
  const listos = fases.reduce((a, f) => a + f.listos, 0);
  const total = fases.reduce((a, f) => a + f.total, 0);
  const sigue = items.length ? nextStep(items) : null;
  const faltan = total - listos;
  return (
    <header className="pliego relative border-[1.5px] border-foreground bg-card px-4 pb-5 pt-6 sm:px-8 sm:pt-8">
      <MarcoGK projectId={project.id} />
      {children}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div>
          <h1 className="max-w-[24ch] text-2xl font-extrabold leading-[1.1] sm:text-4xl xl:text-5xl">{project.name}</h1>
          {total > 0 && (
            <p className="mt-3 max-w-prose text-base text-muted-foreground">
              {faltan === 0
                ? "Todos los pasos están listos."
                : `Faltan ${faltan} de ${total} pasos.${sigue ? ` Sigue: ${minuscula(sigue.label)}.` : ""}`}
            </p>
          )}
        </div>
        <Cajetin project={project} avance={total ? Math.round((listos / total) * 100) : null} />
      </div>
    </header>
  );
}
