"use client";

import { useConfirm } from "@/components/confirm";
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
  const confirm = useConfirm();
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
        <CardContent className="p-0">
          {/* llena el ancho sin barra lateral; en el celular cada cliente es una ficha */}
          <Table className="table-cards md:table-fixed [&_td]:whitespace-normal">
            <colgroup>
              {[9, 30, 16, 27, 18].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
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
                  <TableCell data-label="Logo">
                    {orgId && <ClientLogoButton orgId={orgId} client={c} />}
                  </TableCell>
                  <TableCell data-label="Nombre" className="font-medium">{c.name}</TableCell>
                  <TableCell data-label="CUIT">{c.cuit ?? "—"}</TableCell>
                  <TableCell data-label="Contacto" data-wide className="break-words">{[c.contact.nombre, c.contact.email].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell data-wide className="text-right">
                    <span className="inline-flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      disabled={del.isPending}
                      onClick={() => {
                        void confirm({ title: `¿Eliminar a ${c.name}?`, confirmLabel: "Eliminar", danger: true }).then((ok) => ok && del.mutate(c.id));
                      }}
                    >
                      Eliminar
                    </Button>
                    </span>
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
