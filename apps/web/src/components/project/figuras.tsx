"use client";

import { EnCola } from "@/components/project/en-cola";
import Image from "next/image";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImageIcon, RefreshCw, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createFigure,
  deleteFigure,
  downloadFigureUrl,
  figureBaseLabel,
  figureBases,
  figureKindLabel,
  figureKinds,
  figureStatusLabel,
  listFigures,
  previewFigureUrl,
  type FigureBase,
  type FigureKind,
  type FigureRow,
  type FigureStatus,
} from "@/lib/data/figures";
import { errMsg } from "@/lib/data/util";
import { REQUIRED_FIGURES } from "@/lib/control";
import { cn } from "@/lib/utils";

const statusVariant: Record<FigureStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  procesando: "secondary",
  listo: "default",
  error: "destructive",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });


function FigureCard({ figure, projectId, queryKey }: {
  figure: FigureRow;
  projectId: string;
  queryKey: readonly [string, string];
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [downloading, setDownloading] = useState(false);
  const borrar = useMutation({
    mutationFn: () => deleteFigure(figure.id, figure.file_path),
    onSuccess: () => { toast.success("Figura borrada"); void queryClient.invalidateQueries({ queryKey: [...queryKey] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const { data: previewUrl } = useQuery({
    queryKey: ["figure-preview", figure.file_path],
    queryFn: () => previewFigureUrl(figure.file_path!),
    enabled: figure.status === "listo" && Boolean(figure.file_path),
    staleTime: 240_000,
  });
  const regenerate = useMutation({
    mutationFn: () => createFigure(projectId, figure.kind, figure.params),
    onSuccess: () => {
      toast.success("Figura nueva en cola.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(errMsg(error)),
  });

  const title = figureKindLabel[figure.kind];
  return (
    <Card>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-[12rem_1fr]">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? (
            <Image className="h-full w-full object-cover" src={previewUrl} alt={`Miniatura: ${title}`} width={384} height={288} unoptimized />
          ) : (
            <ImageIcon aria-hidden="true" className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="font-heading text-lg">{title}</strong>
            <Badge variant={statusVariant[figure.status]}>{figureStatusLabel[figure.status]}</Badge>
            <span className="tnum text-sm text-muted-foreground">{formatDate(figure.created_at)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {figureBaseLabel[figure.params.base]} · {figure.params.leyenda ? "Con leyenda" : "Sin leyenda"}
          </p>
          {figure.status === "pendiente" && <EnCola />}
          {figure.error && <p role="alert" className="text-sm text-destructive">{figure.error}</p>}
          <div className="flex flex-wrap gap-2">
            {figure.status === "listo" && figure.file_path && (
              <Button
                variant="outline"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    window.location.href = await downloadFigureUrl(figure.file_path!, `figura_${figure.kind}.png`);
                  } catch (error) {
                    toast.error(errMsg(error));
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                <Download aria-hidden="true" />
                {downloading ? "Preparando…" : "Descargar PNG"}
              </Button>
            )}
            <Button variant="outline" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
              <RefreshCw aria-hidden="true" />
              {regenerate.isPending ? "Enviando…" : "Regenerar"}
            </Button>
            <Button variant="outline" disabled={borrar.isPending || figure.status === "procesando"}
              onClick={() => void confirm({ title: "¿Borrar esta figura?", details: ["Se borra la imagen generada. Si el informe la usaba, en la próxima versión sale sin ella."], confirmLabel: "Borrar", danger: true }).then((ok) => ok && borrar.mutate())}>
              <Trash2 aria-hidden="true" />
              Borrar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Figuras({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["figures", projectId] as const;
  const [kind, setKind] = useState<FigureKind>("ubicacion");
  const [base, setBase] = useState<FigureBase>("satelite");
  const [legend, setLegend] = useState(true);
  const { data: figures = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFigures(projectId),
    refetchInterval: (query) =>
      query.state.data?.some((figure) => figure.status === "pendiente" || figure.status === "procesando") ? 4_000 : false,
  });
  const generate = useMutation({
    mutationFn: (k: FigureKind = kind) => createFigure(projectId, k, { base, leyenda: legend }),
    onSuccess: () => {
      toast.success("Figura en cola: se genera en unos minutos.");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(errMsg(error)),
  });

  // la figura más reciente de cada tipo (la lista viene de la más nueva a la más vieja)
  const ultima = (k: FigureKind) => figures.find((f) => f.kind === k);

  return (
    <div className="grid gap-6">
      {/* las que pide el informe, cada una con su estado y su botón: no hace falta buscarla en el desplegable */}
      <section aria-labelledby="figuras-informe" className="grid gap-3">
        <h2 id="figuras-informe" className="text-xl font-bold [font-stretch:100%]">Figuras del informe</h2>
        <ul className="grid gap-px p-px sm:grid-cols-3">
          {REQUIRED_FIGURES.map((k) => {
            const f = ultima(k);
            const estado = !f ? "Falta generarla" : figureStatusLabel[f.status];
            const lista = f?.status === "listo";
            return (
              <li key={k} className="grid content-between gap-3 bg-card p-4 shadow-[0_0_0_1px_var(--border)]">
                <div>
                  <p className="font-bold">{figureKindLabel[k]}</p>
                  <p className={cn("text-sm", lista ? "text-ok" : f ? "text-muted-foreground" : "text-warn")}>{estado}</p>
                </div>
                <Button variant={lista ? "outline" : "default"} disabled={generate.isPending || f?.status === "pendiente" || f?.status === "procesando"}
                  onClick={() => generate.mutate(k)}>
                  {lista ? "Volver a generar" : "Generar"}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">Se generan con el fondo y la leyenda elegidos abajo.</p>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-heading text-xl font-semibold">Generar figura</h2>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          Generá mapas listos para incorporar al informe a partir de las capas, pozos y puntos relevados del proyecto.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Tipo</span>
            <NativeSelect value={kind} onChange={(event) => setKind(event.target.value as FigureKind)}>
              {figureKinds.map((value) => <option key={value} value={value}>{figureKindLabel[value]}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Fondo</span>
            <NativeSelect value={base} onChange={(event) => setBase(event.target.value as FigureBase)}>
              {figureBases.map((value) => <option key={value} value={value}>{figureBaseLabel[value]}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Leyenda</span>
            <NativeSelect value={legend ? "con" : "sin"} onChange={(event) => setLegend(event.target.value === "con")}>
              <option value="con">Con</option>
              <option value="sin">Sin</option>
            </NativeSelect>
          </label>
          <Button size="lg" disabled={generate.isPending} onClick={() => generate.mutate(kind)}>
            {generate.isPending ? "Enviando…" : "Generar"}
          </Button>
        </div>
      </section>

      <section aria-labelledby="figuras-generadas">
        <h2 id="figuras-generadas" className="font-heading text-xl font-semibold">Figuras generadas</h2>
        {isLoading && <p className="mt-2">Cargando…</p>}
        {!isLoading && figures.length === 0 && (
          <p className="mt-2 text-base text-muted-foreground">Todavía no generaste ninguna figura.</p>
        )}
        <div className="mt-3 grid gap-3">
          {figures.map((figure) => (
            <FigureCard key={figure.id} figure={figure} projectId={projectId} queryKey={queryKey} />
          ))}
        </div>
      </section>
    </div>
  );
}
