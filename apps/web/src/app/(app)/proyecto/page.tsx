"use client";

import { Suspense, useEffect } from "react";
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
import { GROUPS, isSection } from "@/components/project/sections";
import { getChecklist } from "@/lib/data/summary";
import { ArrowLeft } from "lucide-react";
import { progress, sectionStatus, type SectionId } from "@/lib/checklist";
import { DEFAULT_THRESHOLDS, parseThresholds, thresholdsValid } from "@/lib/threshold";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCadastre, deleteCadastre, getProject, listCadastre, resetThresholds } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
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
  const qc = useQueryClient();
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id as string),
    enabled: !!id,
  });
  const { data: items = [], isLoading: loadingList } = useQuery({
    queryKey: ["checklist", id],
    queryFn: () => getChecklist(project!),
    enabled: !!project,
  });

  // en móvil la fila de secciones se desplaza: la activa queda a la vista al cambiar
  useEffect(() => {
    document.querySelector('nav[aria-label="Secciones del proyecto"] [aria-current="page"]')?.scrollIntoView({
      inline: "center", block: "nearest",
    });
  }, [section, project]);

  const go = (s: SectionId) => {
    void qc.invalidateQueries({ queryKey: ["checklist", id] });
    router.replace(`/proyecto/?id=${id}&s=${s}`, { scroll: false });
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
  if (isLoading) return <p>Cargando…</p>;
  if (error || !project || !orgId) {
    return (
      <p role="alert">
        No se pudo abrir el proyecto. {error ? errMsg(error) : ""}{" "}
        <Link href="/proyectos" className="underline">Volver</Link>
      </p>
    );
  }

  const status = sectionStatus(items);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="border-b-2 border-basalto pb-4">
        <Link href="/proyectos" className="inline-flex min-h-11 items-center gap-1 text-base text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Proyectos
        </Link>
        <h1 className="max-w-4xl font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{project.name}</h1>
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[13.5rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del proyecto" className="-mx-4 min-w-0 md:sticky md:top-24 md:mx-0 md:self-start">
          <div className="relative flex gap-2 overflow-x-auto px-4 pb-2 md:flex-col md:gap-4 md:overflow-visible md:px-0 md:pb-0">
            {GROUPS.map((g) => {
              const visibles = g.items.filter((i) => !i.adminOnly || isAdmin);
              if (visibles.length === 0) return null;
              return (
                <div key={g.title} className="flex shrink-0 gap-2 md:grid md:gap-1">
                  {g.title !== "Inicio" && (
                    <p className="hidden px-3 pt-1 text-sm font-semibold text-primary md:block">{g.title}</p>
                  )}
                  {visibles.map((it) => {
                    const active = it.id === section;
                    const st = status[it.id];
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => go(it.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border-l-4 px-3 text-base font-medium transition-colors md:w-full",
                          active
                            ? "border-jarilla bg-basalto text-white"
                            : "border-transparent bg-card/70 text-foreground/80 hover:bg-card hover:text-foreground md:bg-transparent",
                        )}
                      >
                        {st && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-2.5 shrink-0 rounded-full",
                              st === "ok" ? "bg-ok" : active ? "bg-jarilla" : "border-2 border-warn bg-transparent",
                            )}
                          />
                        )}
                        {it.label}
                        {st && <span className="sr-only">{st === "ok" ? " — listo" : " — pendiente"}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {section === "resumen" && <Resumen items={items} loading={loadingList} onGo={go} />}
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
