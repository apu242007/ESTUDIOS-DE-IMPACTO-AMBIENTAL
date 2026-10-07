"use client";

import { useQuery } from "@tanstack/react-query";
import type { SectionId } from "@/lib/checklist";
import { listCompare } from "@/lib/data/features";
import { listImpacts, loadImpactCatalog } from "@/lib/data/impacts";
import { loadInterferencias } from "@/lib/data/interferencias";
import { listWaypointsTraza } from "@/lib/data/summary";
import { severityLevel } from "@/lib/impacts";
import { desvios, porTipo, topImpactos, trazas, type Desvio } from "@/lib/tablero";
import type { Thresholds } from "@/lib/threshold";
import { cn } from "@/lib/utils";

const fmt = (n: number, d = 2) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Bloque del tablero: título con su dato de contexto, una frase que dice cómo leerlo y el gráfico. Sin tarjeta. */
function Bloque({ titulo, dato, ayuda, children, onGo, ir, className }: {
  titulo: string; dato?: string; ayuda: string; children: React.ReactNode; onGo: () => void; ir: string; className?: string;
}) {
  return (
    <section className={cn("grid content-start gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-[1.5px] border-foreground pb-2">
        <h3 className="text-xl font-bold [font-stretch:100%]">{titulo}</h3>
        {dato && <span className="tnum font-heading text-sm text-muted-foreground">{dato}</span>}
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">{ayuda}</p>
      {children}
      <button type="button" onClick={onGo} className="justify-self-start text-sm font-bold text-primary underline-offset-4 hover:underline">
        {ir}
      </button>
    </section>
  );
}

const Vacio = ({ children }: { children: React.ReactNode }) => (
  <p className="border border-dashed border-input px-4 py-6 text-sm text-muted-foreground">{children}</p>
);

/** Perfil de desvíos: barra divergente desde cero, con la franja verde del umbral. Escala fija ±10 %. */
function Perfil({ filas }: { filas: Desvio[] }) {
  const MAX = 10;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5">
        {filas.map((f, i) => {
          const w = f.pct === null ? 0 : (Math.min(Math.abs(f.pct), MAX) / MAX) * 50;
          const banda = (Math.min(f.umbralPct, MAX) / MAX) * 50;
          return (
            <li key={`${f.name}-${i}`} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_4.25rem] items-center gap-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem] sm:gap-3">
              <span className="truncate" title={f.name}>{f.name}</span>
              <span className="relative h-5" role="img" aria-label={f.pct === null ? `${f.name}: sin geometría` : `${f.name}: ${fmt(f.pct)} %, ${f.estado === "dentro" ? "dentro" : "fuera"} del umbral`}>
                <span className="absolute inset-y-0 bg-ok/15" style={{ left: `${50 - banda}%`, width: `${banda * 2}%` }} />
                <span className="absolute inset-y-0 left-1/2 w-px bg-foreground" />
                {f.pct !== null && (
                  <span
                    className={cn("fill-x absolute top-1 h-3", f.estado === "dentro" ? "bg-ok" : "bg-[#d9772b]")}
                    style={{
                      left: f.pct < 0 ? `${50 - Math.max(w, 0.8)}%` : "50%",
                      width: `${Math.max(w, 0.8)}%`,
                      transformOrigin: f.pct < 0 ? "right" : "left",
                      "--i": i,
                    } as React.CSSProperties}
                  />
                )}
              </span>
              <span className={cn("tnum text-right font-heading font-bold", f.pct === null && "font-normal text-muted-foreground")}>
                {f.pct === null ? "—" : `${f.pct > 0 ? "+" : ""}${fmt(f.pct)} %`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><i className="mr-1.5 inline-block h-2 w-3.5 bg-ok align-middle" />dentro del umbral</span>
        <span><i className="mr-1.5 inline-block h-2 w-3.5 bg-[#d9772b] align-middle" />fuera del umbral</span>
        <span><i className="mr-1.5 inline-block h-2 w-3.5 bg-ok/15 align-middle" />franja del umbral</span>
        <span>escala ±10 %</span>
      </p>
    </div>
  );
}

const W = 420, H = 220;

/** La traza real: waypoints en su posición GK (norte arriba). Lleno = cruzado con el GPS; hueco = sin cruzar. */
function Traza({ projectId }: { projectId: string }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["traza", projectId], queryFn: () => listWaypointsTraza(projectId) });
  if (isLoading) return <div className="h-48 animate-pulse bg-muted" />;
  const t = trazas(data, W, H);
  const cruzados = data.filter((w) => w.matched).length;
  if (data.length === 0) return <Vacio>Todavía no hay waypoints relevados.</Vacio>;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full bg-[#fbfaf7]" role="img"
        aria-label={`${data.length} waypoints: ${cruzados} cruzados con el GPS, ${data.length - cruzados} sin cruzar, ${t.sinPosicion} sin posición`}>
        {t.lineas.map((l) => (
          <g key={l.lineId}>
            <polyline points={l.puntos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--curva)" strokeWidth="1.3" className="trazo" />
            {l.puntos.map((p, i) => p.matched
              ? <circle key={i} cx={p.x} cy={p.y} r="2.3" fill="var(--ok)" />
              : <circle key={i} cx={p.x} cy={p.y} r="3.4" fill="#fff" stroke="var(--destructive)" strokeWidth="1.6" />)}
          </g>
        ))}
        {/* flecha de norte, como en una carta */}
        <g transform={`translate(${W - 16} 8)`} aria-hidden="true">
          <path d="M5 0 L10 14 L5 10.5 L0 14 Z" fill="var(--foreground)" />
          <text x="5" y="25" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)" fontFamily="var(--font-rot)">N</text>
        </g>
      </svg>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div><dt className="text-muted-foreground">Waypoints</dt><dd className="tnum font-heading text-2xl font-bold">{data.length}</dd></div>
        <div><dt className="text-muted-foreground">Con GPS</dt><dd className="tnum font-heading text-2xl font-bold text-ok">{cruzados}</dd></div>
        <div><dt className="text-muted-foreground">Sin cruzar</dt><dd className="tnum font-heading text-2xl font-bold text-destructive">{data.length - cruzados}</dd></div>
        {t.sinPosicion > 0 && <div><dt className="text-muted-foreground">Sin posición</dt><dd className="tnum font-heading text-2xl font-bold">{t.sinPosicion}</dd></div>}
      </dl>
    </>
  );
}

const TIPO_COLOR = ["var(--primary)", "#5b8fc7", "var(--curva)", "var(--foreground)", "#8a8178", "var(--ok)", "#c9a27a", "#a3bfdc"];

function Interferencias({ orgId, projectId }: { orgId: string; projectId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["interferencias", projectId], queryFn: () => loadInterferencias(orgId, projectId) });
  if (isLoading) return <div className="h-24 animate-pulse bg-muted" />;
  const tipos = porTipo(data?.rows ?? []);
  if (tipos.length === 0) return <Vacio>Todavía no hay interferencias con posición.</Vacio>;
  return (
    <>
      <div className="flex h-7 border-[1.5px] border-foreground" role="img" aria-label={tipos.map((t) => `${t.figura}: ${t.n}`).join(", ")}>
        {tipos.map((t, i) => <span key={t.figura} className="border-r border-card last:border-r-0" style={{ flex: t.n, background: TIPO_COLOR[i % TIPO_COLOR.length] }} />)}
      </div>
      <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {tipos.map((t, i) => (
          <li key={t.figura} className="flex items-baseline justify-between gap-3 border-b border-dotted border-border py-0.5">
            <span><i className="mr-2 inline-block size-2.5 align-middle" style={{ background: TIPO_COLOR[i % TIPO_COLOR.length] }} />{t.figura}</span>
            <span className="tnum font-heading font-bold">{t.n}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Mapa de calor de la matriz (escritorio) y los impactos más fuertes en lista (celular, donde la grilla no se lee). */
const CALOR = ["#dcebd9", "#efd9a6", "#d9772b", "#b42318"];
const calorTexto = (lvl: number) => (lvl >= 2 ? "#fff" : "var(--foreground)");

function Matriz({ orgId, projectId }: { orgId: string; projectId: string }) {
  const { data: cat } = useQuery({ queryKey: ["impact-catalog", orgId], queryFn: () => loadImpactCatalog(orgId) });
  const { data: imps = [], isLoading } = useQuery({ queryKey: ["impacts", projectId], queryFn: () => listImpacts(projectId) });
  if (isLoading || !cat) return <div className="h-40 animate-pulse bg-muted" />;
  if (imps.length === 0) return <Vacio>La matriz todavía está vacía.</Vacio>;
  const by = new Map(imps.map((i) => [`${i.factor_id}|${i.action_id}`, i]));
  const usadas = cat.actions.filter((a) => imps.some((i) => i.action_id === a.id));
  const factores = cat.factors.filter((f) => imps.some((i) => i.factor_id === f.id));
  const top = topImpactos(imps, new Map(cat.actions.map((a) => [a.id, a.name])), new Map(cat.factors.map((f) => [f.id, f.name])), 6);
  const color = (category: string | null) => {
    const lvl = severityLevel(category, cat.categories);
    return lvl === "positivo" ? { bg: "#dbe7f4", fg: "var(--foreground)" } : typeof lvl === "number" ? { bg: CALOR[Math.min(lvl, 3)], fg: calorTexto(lvl) } : null;
  };
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="border-separate [border-spacing:2px] text-xs">
          <thead>
            <tr>
              <th />
              {usadas.map((a) => (
                <th key={a.id} scope="col" className="h-28 w-7 align-bottom font-normal text-muted-foreground">
                  <span className="inline-block w-4 origin-bottom-left translate-x-3 -rotate-[58deg] whitespace-nowrap">{a.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factores.map((f) => (
              <tr key={f.id}>
                <th scope="row" className="whitespace-nowrap pr-2 text-left font-normal text-muted-foreground">{f.name}</th>
                {usadas.map((a) => {
                  const im = by.get(`${f.id}|${a.id}`);
                  const c = im ? color(im.category) : null;
                  return (
                    <td key={a.id} title={im?.importance != null ? `${f.name} × ${a.name}: ${im.importance} ${im.category ?? ""}` : `${f.name} × ${a.name}: sin impacto`}
                      className="size-7 text-center font-bold" style={{ background: c?.bg ?? "var(--muted)", color: c ? "transparent" : undefined }}>
                      <span className="sr-only">{im?.importance ?? "sin impacto"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex">{CALOR.map((c) => <i key={c} className="h-2.5 w-7" style={{ background: c }} />)}</span>
          {cat.categories.filter((c) => c.applies_to === "negativo").sort((a, b) => a.min_abs - b.min_abs).map((c) => c.label).join(" → ")}
        </p>
      </div>
      <ol className="grid gap-1.5 md:hidden">
        {top.map((t, i) => {
          const c = color(t.category);
          return (
            <li key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 text-sm">
              <span className="tnum py-1 text-center font-heading font-bold" style={{ background: c?.bg, color: c?.fg }}>{t.importance}</span>
              <span><b>{t.accion}</b> sobre {t.factor.toLowerCase()}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Tablero del proyecto: composición asimétrica 1,55 / 1 en escritorio, una columna en el celular. */
export function Tablero({ orgId, projectId, thresholds, onGo }: { orgId: string; projectId: string; thresholds: Thresholds; onGo: (s: SectionId) => void }) {
  const { data: obras = [], isLoading } = useQuery({ queryKey: ["works-compare", projectId], queryFn: () => listCompare(projectId) });
  const filas = desvios(obras, thresholds);
  const fuera = filas.filter((f) => f.estado === "fuera").length;
  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <Bloque
        titulo="Declarado contra calculado"
        dato={`umbral ${thresholds.pct} % o ${thresholds.abs_m} m`}
        ayuda={fuera ? `${fuera} de ${filas.length} obras quedan fuera del umbral. La franja verde es la tolerancia de cada obra.` : "Cada barra es la diferencia entre lo declarado y lo que mide la capa; la franja verde es la tolerancia."}
        onGo={() => onGo("comparacion")}
        ir="Ver la comparación"
      >
        {isLoading ? <div className="h-48 animate-pulse bg-muted" /> : filas.length ? <Perfil filas={filas} /> : <Vacio>Todavía no hay obras en el alcance.</Vacio>}
      </Bloque>
      <Bloque titulo="Relevamiento" ayuda="Los waypoints en su posición real (norte arriba). Los huecos rojos todavía no tienen el cruce con el GPS." onGo={() => onGo("relevamiento")} ir="Ir al relevamiento">
        <Traza projectId={projectId} />
      </Bloque>
      <Bloque titulo="Interferencias por tipo" ayuda="Lo que va a la tabla del informe, agrupado por figura." onGo={() => onGo("interferencias")} ir="Ver la tabla">
        <Interferencias orgId={orgId} projectId={projectId} />
      </Bloque>
      <Bloque titulo="Matriz de impactos" ayuda="Acciones contra factores; el color es la importancia. En el celular, los impactos más fuertes." onGo={() => onGo("impactos")} ir="Abrir la matriz">
        <Matriz orgId={orgId} projectId={projectId} />
      </Bloque>
    </div>
  );
}
