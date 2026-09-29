"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { saveClient } from "@/lib/data/clients";
import { errMsg } from "@/lib/data/util";
import { clientFormSchema, type ClientFormValues, type ClientRow } from "@/lib/schemas";

export function ClientForm({
  orgId,
  client,
  onDone,
}: {
  orgId: string;
  client: ClientRow | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: client?.name ?? "",
      cuit: client?.cuit ?? "",
      address: client?.address ?? "",
      contact_nombre: client?.contact.nombre ?? "",
      contact_email: client?.contact.email ?? "",
      contact_telefono: client?.contact.telefono ?? "",
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      await saveClient(orgId, client?.id ?? null, v, logo);
      toast.success(client ? "Cliente actualizado" : "Cliente creado");
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Nombre *" error={errors.name?.message}>
        <Input className="h-11" {...register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CUIT" error={errors.cuit?.message}>
          <Input className="h-11" inputMode="numeric" placeholder="30-12345678-9" {...register("cuit")} />
        </Field>
        <Field label="Domicilio" error={errors.address?.message}>
          <Input className="h-11" {...register("address")} />
        </Field>
      </div>
      <fieldset className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">Contacto</legend>
        <Field label="Nombre" error={errors.contact_nombre?.message}>
          <Input className="h-11" {...register("contact_nombre")} />
        </Field>
        <Field label="Email" error={errors.contact_email?.message}>
          <Input className="h-11" type="email" {...register("contact_email")} />
        </Field>
        <Field label="Teléfono" error={errors.contact_telefono?.message}>
          <Input className="h-11" type="tel" {...register("contact_telefono")} />
        </Field>
      </fieldset>
      <Field label="Logo (PNG o JPG, para la carátula)">
        <Input
          className="h-11 pt-2"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
        {busy ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
