"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfirm } from "@/components/confirm";
import { ProjectForm } from "@/components/project-form";
import { useAuth } from "@/lib/auth/auth-provider";
import { listClients } from "@/lib/data/clients";
import { duplicateProject, listProjects } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
import { useOnline } from "@/lib/offline/use-online";
import type { ProjectRow } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  revision: "En revisión",
  entregado: "Entregado",
  cerrado: "Cerrado",
};

function Estado({ status }: { status: ProjectRow["status"] }) {
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${status === "entregado" || status === "cerrado" ? "bg-ok" : status === "revision" ? "bg-jarilla" : "bg-muted-foreground"}`}
      />
      {STATUS_LABEL[status] ?? status}
    </Badge>
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

  const needle = q.trim().toLowerCase();
  const rows = projects.filter((p) =>
    (estado === "todos" || p.status === estado) &&
    [p.name, p.code, p.clients?.name, p.field_area]
      .filter(Boolean)
      .some((t) => (t as string).toLowerCase().includes(needle)),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-base text-muted-foreground tnum">
            {isLoading ? "Cargando…" : `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}`}
          </p>
        </div>
        <Button size="lg" className="h-11" onClick={() => setCreating(true)} disabled={clients.length === 0 || !online}>
          Nuevo proyecto
        </Button>
      </div>
      {!online && (
        <p role="status" className="rounded-md border-2 border-jarilla bg-jarilla/15 p-3 text-base">
          Sin señal: se muestra la última lista guardada en este teléfono. Abrí el proyecto y seguí en Relevamiento.
        </p>
      )}
      {listError && (online ? (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo cargar la lista de proyectos: {errMsg(listError)}. Si hay proyectos que no aparecen, un dato guardado
          con formato inválido puede estar ocultándolos.
        </p>
      ) : (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          No hay copia de la lista en este teléfono: abrí la app una vez con conexión antes de salir al campo.
        </p>
      ))}
      {online && clients.length === 0 && (
        <p className="rounded-lg border bg-background p-3 text-sm">
          Para crear un proyecto primero cargá un cliente en{" "}
          <Link href="/clientes" className="font-medium underline">
            Clientes
          </Link>
          .
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
      <Input
        className="h-11 max-w-md flex-[1_1_18rem] bg-card"
        type="search"
        placeholder="Buscar por nombre, código, cliente o yacimiento…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar proyectos"
      />
      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {(["todos", ...Object.keys(STATUS_LABEL)] as const).map((k) => {
          const n = k === "todos" ? projects.length : projects.filter((p) => p.status === k).length;
          if (k !== "todos" && n === 0) return null;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={estado === k}
              onClick={() => setEstado(k as typeof estado)}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-base font-medium transition-colors",
                estado === k ? "border-basalto bg-basalto text-white" : "bg-card hover:border-input",
              )}
            >
              {k === "todos" ? "Todos" : STATUS_LABEL[k]}
              <span className="tnum font-mono text-sm opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      </div>

      {/* Celular: tarjetas. La tabla de 6 columnas no entra en 360 px y dejaba "Abrir" fuera de la pantalla. */}
      <ul aria-label="Proyectos" className="grid gap-3 sm:hidden">
        {isLoading && [0, 1, 2].map((i) => <li key={i}><Skeleton className="h-24" /></li>)}
        {!isLoading && rows.length === 0 && (
          <li className="py-6 text-center text-muted-foreground">
            {projects.length === 0 ? "Todavía no hay proyectos." : "Ningún proyecto coincide con la búsqueda."}
          </li>
        )}
        {rows.map((p, i) => (
          <li key={p.id} className="enter" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <Link href={`/proyecto?id=${p.id}`} className="block rounded-lg bg-card p-4 ring-1 ring-border transition-shadow active:bg-muted">
              <span className="block text-lg font-semibold leading-snug text-primary">{p.name}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {p.clients?.name && <span className="font-medium text-foreground">{p.clients.name}</span>}
                {p.code && <span className="tnum font-mono">{p.code}</span>}
                <span>{p.doc_type}</span>
                <Estado status={p.status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="hidden sm:flex">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                [0, 1, 2].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-6" /></TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {projects.length === 0
                      ? "Todavía no hay proyectos. Creá el primero con “Nuevo proyecto”."
                      : "Ningún proyecto coincide con la búsqueda."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((p, i) => (
                <TableRow key={p.id} className="enter" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <TableCell>{p.code ?? "—"}</TableCell>
                  <TableCell className="text-base font-semibold">
                    <Link href={`/proyecto?id=${p.id}`} className="text-primary underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.clients?.name ?? "—"}</TableCell>
                  <TableCell>{p.doc_type}</TableCell>
                  <TableCell>
                    <Estado status={p.status} />
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Link href={`/proyecto?id=${p.id}`} className={buttonVariants({ variant: "outline" })}>
                      Abrir
                    </Link>
                    <Button
                      variant="outline"
                      disabled={dup.isPending || !online}
                      onClick={() => {
                        void confirm({
                          title: `¿Duplicar “${p.name}”?`,
                          details: ["Se copian los datos generales y las obras del alcance.", "El relevamiento, el GPS y las fotos no se copian."],
                          confirmLabel: "Duplicar",
                        }).then((ok) => ok && dup.mutate(p.id));
                      }}
                    >
                      Duplicar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
