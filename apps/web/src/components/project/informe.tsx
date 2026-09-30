"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  approveBuild, buildStatusLabel, createBuild, downloadUrl, isFinal, listBuilds, listReviews, observeBuild, photoQuality, sendToReview,
  type BuildRow, type BuildStatus, type PhotoQuality, type ReviewRow,
} from "@/lib/data/builds";
import { errMsg } from "@/lib/data/util";
import type { CheckItem } from "@/lib/checklist";

const variant: Record<BuildStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  procesando: "secondary",
  listo: "default",
  error: "destructive",
};
const PROJECT_STATUS: Record<string, string> = { borrador: "Borrador", revision: "En revisión", entregado: "Entregado", cerrado: "Cerrado" };

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Más de 90 s "En cola" casi siempre significa que el worker de la PC no está corriendo. */
const workerDormido = (b: BuildRow) => b.status === "pendiente" && Date.now() - new Date(b.created_at).getTime() > 90_000;

function Descarga({ path, filename, label, icon }: { path: string; filename: string; label: string; icon?: "paquete" }) {
  const [busy, setBusy] = useState(false);
  const Icon = icon === "paquete" ? PackageCheck : FileText;
  return (
    <Button
      variant={icon === "paquete" ? "default" : "outline"}
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
      <Icon aria-hidden="true" />
      {label}
    </Button>
  );
}

function NoteDialog({
  title, description, required, confirmLabel, busy, onClose, onConfirm,
}: {
  title: string; description: string; required: boolean; confirmLabel: string; busy: boolean;
  onClose: () => void; onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{required ? "Qué hay que corregir" : "Observaciones (opcional)"}</span>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button size="lg" disabled={busy || (required && note.trim() === "")} onClick={() => onConfirm(note.trim())}>
          {confirmLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function Informe({
  projectId, projectName, items, status, isAdmin,
}: { projectId: string; projectName: string; items: CheckItem[]; status: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["builds", projectId];
  const [quality, setQuality] = useState<PhotoQuality>("media");
  const [dialog, setDialog] = useState<{ kind: "aprobar" | "observar"; build: BuildRow } | null>(null);
  const { data: builds = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listBuilds(projectId),
    refetchInterval: (q) => (q.state.data?.some((b) => b.status === "pendiente" || b.status === "procesando") ? 4000 : false),
  });
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews", projectId], queryFn: () => listReviews(projectId) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["reviews", projectId] });
    void qc.invalidateQueries({ queryKey: ["project", projectId] });
  };
  const fail = (e: unknown) => toast.error(errMsg(e));
  const generate = useMutation({
    mutationFn: () => createBuild(projectId, quality),
    onSuccess: () => {
      toast.success("Informe en cola. Se genera en la PC de la consultora.");
      refresh();
    },
    onError: fail,
  });
  const review = useMutation({ mutationFn: () => sendToReview(projectId), onSuccess: () => { toast.success("Proyecto enviado a revisión"); refresh(); }, onError: fail });
  const approve = useMutation({
    mutationFn: (a: { id: string; note: string }) => approveBuild(a.id, a.note || null),
    onSuccess: () => { toast.success("Aprobado. Se genera la versión final sin marca de borrador."); setDialog(null); refresh(); },
    onError: fail,
  });
  const observe = useMutation({
    mutationFn: (a: { id: string; note: string }) => observeBuild(a.id, a.note),
    onSuccess: () => { toast.success("Observaciones registradas"); setDialog(null); refresh(); },
    onError: fail,
  });

  const pendientes = items.filter((i) => !i.done);
  const slug = projectName.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "informe";
  const byBuild = new Map<string, ReviewRow[]>();
  for (const r of reviews) byBuild.set(r.build_id, [...(byBuild.get(r.build_id) ?? []), r]);

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-xl font-semibold">Generar informe</h2>
          <Badge variant={status === "entregado" ? "default" : "secondary"}>{PROJECT_STATUS[status] ?? status}</Badge>
        </div>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          Arma el Word y el PDF con todos los capítulos del informe. Cada generación queda como una versión nueva y sale con el
          encabezado BORRADOR hasta que un administrador la apruebe.
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
          {status === "borrador" && builds.some((b) => b.status === "listo") && (
            <Button size="lg" variant="outline" disabled={review.isPending} onClick={() => review.mutate()}>
              Enviar a revisión
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="versiones">
        <h2 id="versiones" className="font-heading text-xl font-semibold">Versiones</h2>
        {isLoading && <p className="mt-2">Cargando…</p>}
        {!isLoading && builds.length === 0 && <p className="mt-2 text-base text-muted-foreground">Todavía no generaste ningún informe.</p>}
        <div className="mt-3 grid gap-3">
          {builds.map((b) => {
            const fin = isFinal(b);
            const rs = byBuild.get(b.id) ?? [];
            return (
              <Card key={b.id} className={fin ? "border-2 border-ok" : undefined}>
                <CardContent className="grid gap-3 pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <strong className="font-heading text-lg">Versión {b.version_num}</strong>
                    <Badge variant={variant[b.status]}>{buildStatusLabel[b.status]}</Badge>
                    {fin ? <Badge className="bg-ok text-white">Final aprobada</Badge> : <Badge variant="outline">Borrador</Badge>}
                    <span className="tnum text-sm text-muted-foreground">{fecha(b.created_at)}</span>
                  </div>

                  {workerDormido(b) && (
                    <p role="alert" className="text-sm text-warn">
                      Lleva más de un minuto en cola. Revisá que el worker esté corriendo en la PC de la consultora.
                    </p>
                  )}

                  {b.status === "listo" && (
                    <div className="flex flex-wrap gap-2">
                      {fin && b.package_path && (
                        <Descarga icon="paquete" path={b.package_path} filename={`${slug}_paquete_final.zip`} label="Descargar paquete final" />
                      )}
                      {b.docx_path && <Descarga path={b.docx_path} filename={`${slug}_v${b.version_num}.docx`} label="Descargar Word" />}
                      {b.pdf_path ? (
                        <Descarga path={b.pdf_path} filename={`${slug}_v${b.version_num}.pdf`} label="Descargar PDF" />
                      ) : (
                        <span className="self-center text-sm text-muted-foreground">Sin PDF (ver el registro).</span>
                      )}
                    </div>
                  )}

                  {b.status === "listo" && !fin && (
                    isAdmin ? (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button onClick={() => setDialog({ kind: "aprobar", build: b })}>Aprobar y generar versión final</Button>
                        <Button variant="outline" onClick={() => setDialog({ kind: "observar", build: b })}>Observar</Button>
                      </div>
                    ) : (
                      <p className="border-t pt-3 text-sm text-muted-foreground">Solo un administrador aprueba u observa las versiones.</p>
                    )
                  )}

                  {rs.length > 0 && (
                    <ul className="grid gap-1 border-t pt-3 text-sm">
                      {rs.map((r) => (
                        <li key={r.id}>
                          <strong className={r.decision === "aprobado" ? "text-ok" : "text-warn"}>
                            {r.decision === "aprobado" ? "Aprobada" : "Observada"}
                          </strong>{" "}
                          <span className="tnum text-muted-foreground">{fecha(r.created_at)}</span>
                          {r.note ? `: ${r.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}

                  {b.log && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-primary">Ver registro</summary>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-sm">{b.log}</pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {dialog?.kind === "aprobar" && (
        <NoteDialog
          title={`Aprobar la versión ${dialog.build.version_num}`}
          description="Se genera la versión final sin marca de borrador y el proyecto pasa a Entregado. Queda constancia de quién aprobó."
          required={false}
          confirmLabel="Aprobar"
          busy={approve.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(note) => approve.mutate({ id: dialog.build.id, note })}
        />
      )}
      {dialog?.kind === "observar" && (
        <NoteDialog
          title={`Observar la versión ${dialog.build.version_num}`}
          description="El proyecto vuelve a revisión. Indicá qué hay que corregir."
          required
          confirmLabel="Registrar observaciones"
          busy={observe.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(note) => observe.mutate({ id: dialog.build.id, note })}
        />
      )}
    </div>
  );
}
