"use client";

import { useConfirm } from "@/components/confirm";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SelectAdd } from "@/components/select-add";
import { workKindLabel, workKinds } from "@/lib/alcance-parser";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCode } from "@/lib/data/admin";
import { addPhotoCategory, listCodes, listPhotoCategories } from "@/lib/data/catalogs";
import { errMsg } from "@/lib/data/util";
import { listWorks } from "@/lib/data/works";
import { formatDms } from "@/lib/geo/dms";
import { getDb, type LineRec, type WaypointRec } from "@/lib/offline/db";
import { DIRECTIONS, compressPhoto, joinViews, pickCategory, splitViews } from "@/lib/offline/photos";
import { supabaseRemote } from "@/lib/offline/remote";
import { addPhoto, addWaypoint, createLine, deleteLine, deletePhoto, deleteWaypoint, saveLine, saveWaypoint } from "@/lib/offline/repo";
import { syncOutbox } from "@/lib/offline/sync";
import { useOnline } from "@/lib/offline/use-online";

/** Campo de texto que guarda al salir (evita escribir en IndexedDB a cada tecla). */
function Txt({
  value, label, onSave, list, type = "text", inputMode, className,
}: {
  value: string | number | null; label: string; onSave: (v: string | null) => void;
  list?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; className?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        key={String(value ?? "")}
        className={className ?? "h-12"}
        type={type}
        inputMode={inputMode}
        list={list}
        defaultValue={value ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== String(value ?? "")) onSave(v === "" ? null : v);
        }}
      />
    </label>
  );
}

function Thumb({ blob, uploaded, onRemove }: { blob: Blob; uploaded: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  // tocar la miniatura no hace nada: con guantes es fácil rozarla; quitar va en su propio botón
  return (
    <figure className="grid w-24 gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-24 rounded-md border object-cover" />
      <figcaption className={`text-center text-xs font-semibold ${uploaded ? "text-ok" : "text-warn"}`}>
        {uploaded ? "Subida" : "Sin subir"}
      </figcaption>
      <Button type="button" variant="outline" className="h-11 w-full" aria-label={uploaded ? "Quitar foto" : "Quitar foto (todavía sin subir)"} onClick={onRemove}>
        Quitar
      </Button>
    </figure>
  );
}

// GeolocationPositionError: 1 permiso, 2 sin señal, 3 tiempo agotado (los mensajes del navegador vienen en inglés)
const GEO_ERROR: Record<number, string> = {
  1: "Sin permiso de ubicación: habilitalo para este sitio en el navegador.",
  2: "No hay señal de ubicación. Probá al aire libre; si no, la posición sale del GPS de mano.",
  3: "El GPS del teléfono tardó demasiado. Probá de nuevo en unos segundos.",
};

function WaypointCard({
  wp, orgId, codes, category, isNew, onDelete,
}: {
  wp: WaypointRec; orgId: string; codes: { code: string; meaning: string }[]; category: string; isNew: boolean;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const photos = useLiveQuery(() => getDb().photos.where("waypointId").equals(wp.id).toArray(), [wp.id]) ?? [];
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [locating, setLocating] = useState(false);
  const views = splitViews(wp.views);

  // el waypoint recién agregado queda a la vista, sin abrir el teclado
  useEffect(() => {
    if (isNew) card.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isNew]);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Este dispositivo no tiene GPS.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        void saveWaypoint(wp.id, {
          lat: p.coords.latitude, lon: p.coords.longitude, elevationM: p.coords.altitude, source: "telefono",
        });
        toast.success(`Posición tomada (precisión ±${Math.round(p.coords.accuracy)} m)`);
      },
      (e) => {
        setLocating(false);
        toast.error(GEO_ERROR[e.code] ?? "No se pudo obtener la posición.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // comprimir tarda: se muestra el avance y se bloquea el botón para que un doble toque no duplique fotos
  const [processing, setProcessing] = useState<{ i: number; n: number } | null>(null);
  const onPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    try {
      for (const [i, f] of list.entries()) {
        setProcessing({ i: i + 1, n: list.length });
        try {
          const blob = await compressPhoto(f);
          await addPhoto({ orgId, projectId: wp.projectId, lineId: wp.lineId, waypointId: wp.id, category, caption: null, heading: wp.views, blob });
        } catch (e) {
          toast.error(errMsg(e));
        }
      }
    } finally {
      setProcessing(null);
    }
  };

  const setNumber = (n: number | null) => void saveWaypoint(wp.id, { number: n === null ? null : Math.max(0, n) });
  const dms = wp.lat !== null && wp.lon !== null ? formatDms(wp.lat, wp.lon) : null;

  return (
    <Card ref={card}>
      <CardContent className="grid gap-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-[13rem_1fr_2fr]">
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground" id={`wpn-${wp.id}`}>N° waypoint</span>
            {/* −/+ para no abrir el teclado: el N° casi siempre es el anterior + 1 */}
            <div className="flex gap-1" role="group" aria-labelledby={`wpn-${wp.id}`}>
              <Button type="button" variant="outline" className="size-12 text-lg" aria-label="Restar uno" onClick={() => setNumber((wp.number ?? 1) - 1)}>−</Button>
              <Input
                key={String(wp.number ?? "")}
                className="h-12 w-20 text-center tnum"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-labelledby={`wpn-${wp.id}`}
                defaultValue={wp.number ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") return setNumber(null);
                  if (!/^\d+$/.test(v)) { e.target.value = String(wp.number ?? ""); return toast.error("El N° de waypoint es un número entero."); }
                  if (Number(v) !== wp.number) setNumber(Number(v));
                }}
              />
              <Button type="button" variant="outline" className="size-12 text-lg" aria-label="Sumar uno" onClick={() => setNumber((wp.number ?? 0) + 1)}>+</Button>
            </div>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Sigla</span>
            <SelectAdd
              className="h-12"
              value={wp.code ?? ""}
              onValue={(v) => void saveWaypoint(wp.id, { code: v || null })}
              canAdd={isAdmin}
              fields={["Sigla", "Significado"]}
              onAdd={async ([code, meaning]) => {
                await addCode(orgId, code, meaning, codes.length);
                await qc.invalidateQueries({ queryKey: ["codes", orgId] });
                return code;
              }}
            >
              <option value="">—</option>
              {codes.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.meaning}</option>
              ))}
            </SelectAdd>
          </label>
          <Txt label="Observaciones (opcional)" value={wp.description} onSave={(v) => void saveWaypoint(wp.id, { description: v })} />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Direcciones de las fotos">
          {DIRECTIONS.map((d) => {
            const on = views.includes(d);
            return (
              <Button
                key={d}
                type="button"
                variant={on ? "default" : "outline"}
                className="h-12 min-w-12"
                aria-pressed={on}
                onClick={() => void saveWaypoint(wp.id, { views: joinViews(on ? views.filter((x) => x !== d) : [...views, d]) })}
              >
                {d}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={(e) => { void onPhotos(e.target.files); e.target.value = ""; }} />
          <Button className="h-12" disabled={processing !== null} onClick={() => file.current?.click()}>
            {processing ? `Procesando ${processing.i} de ${processing.n}…` : "Sacar foto"}
          </Button>
          <Button variant="outline" className="h-12" disabled={locating} onClick={locate}>
            <LocateFixed aria-hidden="true" />
            {locating ? "Buscando posición…" : dms ? "Volver a tomar posición" : "Tomar posición"}
          </Button>
        </div>
        {dms && (
          <p className="tnum font-mono text-sm text-muted-foreground">
            {dms.lat} · {dms.lon}
            {wp.elevationM !== null && ` · ${Math.round(wp.elevationM)} m`}
          </p>
        )}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <Thumb key={p.id} blob={p.blob} uploaded={p.uploaded} onRemove={() => { void confirm({ title: "¿Quitar esta foto?", confirmLabel: "Quitar", danger: true }).then((ok) => { if (ok) void deletePhoto(p.id); }); }} />
            ))}
          </div>
        )}
        {/* quitar va aparte, al pie y en rojo: lejos de "Sacar foto" y "Tomar posición", que se tocan a cada rato */}
        <div className="border-t pt-3">
          <Button
            variant="destructive"
            className="h-12"
            onClick={() => { void confirm({ title: `¿Quitar el waypoint ${wp.number ?? ""}?`, details: ["Se quitan también sus fotos."], confirmLabel: "Quitar waypoint", danger: true }).then((ok) => ok && onDelete()); }}
          >
            Quitar waypoint {wp.number ?? ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type SyncState = { pending: number; online: boolean; busy: boolean; onSync: () => void };

/** Estado de subida visible en la lista y dentro de la ficha (en el campo se mira sin salir de la ficha). */
function SyncStrip({ pending, online, busy, onSync }: SyncState) {
  const msg = !online
    ? `Sin conexión. ${pending} ${pending === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo, sin subir.`
    : busy
      ? "Subiendo cambios…"
      : pending > 0
        ? `${pending} ${pending === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo, sin subir.`
        : "Todo subido.";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2">
      <p role="status" aria-live="polite" className={`text-sm font-medium ${pending > 0 ? "text-warn" : "text-ok"}`}>{msg}</p>
      {pending > 0 && (
        <Button variant="outline" className="h-12" disabled={busy || !online} onClick={onSync}>Sincronizar ahora</Button>
      )}
    </div>
  );
}

/** Hasta 4 valores ya usados en este proyecto, para cargar con un toque en vez de escribir. */
function Recientes({ values, current, onPick }: { values: string[]; current: string | null; onPick: (v: string) => void }) {
  const shown = values.filter((v) => v !== current).slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((v) => (
        <Button key={v} type="button" variant="outline" className="h-11 max-w-full truncate" onClick={() => onPick(v)}>{v}</Button>
      ))}
    </div>
  );
}

const CAT_KEY = "eia.relevamiento.categoriaFoto";
function readCat(): string | null {
  try { return localStorage.getItem(CAT_KEY); } catch { return null; }
}
function writeCat(v: string) {
  try { localStorage.setItem(CAT_KEY, v); } catch { /* sin almacenamiento: solo no se recuerda */ }
}

function FichaEditor({ line, orgId, onBack, sync }: { line: LineRec; orgId: string; onBack: () => void; sync: SyncState }) {
  const confirm = useConfirm();
  const projectId = line.projectId;
  const waypoints = (useLiveQuery(() => getDb().waypoints.where("lineId").equals(line.id).toArray(), [line.id]) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  const prev = useLiveQuery(() => getDb().lines.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: codes = [] } = useQuery({ queryKey: ["codes", orgId], queryFn: () => listCodes(orgId) });
  const { data: cats = [] } = useQuery({ queryKey: ["photocats", orgId], queryFn: () => listPhotoCategories(orgId) });
  const { data: works = [] } = useQuery({ queryKey: ["works", projectId], queryFn: () => listWorks(projectId) });
  // "usar el último": la categoría elegida se recuerda en el teléfono; nunca queda una que el desplegable no muestre
  const [wanted, setWanted] = useState<string | null>(readCat);
  const category = pickCategory(cats.map((c) => c.key), wanted);
  const [nuevo, setNuevo] = useState<string | null>(null);

  const uniq = (pick: (l: LineRec) => (string | null)[]) => [...new Set(prev.filter((l) => l.id !== line.id).flatMap(pick).filter((v): v is string => !!v))];
  const save = (patch: Parameters<typeof saveLine>[1]) => void saveLine(line.id, patch);
  const puntos = uniq((l) => [l.startLabel, l.endLabel]); // Inicio y Fin comparten lista: el fin de una ficha suele ser el inicio de otra

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="h-12" onClick={onBack}>← Fichas</Button>
        <h2 className="text-xl font-bold">Ficha N° {line.fichaNo ?? "—"}</h2>
        <Button
          variant={line.closed ? "default" : "outline"}
          className="h-12"
          aria-pressed={line.closed}
          onClick={() => save({ closed: !line.closed })}
        >
          {line.closed && <Check aria-hidden="true" />}
          Ficha cerrada
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Tipo</span>
            <SelectAdd className="h-12" value={line.kind ?? ""} onValue={(v) => save({ kind: v || null })} canAdd fields={["Tipo"]} onAdd={async ([v]) => v}>
              <option value="">—</option>
              {workKinds.map((k) => <option key={k} value={k}>{workKindLabel[k]}</option>)}
              {line.kind && !(workKinds as readonly string[]).includes(line.kind) && <option value={line.kind}>{line.kind}</option>}
            </SelectAdd>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Obra del alcance</span>
            <NativeSelect className="h-12" value={line.workId ?? ""} onChange={(e) => save({ workId: e.target.value || null })}>
              <option value="">—</option>
              {works.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelect>
          </label>
          <div className="grid gap-2">
            <Txt label="Inicio" value={line.startLabel} onSave={(v) => save({ startLabel: v })} />
            <Recientes values={puntos} current={line.startLabel} onPick={(v) => save({ startLabel: v })} />
          </div>
          <div className="grid gap-2">
            <Txt label="Fin" value={line.endLabel} onSave={(v) => save({ endLabel: v })} />
            <Recientes values={puntos} current={line.endLabel} onPick={(v) => save({ endLabel: v })} />
          </div>
          <Txt label="N° de ficha" type="number" inputMode="numeric" value={line.fichaNo} onSave={(v) => save({ fichaNo: v === null ? null : Number(v) })} />
          <div className="grid gap-2">
            <Txt label="N° de trabajo" value={line.jobNo} onSave={(v) => save({ jobNo: v })} />
            <Recientes values={uniq((l) => [l.jobNo])} current={line.jobNo} onPick={(v) => save({ jobNo: v })} />
          </div>
          <Txt label="Fecha" type="date" value={line.surveyDate} onSave={(v) => save({ surveyDate: v })} />
          <div className="grid gap-2">
            <Txt label="Empresa" value={line.company} onSave={(v) => save({ company: v })} />
            <Recientes values={uniq((l) => [l.company])} current={line.company} onPick={(v) => save({ company: v })} />
          </div>
          <div className="grid gap-2">
            <Txt label="Dominantes" value={line.dominant} onSave={(v) => save({ dominant: v })} />
            <Recientes values={uniq((l) => [l.dominant])} current={line.dominant} onPick={(v) => save({ dominant: v })} />
          </div>
          <div className="grid gap-2">
            <Txt label="Cobertura" value={line.cover} onSave={(v) => save({ cover: v })} />
            <Recientes values={uniq((l) => [l.cover])} current={line.cover} onPick={(v) => save({ cover: v })} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Txt label="Acompañantes" value={line.companions} onSave={(v) => save({ companions: v })} />
            <Recientes values={uniq((l) => [l.companions])} current={line.companions} onPick={(v) => save({ companions: v })} />
          </div>
        </CardContent>
      </Card>

      <SyncStrip {...sync} />

      <label className="grid max-w-md gap-1 text-sm">
        <span className="text-muted-foreground">Categoría de las fotos que saques</span>
        <SelectAdd
          className="h-12"
          value={category}
          onValue={(v) => { setWanted(v); writeCat(v); }}
          canAdd={isAdmin}
          onAdd={async ([label]) => {
            const key = await addPhotoCategory(orgId, label, cats.length);
            await qc.invalidateQueries({ queryKey: ["photocats", orgId] });
            return key;
          }}
        >
          {cats.length === 0 && <option value="otro">Otros</option>}
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </SelectAdd>
      </label>

      {waypoints.map((w) => (
        <WaypointCard key={w.id} wp={w} orgId={orgId} codes={codes} category={category} isNew={w.id === nuevo} onDelete={() => void deleteWaypoint(w.id)} />
      ))}
      {/* fijo abajo mientras se recorre la ficha: no hay que bajar hasta el final con guantes */}
      <div className="sticky bottom-3 z-10">
        <Button
          size="lg"
          className="h-14 w-full text-base shadow-lg"
          onClick={() => void addWaypoint(line.id).then((w) => { if (w) setNuevo(w.id); })}
        >
          Agregar waypoint
        </Button>
      </div>

      <Button
        variant="destructive"
        className="mt-6 h-12 justify-self-start"
        onClick={() => {
          void confirm({ title: "¿Eliminar la ficha completa?", details: ["Se eliminan todos sus waypoints y fotos, también los que no se subieron."], confirmLabel: "Eliminar ficha", danger: true }).then((ok) => { if (ok) { void deleteLine(line.id); onBack(); } });
        }}
      >
        Eliminar ficha
      </Button>
    </div>
  );
}

export function Relevamiento({ orgId, projectId }: { orgId: string; projectId: string }) {
  const lines = (useLiveQuery(() => getDb().lines.where("projectId").equals(projectId).toArray(), [projectId]) ?? []).sort((a, b) => (a.fichaNo ?? 0) - (b.fichaNo ?? 0));
  const pending = useLiveQuery(() => getDb().outbox.where("projectId").equals(projectId).count(), [projectId]) ?? 0;
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const online = useOnline();
  const { offline: sinSesion } = useAuth();

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await syncOutbox(supabaseRemote, projectId);
      if (r.error) toast.error(`Sin sincronizar (${r.pending} pendientes): ${r.error}`);
      else if (r.sent > 0) toast.success(`${r.sent} cambios sincronizados`);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [projectId]);

  // Sube solo al abrir con señal y al volver la señal (antes había que tocar "Sincronizar" al volver del campo).
  // Sin sesión vigente se espera a que Supabase la renueve: si no, el envío fallaría por permisos.
  useEffect(() => {
    if (online && !sinSesion) void sync();
  }, [online, sinSesion, sync]);

  const syncState: SyncState = { pending, online, busy, onSync: () => void sync() };
  const open = lines.find((l) => l.id === openId);
  if (open) return <FichaEditor line={open} orgId={orgId} onBack={() => setOpenId(null)} sync={syncState} />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" className="h-14 text-base" onClick={() => void createLine(projectId).then((l) => setOpenId(l.id))}>
          Nueva ficha
        </Button>
      </div>
      <SyncStrip {...syncState} />
      <p className="text-sm text-muted-foreground">
        Todo se guarda en este dispositivo y se sube solo cuando hay conexión. Lo pendiente no se pierde aunque cierres la página.
      </p>
      {lines.length === 0 && <p className="text-sm text-muted-foreground">Sin fichas de relevamiento.</p>}
      {lines.map((l) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <strong>Ficha {l.fichaNo ?? "—"}</strong>{" "}
              <span className="text-sm text-muted-foreground">
                {l.kind ? workKindLabel[l.kind as keyof typeof workKindLabel] ?? l.kind : "sin tipo"} · {l.startLabel ?? "?"} → {l.endLabel ?? "?"} · {l.surveyDate ?? "sin fecha"}
              </span>
              {l.closed && <Badge className="ml-2">Cerrada</Badge>}
            </div>
            <Button variant="outline" className="h-12" onClick={() => setOpenId(l.id)}>Abrir</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
