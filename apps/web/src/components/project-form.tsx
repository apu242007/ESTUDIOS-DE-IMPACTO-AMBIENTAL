"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/field";
import { listClients } from "@/lib/data/clients";
import { listProjects, saveProject } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
import {
  docTypes,
  projectFormSchema,
  provinces,
  type ProjectFormValues,
  type ProjectRow,
} from "@/lib/schemas";

export function ProjectForm({
  orgId,
  project,
  onDone,
}: {
  orgId: string;
  project: ProjectRow | null;
  onDone: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", orgId],
    queryFn: () => listClients(orgId),
  });
  // sugerencias de yacimiento/área ya usados (evita tipear y variantes del mismo nombre)
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => listProjects(orgId),
  });
  const areas = [...new Set(projects.map((p) => p.field_area).filter((a): a is string => !!a))];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      client_id: project?.client_id ?? "",
      name: project?.name ?? "",
      code: project?.code ?? "",
      doc_type: project?.doc_type ?? "IA",
      field_area: project?.field_area ?? "",
      province: project?.province ?? "Neuquén",
      applicant_razon_social: project?.applicant.razon_social ?? "",
      applicant_cuit: project?.applicant.cuit ?? "",
      applicant_domicilio: project?.applicant.domicilio ?? "",
      consultant_razon_social: project?.consultant.razon_social ?? "",
      consultant_responsable: project?.consultant.responsable ?? "",
      consultant_matricula: project?.consultant.matricula ?? "",
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      const id = await saveProject(orgId, project?.id ?? null, v);
      toast.success(project ? "Proyecto actualizado" : "Proyecto creado");
      onDone(id);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *" error={errors.client_id?.message}>
          <NativeSelect {...register("client_id")}>
            <option value="">Elegí un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tipo de documento *" error={errors.doc_type?.message}>
          <NativeSelect {...register("doc_type")}>
            {docTypes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Nombre del proyecto *" error={errors.name?.message}>
          <Input className="h-11" {...register("name")} />
        </Field>
        <Field label="Código" error={errors.code?.message}>
          <Input className="h-11" placeholder="2947-26" {...register("code")} />
        </Field>
        <Field label="Yacimiento / área" error={errors.field_area?.message}>
          <Input className="h-11" list="areas" {...register("field_area")} />
          <datalist id="areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="Provincia *" error={errors.province?.message}>
          <NativeSelect {...register("province")}>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <fieldset className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">Empresa solicitante</legend>
        <Field label="Razón social" error={errors.applicant_razon_social?.message}>
          <Input className="h-11" {...register("applicant_razon_social")} />
        </Field>
        <Field label="CUIT" error={errors.applicant_cuit?.message}>
          <Input className="h-11" inputMode="numeric" {...register("applicant_cuit")} />
        </Field>
        <Field label="Domicilio" error={errors.applicant_domicilio?.message}>
          <Input className="h-11" {...register("applicant_domicilio")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-lg border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">Consultora y responsable técnico</legend>
        <Field label="Consultora" error={errors.consultant_razon_social?.message}>
          <Input className="h-11" {...register("consultant_razon_social")} />
        </Field>
        <Field label="Responsable técnico" error={errors.consultant_responsable?.message}>
          <Input className="h-11" {...register("consultant_responsable")} />
        </Field>
        <Field label="Matrícula" error={errors.consultant_matricula?.message}>
          <Input className="h-11" {...register("consultant_matricula")} />
        </Field>
      </fieldset>

      <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
        {busy ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
