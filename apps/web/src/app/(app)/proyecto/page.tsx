"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { ProjectForm } from "@/components/project-form";
import { Alcance } from "@/components/project/alcance";
import { Capas } from "@/components/project/capas";
import { Figuras } from "@/components/project/figuras";
import { Fotos } from "@/components/project/fotos";
import { Gps } from "@/components/project/gps";
import { Ambiente } from "@/components/project/ambiente";
import { Control } from "@/components/project/control";
import { Declaracion } from "@/components/project/declaracion";
import { Impactos } from "@/components/project/impactos";
import { Pga } from "@/components/project/pga";
import { Textos } from "@/components/project/textos";
import { Informe } from "@/components/project/informe";
import { Interferencias } from "@/components/project/interferencias";
import { Comparacion } from "@/components/project/comparacion";
import { Mapa } from "@/components/project/mapa";
import { Relevamiento } from "@/components/project/relevamiento";
import { Resumen } from "@/components/project/resumen";
import { MobileSectionBar, PhaseNav } from "@/components/project/phase-nav";
import { SECTION_HELP, flatSections, isSection } from "@/components/project/sections";
import { getChecklist } from "@/lib/data/summary";
import { ArrowLeft, ArrowRight, CloudOff } from "lucide-react";
import { progress, sectionStatus, type SectionId } from "@/lib/checklist";
import { DEFAULT_THRESHOLDS, parseThresholds, thresholdsValid } from "@/lib/threshold";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCadastre, deleteCadastre, getProject, listCadastre, resetThresholds } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
import { useOnline } from "@/lib/offline/use-online";
import { cadastreFormSchema } from "@/lib/schemas";

type CadastreValues = z.infer<typeof cadastreFormSchema>;

function Cadastre({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["cadastre", projectId],
    queryFn: () => listCadastre(projectId),
  });
  const { register, handleSubmit, reset } = useForm<CadastreValues>({
    resolver: zodResolver(cadastreFormSchema),
  });
  const add = useMutation({
    mutationFn: (v: CadastreValues) => addCadastre(projectId, v),
    onSuccess: () => {
      reset();
      void qc.invalidateQueries({ queryKey: ["cadastre", projectId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: deleteCadastre,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cadastre", projectId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ubicación y catastro</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">Datos sensibles: solo los ven los administradores.</p>
        <ul className="grid gap-2">
          {rows.length === 0 && <li className="text-sm text-muted-foreground">Sin datos de catastro.</li>}
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="text-sm">
                <p>
                  <strong>Nomenclatura:</strong> {r.nomenclature ?? "—"} · <strong>Lote:</strong> {r.lot ?? "—"}
                </p>
                <p>
                  <strong>Titulares:</strong> {r.owners ?? "—"}
                </p>
              </div>
              <Button variant="outline" onClick={() => del.mutate(r.id)}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Nomenclatura catastral">
            <Input className="h-11" {...register("nomenclature")} />
          </Field>
          <Field label="Lote">
            <Input className="h-11" {...register("lot")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Titulares">
              <Textarea rows={2} {...register("owners")} />
            </Field>
          </div>
          <Button type="submit" size="lg" className="h-11 sm:col-span-2" disabled={add.isPending}>
            Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const sParam = params.get("s");
  const section: SectionId = isSection(sParam) ? sParam : "resumen";
  const { orgId, isAdmin } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id as string),
    enabled: !!id,
  });
  const { data: items = [], isLoading: loadingList, error: listError } = useQuery({
    queryKey: ["checklist", id],
    queryFn: () => getChecklist(project!),
    enabled: !!project && online, // sin señal no se intenta: serían 10 consultas reintentando
  });

  // push (no replace): el "atrás" del celular vuelve a la sección anterior en vez de sacarte del proyecto
  const go = (s: SectionId) => {
    void qc.invalidateQueries({ queryKey: ["checklist", id] });
    router.push(`/proyecto/?id=${id}&s=${s}`, { scroll: false });
  };

  const reset = useMutation({
    mutationFn: () => resetThresholds(id as string),
    onSuccess: () => {
      toast.success("Umbral restablecido");
      void qc.invalidateQueries({ queryKey: ["project", id] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!id) return <p>Falta el identificador del proyecto.</p>;
  if (isLoading)
    return (
      <div role="status" aria-label="Cargando proyecto" className="grid gap-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  if (error || !project || !orgId) {
    return (
      <p role="alert" className="max-w-prose text-base">
        No se pudo abrir el proyecto.{" "}
        {!online
          ? "Sin señal y sin copia en este teléfono: abrilo una vez con conexión antes de salir al campo."
          : error ? errMsg(error) : ""}{" "}
        <Link href="/proyectos" className="underline">Volver</Link>
      </p>
    );
  }

  const status = sectionStatus(items);
  const flow = flatSections(isAdmin);
  const at = flow.findIndex((s) => s.id === section);
  const current = flow[at];
  const prev = at > 0 ? flow[at - 1] : null;
  const next = at >= 0 && at < flow.length - 1 ? flow[at + 1] : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-20 md:pb-0">
      <header className="pb-1">
        <Link href="/proyectos" className="inline-flex min-h-11 items-center gap-1 text-base text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Proyectos
        </Link>
        <h1 className="max-w-4xl font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{project.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
          <span className="font-medium text-foreground">{project.clients?.name}</span>
          <Badge variant="secondary">{project.doc_type}</Badge>
          {project.code && <span className="tnum font-mono">{project.code}</span>}
          {items.length > 0 && (
            <span className="tnum ml-auto text-sm" aria-live="polite">
              {progress(items).done} de {progress(items).total} pasos listos
            </span>
          )}
        </div>
      </header>

      {!online && (
        <div role="status" className="grid gap-3 rounded-md border-2 border-jarilla bg-jarilla/15 p-3 text-base sm:flex sm:items-center">
          <p className="flex min-w-0 flex-1 gap-2">
            <CloudOff aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span>Sin señal. El relevamiento funciona igual: lo que cargues queda en este teléfono y se sube solo cuando vuelva la conexión.</span>
          </p>
          {section !== "relevamiento" && (
            <Button variant="jarilla" size="lg" className="w-full sm:w-auto" onClick={() => go("relevamiento")}>
              Ir a Relevamiento
            </Button>
          )}
        </div>
      )}

      {!thresholdsValid(project.thresholds) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-warn bg-warn/10 p-3 text-base">
          <p className="min-w-0 flex-1">
            El umbral de comparación guardado en este proyecto no es válido y se está usando el valor por defecto (
            {DEFAULT_THRESHOLDS.pct} % o {DEFAULT_THRESHOLDS.abs_m} m). Restablecelo para dejarlo guardado.
          </p>
          <Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
            Restablecer umbral
          </Button>
        </div>
      )}

      <PhaseNav section={section} status={status} isAdmin={isAdmin} onGo={go} />
      <MobileSectionBar section={section} status={status} isAdmin={isAdmin} onGo={go} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <div key={section} className="enter min-w-0">
          {section !== "resumen" && (
            <div className="mb-4">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">{current?.label}</h2>
              {SECTION_HELP[section] && <p className="text-base text-muted-foreground">{SECTION_HELP[section]}</p>}
            </div>
          )}
          {section === "resumen" &&<Resumen items={items} loading={loadingList} error={!online ? "sin señal" : listError ? errMsg(listError) : null} onGo={go} />}
          {section === "datos" && (
            <Card>
              <CardContent className="pt-4">
                <ProjectForm
                  key={project.id}
                  orgId={orgId}
                  project={project}
                  onDone={() => {
                    void qc.invalidateQueries({ queryKey: ["project", id] });
                    void qc.invalidateQueries({ queryKey: ["projects"] });
                    void qc.invalidateQueries({ queryKey: ["checklist", id] });
                  }}
                />
              </CardContent>
            </Card>
          )}
          {section === "alcance" && <Alcance projectId={project.id} />}
          {section === "capas" && <Capas orgId={orgId} projectId={project.id} />}
          {section === "relevamiento" && <Relevamiento orgId={orgId} projectId={project.id} />}
          {section === "gps" && <Gps orgId={orgId} projectId={project.id} />}
          {section === "comparacion" && <Comparacion projectId={project.id} thresholds={parseThresholds(project.thresholds)} />}
          {section === "mapa" && <Mapa projectId={project.id} />}
          {section === "figuras" && <Figuras projectId={project.id} />}
          {section === "interferencias" && <Interferencias orgId={orgId} projectId={project.id} />}
          {section === "fotos" && <Fotos orgId={orgId} projectId={project.id} />}
          {section === "impactos" && <Impactos orgId={orgId} projectId={project.id} />}
          {section === "textos" && <Textos orgId={orgId} project={project} />}
          {section === "ambiente" && <Ambiente orgId={orgId} project={project} />}
          {section === "declaracion" && <Declaracion orgId={orgId} project={project} />}
          {section === "pga" && <Pga orgId={orgId} project={project} />}
          {section === "control" && <Control orgId={orgId} project={project} onGo={go} />}
          {section === "informe" && <Informe projectId={project.id} projectName={project.name} items={items} status={project.status} isAdmin={isAdmin} />}
          {section === "catastro" && isAdmin && <Cadastre projectId={project.id} />}

          <nav aria-label="Anterior y siguiente" className="mt-8 hidden flex-wrap justify-between gap-3 border-t pt-4 md:flex">
            {prev ? (
              <Button variant="outline" size="lg" onClick={() => go(prev.id)}>
                <ArrowLeft aria-hidden="true" />
                {prev.label}
              </Button>
            ) : <span />}
            {next && (
              <Button size="lg" onClick={() => go(next.id)}>
                {next.label}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

export default function ProyectoPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <ProjectDetail />
    </Suspense>
  );
}
