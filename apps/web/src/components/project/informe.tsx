"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  buildStatusLabel, createBuild, downloadUrl, listBuilds, photoQuality, type BuildRow, type BuildStatus, type PhotoQuality,
} from "@/lib/data/builds";
import { errMsg } from "@/lib/data/util";
import type { CheckItem } from "@/lib/checklist";

const variant: Record<BuildStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  procesando: "secondary",
  listo: "default",
  error: "destructive",
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Más de 90 s "En cola" casi siempre significa que el worker de la PC no está corriendo. */
const workerDormido = (b: BuildRow) => b.status === "pendiente" && Date.now() - new Date(b.created_at).getTime() > 90_000;

function Descarga({ path, filename, label }: { path: string; filename: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.location.href = await downloadUrl(path, filename);
        } catch (e) {
          toast.error(errMsg(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileText aria-hidden="true" />
      {label}
    </Button>
  );
}

export function Informe({ projectId, projectName, items }: { projectId: string; projectName: string; items: CheckItem[] }) {
  const qc = useQueryClient();
  const key = ["builds", projectId];
  const [quality, setQuality] = useState<PhotoQuality>("media");
  const { data: builds = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listBuilds(projectId),
    refetchInterval: (q) => (q.state.data?.some((b) => b.status === "pendiente" || b.status === "procesando") ? 4000 : false),
  });
  const generate = useMutation({
    mutationFn: () => createBuild(projectId, quality),
    onSuccess: () => {
      toast.success("Informe en cola. Se genera en la PC de la consultora.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pendientes = items.filter((i) => !i.done);
  const slug = projectName.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "informe";

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-heading text-xl font-semibold">Generar informe</h2>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          Arma el Word y el PDF con carátula, datos generales, alcance, tabla de interferencias, anexo fotográfico y anexo de
          archivos georreferenciados. Cada generación queda como una versión nueva.
        </p>

        {pendientes.length > 0 && (
          <div className="mt-4 rounded-lg border border-warn/40 bg-warn/5 p-4" role="note">
            <p className="font-medium text-warn">
              {pendientes.length === 1 ? "Falta 1 punto" : `Faltan ${pendientes.length} puntos`} en el proyecto. Podés generar igual:
              las secciones sin datos salen marcadas como incompletas.
            </p>
            <ul className="mt-2 list-disc pl-5 text-base">
              {pendientes.map((p) => (
                <li key={p.id}>
                  <strong>{p.label}:</strong> {p.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Calidad de las fotos</span>
            <NativeSelect className="w-72" value={quality} onChange={(e) => setQuality(e.target.value as PhotoQuality)}>
              {(Object.keys(photoQuality) as PhotoQuality[]).map((k) => (
                <option key={k} value={k}>
                  {photoQuality[k].label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button size="lg" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? "Enviando…" : "Generar informe"}
          </Button>
        </div>
      </section>

      <section aria-labelledby="versiones">
        <h2 id="versiones" className="font-heading text-xl font-semibold">Versiones</h2>
        {isLoading && <p className="mt-2">Cargando…</p>}
        {!isLoading && builds.length === 0 && (
          <p className="mt-2 text-base text-muted-foreground">Todavía no generaste ningún informe.</p>
        )}
        <div className="mt-3 grid gap-3">
          {builds.map((b) => (
            <Card key={b.id}>
              <CardContent className="grid gap-3 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <strong className="font-heading text-lg">Versión {b.version_num}</strong>
                  <Badge variant={variant[b.status]}>{buildStatusLabel[b.status]}</Badge>
                  <span className="tnum text-sm text-muted-foreground">{fecha(b.created_at)}</span>
                </div>

                {workerDormido(b) && (
                  <p role="alert" className="text-sm text-warn">
                    Lleva más de un minuto en cola. Revisá que el worker esté corriendo en la PC de la consultora.
                  </p>
                )}

                {b.status === "listo" && (
                  <div className="flex flex-wrap gap-2">
                    {b.docx_path && <Descarga path={b.docx_path} filename={`${slug}_v${b.version_num}.docx`} label="Descargar Word" />}
                    {b.pdf_path ? (
                      <Descarga path={b.pdf_path} filename={`${slug}_v${b.version_num}.pdf`} label="Descargar PDF" />
                    ) : (
                      <span className="self-center text-sm text-muted-foreground">Sin PDF (ver el registro).</span>
                    )}
                  </div>
                )}

                {b.log && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Ver registro</summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm">{b.log}</pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
