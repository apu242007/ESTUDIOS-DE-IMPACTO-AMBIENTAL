"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GROUPS, flatSections } from "@/components/project/sections";
import type { SectionId } from "@/lib/checklist";
import { cn } from "@/lib/utils";

type Status = Partial<Record<SectionId, "ok" | "falta">>;
type Props = { section: SectionId; status: Status; isAdmin: boolean; onGo: (s: SectionId) => void };

const visibleGroups = (isAdmin: boolean) =>
  GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isAdmin) })).filter((g) => g.items.length > 0);

/** Listos sobre las secciones que tienen estado (Mapa o Resumen no cuentan). */
function tally(ids: SectionId[], status: Status) {
  const conEstado = ids.filter((id) => status[id]);
  const ok = conEstado.filter((id) => status[id] === "ok").length;
  return { ok, total: conEstado.length };
}

function Dot({ st, active }: { st: "ok" | "falta" | undefined; active?: boolean }) {
  if (!st) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-full", st === "ok" ? "bg-ok" : active ? "bg-jarilla" : "border-2 border-warn")}
    />
  );
}

/**
 * Navegación del proyecto en una línea horizontal (reemplaza la columna izquierda).
 * Escritorio: las 6 fases con su avance y, debajo, las secciones de la fase activa.
 * Celular: solo el avance por fase arriba; para moverse, la barra inferior (ver MobileSectionBar).
 */
export function PhaseNav({ section, status, isAdmin, onGo }: Props) {
  const groups = visibleGroups(isAdmin);
  const all = tally(groups.flatMap((g) => g.items.map((i) => i.id)), status);
  const activeGroup = groups.find((g) => g.items.some((i) => i.id === section)) ?? groups[0];

  return (
    <nav
      aria-label="Secciones del proyecto"
      className="-mx-4 border-b-2 border-basalto bg-background px-4 pt-2 sm:-mx-8 sm:px-8 md:sticky md:top-14 md:z-20"
    >
      <ol className="grid gap-1 sm:gap-3" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map((g) => {
          const { ok, total } = g.title === "Inicio" ? all : tally(g.items.map((i) => i.id), status);
          const active = g === activeGroup;
          return (
            <li key={g.title}>
              <button
                type="button"
                onClick={() => onGo(g.items[0].id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "-mb-0.5 grid w-full cursor-pointer gap-1.5 border-b-[3px] pb-2 pt-1 text-left transition-colors",
                  active ? "border-jarilla" : "border-transparent hover:border-border",
                )}
              >
                {/* en 360 px seis nombres no entran: solo las barras (la fase se lee en la barra inferior) */}
                <span className={cn("flex min-w-0 items-baseline justify-between gap-2 whitespace-nowrap font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                  <span className="sr-only sm:not-sr-only sm:truncate sm:text-base">{g.title}</span>
                  {total > 0 && <span className="tnum hidden font-mono text-xs font-medium md:inline">{ok}/{total}</span>}
                </span>
                <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-border">
                  <span
                    className="fill-x block h-full rounded-full bg-ok transition-[width] duration-500"
                    style={{ width: `${total > 0 ? (ok / total) * 100 : 0}%` }}
                  />
                </span>
                {total > 0 && <span className="sr-only">{ok} de {total} listos</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="hidden gap-2 overflow-x-auto py-3 md:flex">
        {activeGroup.items.map((it, idx) => {
          const active = it.id === section;
          const st = status[it.id];
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onGo(it.id)}
              aria-current={active ? "page" : undefined}
              style={{ "--i": idx } as React.CSSProperties}
              className={cn(
                "enter inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-4 text-base font-medium transition-colors",
                active ? "border-basalto bg-basalto text-white" : "bg-card hover:border-input",
              )}
            >
              <Dot st={st} active={active} />
              {it.label}
              {st && <span className="sr-only">{st === "ok" ? " — listo" : " — pendiente"}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Celular: Anterior / sección actual / Siguiente al alcance del pulgar. Tocar el nombre abre todas las secciones. */
export function MobileSectionBar({ section, status, isAdmin, onGo }: Props) {
  const [open, setOpen] = useState(false);
  const flow = flatSections(isAdmin);
  const at = flow.findIndex((s) => s.id === section);
  const prev = at > 0 ? flow[at - 1] : null;
  const next = at >= 0 && at < flow.length - 1 ? flow[at + 1] : null;
  const group = GROUPS.find((g) => g.items.some((i) => i.id === section));
  const go = (s: SectionId) => { setOpen(false); onGo(s); };
  const navBtn = "grid size-12 cursor-pointer place-items-center rounded-md bg-sidebar-accent text-white disabled:opacity-40";

  return (
    <>
      <nav
        aria-label="Moverse entre secciones"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-sidebar px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-sidebar-foreground md:hidden"
      >
        <button type="button" className={navBtn} disabled={!prev} onClick={() => prev && onGo(prev.id)} aria-label={prev ? `Anterior: ${prev.label}` : "Anterior"}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="grid min-h-12 cursor-pointer content-center justify-items-center rounded-md border border-sidebar-border px-2"
        >
          <span className="truncate text-base font-semibold text-white">{flow[at]?.label ?? "Secciones"}</span>
          <span className="tnum font-mono text-xs text-sidebar-foreground/70">
            {group?.title} · {at + 1} de {flow.length}
          </span>
        </button>
        <button type="button" className={navBtn} disabled={!next} onClick={() => next && onGo(next.id)} aria-label={next ? `Siguiente: ${next.label}` : "Siguiente"}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </button>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-h-[80vh] max-w-full translate-x-0 translate-y-0 gap-3 overflow-y-auto rounded-b-none rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] data-open:slide-in-from-bottom-10 data-open:zoom-in-100 sm:max-w-full">
          <DialogTitle className="text-xl font-semibold">Secciones</DialogTitle>
          {visibleGroups(isAdmin).map((g) => {
            const { ok, total } = tally(g.items.map((i) => i.id), status);
            return (
              <div key={g.title} className="grid gap-1.5">
                {g.title !== "Inicio" && (
                  <p className="flex justify-between pt-1 text-sm font-semibold text-primary">
                    <span>{g.title}</span>
                    {total > 0 && <span className="tnum font-mono">{ok}/{total}</span>}
                  </p>
                )}
                {g.items.map((it) => {
                  const active = it.id === section;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => go(it.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 text-left text-base font-medium",
                        active ? "border-basalto bg-basalto text-white" : "bg-card",
                      )}
                    >
                      <Dot st={status[it.id]} active={active} />
                      {it.label}
                      {status[it.id] && <span className="sr-only">{status[it.id] === "ok" ? " — listo" : " — pendiente"}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </DialogContent>
      </Dialog>
    </>
  );
}
