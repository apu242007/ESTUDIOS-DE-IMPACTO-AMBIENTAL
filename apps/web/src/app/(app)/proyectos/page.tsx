"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const { data: projects = [], isLoading } = useQuery({
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
        <h1 className="text-2xl font-bold">Proyectos</h1>
        <Button size="lg" className="h-11" onClick={() => setCreating(true)} disabled={clients.length === 0}>
          Nuevo proyecto
        </Button>
      </div>
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
                    {projects.length === 0 ? "Todavía no hay proyectos." : "Sin resultados para la búsqueda."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.code ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/proyecto?id=${p.id}`} className="underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.clients?.name ?? "—"}</TableCell>
                  <TableCell>{p.doc_type}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button variant="outline" render={<Link href={`/proyecto?id=${p.id}`} />}>
                      Abrir
                    </Button>
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
