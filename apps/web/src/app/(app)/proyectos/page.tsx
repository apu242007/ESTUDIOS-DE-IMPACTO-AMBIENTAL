"use client";

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
import { ProjectForm } from "@/components/project-form";
import { useAuth } from "@/lib/auth/auth-provider";
import { listClients } from "@/lib/data/clients";
import { duplicateProject, listProjects } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";

const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  revision: "En revisión",
  entregado: "Entregado",
  cerrado: "Cerrado",
};

export default function ProyectosPage() {
  const { orgId } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
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
        <Button size="lg" className="h-11" onClick={() => setCreating(true)} disabled={clients.length === 0}>
          Nuevo proyecto
        </Button>
      </div>
      {listError && (
        <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          No se pudo cargar la lista de proyectos: {errMsg(listError)}. Si hay proyectos que no aparecen, un dato guardado
          con formato inválido puede estar ocultándolos.
        </p>
      )}
      {clients.length === 0 && (
        <p className="rounded-lg border bg-background p-3 text-sm">
          Para crear un proyecto primero cargá un cliente en{" "}
          <Link href="/clientes" className="font-medium underline">
            Clientes
          </Link>
          .
        </p>
      )}
      <Input
        className="h-11 max-w-md bg-background"
        type="search"
        placeholder="Buscar por nombre, código, cliente o yacimiento…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar proyectos"
      />

      <Card>
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
                <TableRow>
                  <TableCell colSpan={6}>Cargando…</TableCell>
                </TableRow>
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
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.code ?? "—"}</TableCell>
                  <TableCell className="text-base font-semibold">
                    <Link href={`/proyecto?id=${p.id}`} className="text-primary underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.clients?.name ?? "—"}</TableCell>
                  <TableCell>{p.doc_type}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${p.status === "entregado" || p.status === "cerrado" ? "bg-ok" : p.status === "revision" ? "bg-jarilla" : "bg-muted-foreground"}`}
                      />
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Link href={`/proyecto?id=${p.id}`} className={buttonVariants({ variant: "outline" })}>
                      Abrir
                    </Link>
                    <Button variant="outline" disabled={dup.isPending} onClick={() => dup.mutate(p.id)}>
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
