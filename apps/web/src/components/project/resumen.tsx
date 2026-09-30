"use client";

import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextStep, progress, type CheckItem, type SectionId } from "@/lib/checklist";
import { cn } from "@/lib/utils";

export function Resumen({
  items, loading, onGo,
}: { items: CheckItem[]; loading: boolean; onGo: (s: SectionId) => void }) {
  const next = nextStep(items);
  const { done, total } = progress(items);

  if (loading) return <p className="text-muted-foreground">Calculando el estado del proyecto…</p>;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="sig" className="rounded-xl border-2 border-primary bg-card p-5 sm:p-6">
        <h2 id="sig" className="text-base font-semibold text-primary">
          {next ? "Siguiente paso" : "Todo listo"}
        </h2>
        {next ? (
          <>
            <p className="mt-2 font-heading text-2xl font-semibold">{next.label}</p>
            <p className="mt-1 max-w-prose text-base text-muted-foreground">{next.detail}</p>
            <Button size="lg" className="mt-4" onClick={() => onGo(next.section)}>
              Ir a {next.label.toLowerCase()}
              <ArrowRight aria-hidden="true" />
            </Button>
          </>
        ) : (
          <p className="mt-2 max-w-prose text-base">
            Los datos, capas, relevamiento y GPS están completos. Ya podés revisar los resultados.
          </p>
        )}
      </section>

      <section aria-labelledby="lista">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="lista" className="font-heading text-xl font-semibold">Estado del proyecto</h2>
          <p className="tnum text-sm text-muted-foreground" aria-live="polite">
            {done} de {total} listos
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avance del proyecto">
          <div className="h-full bg-ok transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
        </div>

        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onGo(i.section)}
                className="flex min-h-16 w-full cursor-pointer items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2",
                    i.done ? "border-ok bg-ok text-white" : "border-warn text-warn",
                  )}
                >
                  {i.done ? <Check className="size-5" /> : <span className="size-2 rounded-full bg-warn" />}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="text-base font-medium">
                    {i.label}
                    <span className="sr-only">{i.done ? " — listo" : " — pendiente"}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{i.detail}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
