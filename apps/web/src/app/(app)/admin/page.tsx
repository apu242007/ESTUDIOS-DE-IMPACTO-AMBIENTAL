"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/field";
import { Catalogos } from "@/components/admin/catalogos/catalogos";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  addCode,
  addMember,
  changeRole,
  deleteCode,
  listCodes,
  listMembers,
  removeMember,
  updateCode,
} from "@/lib/data/admin";
import { getOrgHeader, signedLogoUrl, uploadOrgHeader } from "@/lib/data/clients";
import { errMsg } from "@/lib/data/util";
import { codeFormSchema, memberFormSchema, roleSchema, type Role } from "@/lib/schemas";

type MemberValues = z.infer<typeof memberFormSchema>;
type CodeValues = z.infer<typeof codeFormSchema>;

function Usuarios({ orgId, myId }: { orgId: string; myId: string }) {
  const qc = useQueryClient();
  const key = ["members", orgId];
  const { data: members = [] } = useQuery({ queryKey: key, queryFn: () => listMembers(orgId) });
  const admins = members.filter((m) => m.role === "admin").length;
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast.error(errMsg(e));

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemberValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: { email: "", role: "miembro" },
  });
  const add = useMutation({
    mutationFn: (v: MemberValues) => addMember(orgId, v.email, v.role),
    onSuccess: () => {
      toast.success("Usuario agregado");
      reset();
      refresh();
    },
    onError: fail,
  });
  const role = useMutation({
    mutationFn: (a: { userId: string; role: Role }) => changeRole(orgId, a.userId, a.role),
    onSuccess: refresh,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeMember(orgId, userId),
    onSuccess: refresh,
    onError: fail,
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Agregar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            La persona primero debe registrarse en la app; después la agregás por su email.
          </p>
          <form onSubmit={handleSubmit((v) => add.mutate(v))} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
            <Field label="Email" error={errors.email?.message}>
              <Input className="h-11" type="email" {...register("email")} />
            </Field>
            <Field label="Rol">
              <NativeSelect {...register("role")}>
                <option value="miembro">Miembro</option>
                <option value="admin">Administrador</option>
              </NativeSelect>
            </Field>
            <Button type="submit" size="lg" className="h-11" disabled={add.isPending}>
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios de la organización</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {members.map((m) => {
            const lastAdmin = m.role === "admin" && admins <= 1;
            return (
              <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <span className="font-medium">
                  {m.email}
                  {m.user_id === myId && <span className="text-muted-foreground"> (vos)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <NativeSelect
                    aria-label={`Rol de ${m.email}`}
                    className="w-40"
                    value={m.role}
                    disabled={lastAdmin}
                    onChange={(e) => role.mutate({ userId: m.user_id, role: roleSchema.parse(e.target.value) })}
                  >
                    <option value="miembro">Miembro</option>
                    <option value="admin">Administrador</option>
                  </NativeSelect>
                  <Button
                    variant="outline"
                    disabled={lastAdmin}
                    title={lastAdmin ? "Debe quedar al menos un administrador" : undefined}
                    onClick={() => {
                      if (window.confirm(`¿Quitar a ${m.email} de la organización?`)) remove.mutate(m.user_id);
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Siglas({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const key = ["codes", orgId];
  const { data: codes = [] } = useQuery({ queryKey: key, queryFn: () => listCodes(orgId) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast.error(errMsg(e));
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CodeValues>({
    resolver: zodResolver(codeFormSchema),
    defaultValues: { code: "", meaning: "" },
  });
  const add = useMutation({
    mutationFn: (v: CodeValues) =>
      addCode(orgId, v.code, v.meaning, (codes.at(-1)?.sort_order ?? 0) + 1),
    onSuccess: () => {
      reset();
      refresh();
    },
    onError: fail,
  });
  const upd = useMutation({
    mutationFn: (a: { id: string; meaning: string }) => updateCode(a.id, a.meaning),
    onSuccess: () => toast.success("Guardado"),
    onError: fail,
  });
  const del = useMutation({ mutationFn: deleteCode, onSuccess: refresh, onError: fail });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de siglas</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end" noValidate>
          <Field label="Sigla" error={errors.code?.message}>
            <Input className="h-11" {...register("code")} />
          </Field>
          <Field label="Significado" error={errors.meaning?.message}>
            <Input className="h-11" {...register("meaning")} />
          </Field>
          <Button type="submit" size="lg" className="h-11" disabled={add.isPending}>
            Agregar
          </Button>
        </form>
        <ul className="grid gap-2">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <span className="w-16 font-mono font-semibold">{c.code}</span>
              <Input
                className="h-11 flex-1"
                defaultValue={c.meaning}
                aria-label={`Significado de ${c.code}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.meaning) upd.mutate({ id: c.id, meaning: v });
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la sigla ${c.code}?`)) del.mutate(c.id);
                }}
              >
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Encabezado({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { data: url, isLoading } = useQuery({
    queryKey: ["org-header", orgId],
    queryFn: async () => {
      const path = await getOrgHeader(orgId);
      return path ? signedLogoUrl(path) : null;
    },
    staleTime: 240_000,
  });
  const up = useMutation({
    mutationFn: (f: File) => uploadOrgHeader(orgId, f),
    onSuccess: () => {
      toast.success("Encabezado guardado. Se usa en los próximos informes.");
      void qc.invalidateQueries({ queryKey: ["org-header", orgId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Encabezado de la consultora</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground">Imagen con el logo y los datos de contacto. Va arriba de cada página del informe. PNG o JPG, apaisada.</p>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Encabezado actual de la consultora" className="max-h-24 w-full rounded bg-white object-contain p-2 ring-1 ring-border" />
        ) : (
          <p className="text-warn">Todavía no hay encabezado: los informes salen sin logo de la consultora.</p>
        )}
        <label className="inline-flex h-12 w-full cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground sm:w-fit">
          {up.isPending ? "Subiendo…" : url ? "Cambiar encabezado" : "Subir encabezado"}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            disabled={up.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) up.mutate(f);
              e.target.value = "";
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { orgId, isAdmin, session } = useAuth();
  const [tab, setTab] = useState(isAdmin ? "usuarios" : "catalogos");
  if (!orgId || !session) {
    return <p role="alert">Necesitás una organización activa para ver esta sección.</p>;
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Administración</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {isAdmin && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
          {isAdmin && <TabsTrigger value="siglas">Siglas</TabsTrigger>}
          {isAdmin && <TabsTrigger value="encabezado">Encabezado</TabsTrigger>}
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="pt-4">
          <Usuarios orgId={orgId} myId={session.user.id} />
        </TabsContent>
        <TabsContent value="siglas" className="pt-4">
          <Siglas orgId={orgId} />
        </TabsContent>
        <TabsContent value="encabezado" className="pt-4">
          <Encabezado orgId={orgId} />
        </TabsContent>
        <TabsContent value="catalogos" className="pt-4">
          <Catalogos orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
