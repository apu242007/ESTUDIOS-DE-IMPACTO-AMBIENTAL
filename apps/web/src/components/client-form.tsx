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
  const [preview, setPreview] = useState<string | null>(null);
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
      <fieldset className="grid gap-3 rounded-md p-3 ring-1 ring-border">
        <legend className="px-1 font-medium">Logo del cliente (va en la carátula del informe)</legend>
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Logo elegido" className="size-16 rounded bg-white object-contain ring-1 ring-border" />
          ) : (
            <div className="grid size-16 place-items-center rounded bg-muted text-xs text-muted-foreground" aria-hidden>
              {client?.logo_path ? "Actual" : "Sin logo"}
            </div>
          )}
          <label className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center rounded-md px-4 text-base font-medium ring-1 ring-input has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring sm:flex-none">
            {logo ? "Cambiar imagen" : client?.logo_path ? "Reemplazar logo" : "Elegir logo (PNG o JPG)"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setLogo(f);
                setPreview((old) => {
                  if (old) URL.revokeObjectURL(old);
                  return f ? URL.createObjectURL(f) : null;
                });
              }}
            />
          </label>
        </div>
        {logo && <p className="text-sm text-muted-foreground">Se guarda al tocar “Guardar”.</p>}
      </fieldset>
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
      <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
        {busy ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
