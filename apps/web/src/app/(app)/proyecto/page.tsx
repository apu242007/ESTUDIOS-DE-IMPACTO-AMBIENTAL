"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/field";
import { ProjectForm } from "@/components/project-form";
import { Alcance } from "@/components/project/alcance";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCadastre, deleteCadastre, getProject, listCadastre } from "@/lib/data/projects";
import { errMsg } from "@/lib/data/util";
import { cadastreFormSchema } from "@/lib/schemas";

type CadastreValues = z.infer<typeof cadastreFormSchema>;

function Cadastre({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["cadastre", projectId],
    queryFn: () => listCadastre(projectId),
  });
  const { register, handleSubmit, reset } = useForm<CadastreValues>({
    resolver: zodResolver(cadastreFormSchema),
  });
  const add = useMutation({
    mutationFn: (v: CadastreValues) => addCadastre(projectId, v),
    onSuccess: () => {
      reset();
      void qc.invalidateQueries({ queryKey: ["cadastre", projectId] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: deleteCadastre,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cadastre", projectId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ubicación y catastro</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">Datos sensibles: solo los ven los administradores.</p>
        <ul className="grid gap-2">
          {rows.length === 0 && <li className="text-sm text-muted-foreground">Sin datos de catastro.</li>}
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="text-sm">
                <p>
                  <strong>Nomenclatura:</strong> {r.nomenclature ?? "—"} · <strong>Lote:</strong> {r.lot ?? "—"}
                </p>
                <p>
                  <strong>Titulares:</strong> {r.owners ?? "—"}
                </p>
              </div>
              <Button variant="outline" onClick={() => del.mutate(r.id)}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label="Nomenclatura catastral">
            <Input className="h-11" {...register("nomenclature")} />
          </Field>
          <Field label="Lote">
            <Input className="h-11" {...register("lot")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Titulares">
              <Textarea rows={2} {...register("owners")} />
            </Field>
          </div>
          <Button type="submit" size="lg" className="h-11 sm:col-span-2" disabled={add.isPending}>
            Agregar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectDetail() {
  const id = useSearchParams().get("id");
  const { orgId, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("datos");
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id as string),
    enabled: !!id,
  });

  if (!id) return <p>Falta el identificador del proyecto.</p>;
  if (isLoading) return <p>Cargando…</p>;
  if (error || !project || !orgId) {
    return (
      <p role="alert">
        No se pudo abrir el proyecto. {error ? errMsg(error) : ""}{" "}
        <Link href="/proyectos" className="underline">
          Volver
        </Link>
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <Link href="/proyectos" className="text-sm text-muted-foreground underline">
          ← Proyectos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge variant="secondary">{project.doc_type}</Badge>
          {project.code && <span className="text-muted-foreground">{project.code}</span>}
        </div>
        <p className="text-sm text-muted-foreground">{project.clients?.name}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="alcance">Alcance</TabsTrigger>
          {isAdmin && <TabsTrigger value="catastro">Catastro</TabsTrigger>}
        </TabsList>
        <TabsContent value="datos" className="pt-4">
          <Card>
            <CardContent className="pt-4">
              <ProjectForm
                key={project.id}
                orgId={orgId}
                project={project}
                onDone={() => {
                  void qc.invalidateQueries({ queryKey: ["project", id] });
                  void qc.invalidateQueries({ queryKey: ["projects"] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="alcance" className="pt-4">
          <Alcance projectId={project.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="catastro" className="pt-4">
            <Cadastre projectId={project.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function ProyectoPage() {
  return (
    <Suspense fallback={<p>Cargando…</p>}>
      <ProjectDetail />
    </Suspense>
  );
}
