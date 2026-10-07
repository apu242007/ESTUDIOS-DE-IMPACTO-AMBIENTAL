"use client";

import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextStep, progress, type CheckItem, type SectionId } from "@/lib/checklist";
import { cn } from "@/lib/utils";

export function Resumen({
  items, loading, error, onGo, canSkip = false, skipping = false, onSkip, children,
}: {
  /** El tablero del proyecto va entre el siguiente paso y el recorrido. */
  children?: React.ReactNode;
  items: CheckItem[]; loading: boolean; error: string | null; onGo: (s: SectionId) => void;
  /** Solo un admin puede omitir pasos (la base lo exige igual, migración 0021). */
  canSkip?: boolean; skipping?: boolean; onSkip?: (item: CheckItem, skip: boolean) => void;
}) {
  const next = nextStep(items);
  const { done, total } = progress(items);

  if (loading) return <p className="text-muted-foreground">Calculando el estado del proyecto…</p>;
  // Sin la lista no hay "siguiente paso": antes, si la consulta fallaba, se mostraba "Todo listo".
  if (error || items.length === 0) {
    return (
      <p role="alert" className="max-w-prose rounded-md border border-warn bg-warn/10 p-4 text-base">
        No se pudo calcular el estado del proyecto{error ? ` (${error})` : ""}. Podés seguir en otra sección.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {/* Siguiente paso: la única franja amarilla de la pantalla (el amarillo se reserva para lo activo) */}
      <section aria-labelledby="sig" className={cn("grid gap-4 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", next ? "bg-senal text-foreground" : "border-[1.5px] border-ok bg-card")}>
        <div className="min-w-0">
          <h2 id="sig" className="text-sm font-bold [font-stretch:100%]">{next ? "Siguiente paso" : "Todo listo"}</h2>
          {next ? (
            <>
              <p className="mt-1 font-heading text-3xl font-extrabold leading-tight [font-stretch:112%] sm:text-4xl">{next.label}</p>
              <p className="mt-1 max-w-prose text-base">{next.detail}</p>
            </>
          ) : (
            <p className="mt-1 max-w-prose text-lg">Los datos, capas, relevamiento y GPS están completos. Ya podés revisar los resultados.</p>
          )}
        </div>
        {next && (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="bg-foreground text-white hover:bg-foreground/90" onClick={() => onGo(next.section)}>
              Ir a {next.label.toLowerCase()}
              <ArrowRight aria-hidden="true" />
            </Button>
            {canSkip && onSkip && (
              <Button size="lg" variant="outline" className="border-foreground bg-transparent hover:bg-foreground/10" disabled={skipping} onClick={() => onSkip(next, true)}>
                Omitir
              </Button>
            )}
          </div>
        )}
      </section>

      {children}

      <section aria-labelledby="lista">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="lista" className="text-2xl font-bold [font-stretch:100%]">Recorrido del proyecto</h2>
          <p className="tnum text-sm text-muted-foreground" aria-live="polite">
            {done} de {total} listos
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avance del proyecto">
          <div className="fill-x h-full bg-ok" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
        </div>

        {/* Transecta: cada paso es un waypoint sobre la línea */}
        <ol className="mt-5">
          {items.map((i, idx) => {
            const isNext = next?.id === i.id;
            return (
              <li key={i.id} className="enter relative" style={{ "--i": idx } as React.CSSProperties}>
                {idx < items.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-[1.05rem] top-9 bottom-[-0.25rem] w-0.5",
                      i.skipped ? "bg-muted-foreground/40" : i.done ? "line-y bg-ok" : "border-l-2 border-dashed border-border")}
                  />
                )}
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onGo(i.section)}
                  className="group flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-md py-2 pr-3 text-left transition-colors hover:bg-card"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "tnum relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 font-mono text-sm font-medium",
                      i.skipped && "border-muted-foreground/40 bg-muted text-muted-foreground",
                      i.done && !i.skipped && "border-ok bg-ok text-white",
                      !i.done && isNext && "pulse-ring border-jarilla bg-jarilla text-basalto",
                      !i.done && !isNext && "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {i.skipped ? <Minus className="size-5" /> : i.done ? <Check className="pop size-5" /> : String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="text-base font-semibold">
                      {i.label}
                      <span className="sr-only">{i.skipped ? " — omitido" : i.done ? " — listo" : isNext ? " — siguiente" : " — pendiente"}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {i.skipped && <strong className="font-semibold text-foreground">Omitido · </strong>}
                      {i.detail}
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
                {canSkip && onSkip && (!i.done || i.skipped) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 shrink-0"
                    disabled={skipping}
                    onClick={() => onSkip(i, !i.skipped)}
                    aria-label={`${i.skipped ? "Deshacer omisión de" : "Omitir"} ${i.label}`}
                  >
                    {i.skipped ? "Deshacer" : "Omitir"}
                  </Button>
                )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
