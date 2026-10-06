"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientForm } from "@/components/client-form";
import { ClientLogoButton } from "@/components/client-logo-button";
import { useAuth } from "@/lib/auth/auth-provider";
import { deleteClient, listClients } from "@/lib/data/clients";
import { errMsg } from "@/lib/data/util";
import type { ClientRow } from "@/lib/schemas";

export default function ClientesPage() {
  const { orgId } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ClientRow | "new" | null>(null);
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", orgId],
    queryFn: () => listClients(orgId as string),
    enabled: !!orgId,
  });
  const del = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      toast.success("Cliente eliminado");
      void qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button size="lg" className="h-11" onClick={() => setEditing("new")}>
          Nuevo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>Nombre</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Cargando…</TableCell>
                </TableRow>
              )}
              {!isLoading && clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Todavía no cargaste clientes. Creá el primero con “Nuevo cliente”.
                  </TableCell>
                </TableRow>
              )}
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {orgId && <ClientLogoButton orgId={orgId} client={c} />}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.cuit ?? "—"}</TableCell>
                  <TableCell>{[c.contact.nombre, c.contact.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button variant="outline" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      disabled={del.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar a ${c.name}?`)) del.mutate(c.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
          </DialogHeader>
          {editing !== null && orgId && (
            <ClientForm
              key={editing === "new" ? "new" : editing.id}
              orgId={orgId}
              client={editing === "new" ? null : editing}
              onDone={() => {
                setEditing(null);
                void qc.invalidateQueries({ queryKey: ["clients"] });
                void qc.invalidateQueries({ queryKey: ["logo"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
