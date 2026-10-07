"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/confirm";
import { ProjectForm } from "@/components/project-form";
import { useAuth } from "@/lib/auth/auth-provider";
import { nextStep, type CheckItem } from "@/lib/checklist";
import { listClients } from "@/lib/data/clients";
import { duplicateProject, listProjects } from "@/lib/data/projects";
import { listChecklists } from "@/lib/data/summary";
import { errMsg } from "@/lib/data/util";
import { faseActiva, porFase } from "@/lib/fases";
import { useOnline } from "@/lib/offline/use-online";
import type { ProjectRow } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ProjectRow["status"], string> = {
  borrador: "En preparación",
  revision: "En revisión",
  entregado: "Entregado",
  cerrado: "Cerrado",
};
const STATUS_DOT: Record<ProjectRow["status"], string> = {
  borrador: "bg-muted-foreground",
  revision: "bg-primary",
  entregado: "bg-ok",
  cerrado: "bg-ok",
};

/** Seis tramos, uno por fase: lo hecho en verde monte y la fase activa (la del siguiente paso) en amarillo señal. */
function Traza({ items, status }: { items: CheckItem[] | undefined; status: ProjectRow["status"] }) {
  if (!items) return <span aria-hidden="true" className="grid h-2 grid-cols-6 gap-[3px]">{Array.from({ length: 6 }, (_, i) => <i key={i} className="bg-border" />)}</span>;
  const fases = porFase(items, status);
  const activa = faseActiva(items, status);
  return (
    <span className="grid grid-cols-6 gap-[3px]" aria-hidden="true">
      {fases.map((f, i) => (
        <i key={f.titulo} className="relative h-2 overflow-hidden bg-border">
          <i
            className={cn("fill-x absolute inset-y-0 left-0", i === activa ? "bg-senal" : "bg-ok")}
            style={{ width: `${f.total ? (i === activa ? Math.max(f.listos / f.total, 0.18) : f.listos / f.total) * 100 : 0}%` }}
          />
        </i>
      ))}
    </span>
  );
}

function Hoja({ p, items, i, onDuplicate, canDuplicate }: {
  p: ProjectRow; items: CheckItem[] | undefined; i: number; onDuplicate: () => void; canDuplicate: boolean;
}) {
  const sigue = items ? nextStep(items) : null;
  const fases = items ? porFase(items, p.status) : [];
  const listos = fases.reduce((a, f) => a + f.listos, 0);
  const total = fases.reduce((a, f) => a + f.total, 0);
  return (
    <li className="enter relative grid content-start gap-3 bg-card p-4 shadow-[0_0_0_1px_var(--border)] transition-colors hover:bg-[#fbfaf7] sm:p-5" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <h2 className="text-xl font-bold leading-snug [font-stretch:100%]">
        {/* el enlace cubre toda la hoja; "Duplicar" queda encima */}
        <Link href={`/proyecto?id=${p.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-3 focus-visible:after:outline-ring">
          {p.name}
        </Link>
      </h2>
      <p className="text-base text-muted-foreground">
        {[p.clients?.name, p.field_area].filter(Boolean).join(", ")}
        <span className="mt-1 flex flex-wrap gap-x-3 font-heading text-sm text-curva">
          <span className="tnum">{p.code ? `Expte. ${p.code}` : "Sin expediente"}</span>
          <span>{p.doc_type}</span>
        </span>
      </p>
      <Traza items={items} status={p.status} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2 font-bold">
          <span aria-hidden="true" className={cn("size-2.5 rounded-full", STATUS_DOT[p.status])} />
          {STATUS_LABEL[p.status]}
        </span>
        {total > 0 && <span className="tnum font-heading text-muted-foreground">{listos} de {total} pasos</span>}
      </div>
      {sigue && (
        <p className="text-sm">
          <span className="text-muted-foreground">Sigue: </span>
          <span className="font-bold">{sigue.label}</span>
        </p>
      )}
      <div className="relative z-10 flex justify-end border-t pt-3">
        <Button variant="ghost" size="sm" className="h-10" disabled={!canDuplicate} onClick={onDuplicate}>
          <Copy aria-hidden="true" />
          Duplicar
        </Button>
      </div>
    </li>
  );
}

export default function ProyectosPage() {
  const { orgId } = useAuth();
  const online = useOnline();
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<ProjectRow["status"] | "todos">("todos");
  const [creating, setCreating] = useState(false);

  const { data: projects = [], isLoading, error: listError } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => listProjects(orgId as string),
    enabled: !!orgId,
  });
  const { data: checklists } = useQuery({
    queryKey: ["checklists", orgId, projects.map((p) => p.id).join(",")],
    queryFn: () => listChecklists(orgId as string, projects),
    enabled: !!orgId && projects.length > 0 && online,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", orgId],
    queryFn: () => listClients(orgId as string),
    enabled: !!orgId,
  });

  const dup = useMutation({
    mutationFn: duplicateProject,
    onSuccess: (id) => {
      toast.success("Proyecto duplicado");
      void qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/proyecto?id=${id}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const duplicar = (p: ProjectRow) =>
    void confirm({
      title: `¿Duplicar “${p.name}”?`,
      details: ["Se copian los datos generales y las obras del alcance.", "El relevamiento, el GPS y las fotos no se copian."],
      confirmLabel: "Duplicar",
    }).then((ok) => ok && dup.mutate(p.id));

  const needle = q.trim().toLowerCase();
  const rows = projects.filter((p) =>
    (estado === "todos" || p.status === estado) &&
    [p.name, p.code, p.clients?.name, p.field_area]
      .filter(Boolean)
      .some((t) => (t as string).toLowerCase().includes(needle)),
  );
  const cuenta = (s: ProjectRow["status"]) => projects.filter((p) => p.status === s).length;
  const resumen = [
    cuenta("borrador") && `${cuenta("borrador")} en preparación`,
    cuenta("revision") && `${cuenta("revision")} en revisión`,
    cuenta("entregado") + cuenta("cerrado") && `${cuenta("entregado") + cuenta("cerrado")} entregados`,
  ].filter(Boolean).join(", ");

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold [font-stretch:125%] sm:text-5xl">Proyectos</h1>
          <p className="tnum mt-2 max-w-prose text-base text-muted-foreground">
            {isLoading
              ? "Cargando…"
              : projects.length === 0
                ? "Todavía no hay proyectos."
                : `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}: ${resumen}. La traza de cada hoja muestra el avance por fase; en amarillo, la fase donde sigue el trabajo.`}
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)} disabled={clients.length === 0 || !online}>
          <Plus aria-hidden="true" />
          Nuevo proyecto
        </Button>
      </div>

      {!online && (
        <p role="status" className="rounded-md border-2 border-senal bg-senal/15 p-3 text-base">
          Sin señal: se muestra la última lista guardada en este teléfono. Abrí el proyecto y seguí en Relevamiento.
        </p>
      )}
      {listError && (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {online
            ? `No se pudo cargar la lista de proyectos: ${errMsg(listError)}. Si hay proyectos que no aparecen, un dato guardado con formato inválido puede estar ocultándolos.`
            : "No hay copia de la lista en este teléfono: abrí la app una vez con conexión antes de salir al campo."}
        </p>
      )}
      {online && clients.length === 0 && (
        <p className="rounded-md border bg-card p-3 text-sm">
          Para crear un proyecto primero cargá un cliente en{" "}
          <Link href="/clientes" className="font-medium underline">Clientes</Link>.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="h-11 max-w-md flex-[1_1_18rem] bg-card"
          type="search"
          placeholder="Buscar por nombre, expediente, cliente o yacimiento"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar proyectos"
        />
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {(["todos", "borrador", "revision", "entregado", "cerrado"] as const).map((k) => {
            const n = k === "todos" ? projects.length : cuenta(k);
            if (k !== "todos" && n === 0) return null;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={estado === k}
                onClick={() => setEstado(k)}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-base font-bold transition-colors",
                  estado === k ? "border-foreground bg-foreground text-white" : "bg-card hover:border-input",
                )}
              >
                {k === "todos" ? "Todos" : STATUS_LABEL[k]}
                <span className="tnum font-heading text-sm font-medium opacity-75">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Índice de hojas: cada proyecto es una hoja del pliego, separadas por la línea de la grilla */}
      <ul aria-label="Proyectos" className="grid gap-px p-px [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),1fr))]">
        {isLoading && [0, 1, 2].map((i) => <li key={i} className="bg-card p-5 shadow-[0_0_0_1px_var(--border)]"><Skeleton className="h-36" /></li>)}
        {!isLoading && rows.length === 0 && (
          <li className="col-span-full bg-card px-5 py-10 shadow-[0_0_0_1px_var(--border)] text-center text-base text-muted-foreground">
            {projects.length === 0 ? "Todavía no hay proyectos. Creá el primero con “Nuevo proyecto”." : "Ningún proyecto coincide con la búsqueda o el filtro."}
          </li>
        )}
        {rows.map((p, i) => (
          <Hoja key={p.id} p={p} i={i} items={checklists?.get(p.id)} canDuplicate={online && !dup.isPending} onDuplicate={() => duplicar(p)} />
        ))}
      </ul>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </DialogHeader>
          {creating && orgId && (
            <ProjectForm
              orgId={orgId}
              project={null}
              onDone={(id) => {
                setCreating(false);
                void qc.invalidateQueries({ queryKey: ["projects"] });
                router.push(`/proyecto?id=${id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
