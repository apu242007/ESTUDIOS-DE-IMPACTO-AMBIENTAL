"use client";

import { ArrowRight, Check } from "lucide-react";
import { Contours } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { nextStep, progress, type CheckItem, type SectionId } from "@/lib/checklist";
import { cn } from "@/lib/utils";

export function Resumen({
  items, loading, error, onGo,
}: { items: CheckItem[]; loading: boolean; error: string | null; onGo: (s: SectionId) => void }) {
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
      <section aria-labelledby="sig" className="relative isolate overflow-hidden rounded-lg bg-basalto p-6 text-white sm:p-8">
        <Contours className="drift pointer-events-none absolute -right-24 -top-24 -z-10 size-[34rem] text-jarilla/20" />
        <h2 id="sig" className="text-base font-semibold text-jarilla">
          {next ? "Siguiente paso" : "Todo listo"}
        </h2>
        {next ? (
          <>
            <p className="mt-2 font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{next.label}</p>
            <p className="mt-2 max-w-prose text-base text-white/75">{next.detail}</p>
            <Button variant="jarilla" size="lg" className="mt-5" onClick={() => onGo(next.section)}>
              Ir a {next.label.toLowerCase()}
              <ArrowRight aria-hidden="true" />
            </Button>
          </>
        ) : (
          <p className="mt-2 max-w-prose text-lg">
            Los datos, capas, relevamiento y GPS están completos. Ya podés revisar los resultados.
          </p>
        )}
      </section>

      <section aria-labelledby="lista">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="lista" className="font-heading text-2xl font-semibold tracking-tight">Recorrido del proyecto</h2>
          <p className="tnum text-sm text-muted-foreground" aria-live="polite">
            {done} de {total} listos
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avance del proyecto">
          <div className="fill-x h-full rounded-full bg-ok" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
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
                    className={cn("absolute left-[1.05rem] top-9 bottom-[-0.25rem] w-0.5", i.done ? "line-y bg-ok" : "border-l-2 border-dashed border-border")}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onGo(i.section)}
                  className="group flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-md py-2 pr-3 text-left transition-colors hover:bg-card"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "tnum relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 font-mono text-sm font-medium",
                      i.done && "border-ok bg-ok text-white",
                      !i.done && isNext && "pulse-ring border-jarilla bg-jarilla text-basalto",
                      !i.done && !isNext && "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {i.done ? <Check className="pop size-5" /> : String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="text-base font-semibold">
                      {i.label}
                      <span className="sr-only">{i.done ? " — listo" : isNext ? " — siguiente" : " — pendiente"}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{i.detail}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
