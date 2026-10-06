"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { workKindLabel, workKinds } from "@/lib/alcance-parser";
import { useAuth } from "@/lib/auth/auth-provider";
import { listCodes, listPhotoCategories } from "@/lib/data/catalogs";
import { errMsg } from "@/lib/data/util";
import { listWorks } from "@/lib/data/works";
import { formatDms } from "@/lib/geo/dms";
import { getDb, type LineRec, type WaypointRec } from "@/lib/offline/db";
import { DIRECTIONS, compressPhoto, joinViews, splitViews } from "@/lib/offline/photos";
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
  return (
    // botón (no <img> con onClick): se alcanza con teclado y el lector anuncia qué hace
    <button
      type="button"
      onClick={onRemove}
      aria-label={uploaded ? "Quitar foto" : "Quitar foto (todavía sin subir)"}
      className="relative size-20 cursor-pointer overflow-hidden rounded-md border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" />
      {!uploaded && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-jarilla px-1 text-xs font-semibold text-basalto">
          sin subir
        </span>
      )}
    </button>
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
  const photos = useLiveQuery(() => getDb().photos.where("waypointId").equals(wp.id).toArray(), [wp.id]) ?? [];
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

  const onPhotos = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        const blob = await compressPhoto(f);
        await addPhoto({ orgId, projectId: wp.projectId, lineId: wp.lineId, waypointId: wp.id, category, caption: null, heading: wp.views, blob });
      } catch (e) {
        toast.error(errMsg(e));
      }
    }
  };

  const dms = wp.lat !== null && wp.lon !== null ? formatDms(wp.lat, wp.lon) : null;

  return (
    <Card ref={card}>
      <CardContent className="grid gap-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-[6rem_1fr_2fr]">
          <Txt label="N° waypoint" type="number" inputMode="numeric" value={wp.number} onSave={(v) => void saveWaypoint(wp.id, { number: v === null ? null : Number(v) })} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Sigla</span>
            <NativeSelect className="h-12" value={wp.code ?? ""} onChange={(e) => void saveWaypoint(wp.id, { code: e.target.value || null })}>
              <option value="">—</option>
              {codes.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.meaning}</option>
              ))}
            </NativeSelect>
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
          <Button className="h-12" onClick={() => file.current?.click()}>Sacar foto</Button>
          <Button variant="outline" className="h-12" disabled={locating} onClick={locate}>
            <LocateFixed aria-hidden="true" />
            {locating ? "Buscando posición…" : dms ? "Volver a tomar posición" : "Tomar posición"}
          </Button>
          <Button variant="outline" className="h-12" onClick={() => { if (window.confirm(`¿Quitar el waypoint ${wp.number ?? ""}?`)) onDelete(); }}>Quitar</Button>
        </div>
        {dms && (
          <p className="tnum font-mono text-sm text-muted-foreground">
            {dms.lat} · {dms.lon}
          </p>
        )}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <Thumb key={p.id} blob={p.blob} uploaded={p.uploaded} onRemove={() => { if (window.confirm("¿Quitar esta foto?")) void deletePhoto(p.id); }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FichaEditor({ line, orgId, onBack }: { line: LineRec; orgId: string; onBack: () => void }) {
  const projectId = line.projectId;
  const waypoints = (useLiveQuery(() => getDb().waypoints.where("lineId").equals(line.id).toArray(), [line.id]) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  const prev = useLiveQuery(() => getDb().lines.where("projectId").equals(projectId).toArray(), [projectId]) ?? [];
  const { data: codes = [] } = useQuery({ queryKey: ["codes", orgId], queryFn: () => listCodes(orgId) });
  const { data: cats = [] } = useQuery({ queryKey: ["photocats", orgId], queryFn: () => listPhotoCategories(orgId) });
  const { data: works = [] } = useQuery({ queryKey: ["works", projectId], queryFn: () => listWorks(projectId) });
  const [category, setCategory] = useState("otro");
  const [nuevo, setNuevo] = useState<string | null>(null);

  const uniq = (pick: (l: LineRec) => string | null) => [...new Set(prev.map(pick).filter((v): v is string => !!v))];
  const save = (patch: Parameters<typeof saveLine>[1]) => void saveLine(line.id, patch);

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
            <NativeSelect className="h-12" value={line.kind ?? ""} onChange={(e) => save({ kind: e.target.value || null })}>
              <option value="">—</option>
              {workKinds.map((k) => <option key={k} value={k}>{workKindLabel[k]}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Obra del alcance</span>
            <NativeSelect className="h-12" value={line.workId ?? ""} onChange={(e) => save({ workId: e.target.value || null })}>
              <option value="">—</option>
              {works.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelect>
          </label>
          <Txt label="Inicio" value={line.startLabel} onSave={(v) => save({ startLabel: v })} />
          <Txt label="Fin" value={line.endLabel} onSave={(v) => save({ endLabel: v })} />
          <Txt label="N° de ficha" type="number" inputMode="numeric" value={line.fichaNo} onSave={(v) => save({ fichaNo: v === null ? null : Number(v) })} />
          <Txt label="N° de trabajo" value={line.jobNo} list="dl-job" onSave={(v) => save({ jobNo: v })} />
          <Txt label="Fecha" type="date" value={line.surveyDate} onSave={(v) => save({ surveyDate: v })} />
          <Txt label="Empresa" value={line.company} list="dl-company" onSave={(v) => save({ company: v })} />
          <Txt label="Dominantes" value={line.dominant} list="dl-dominant" onSave={(v) => save({ dominant: v })} />
          <Txt label="Cobertura" value={line.cover} list="dl-cover" onSave={(v) => save({ cover: v })} />
          <div className="sm:col-span-2">
            <Txt label="Acompañantes" value={line.companions} list="dl-comp" onSave={(v) => save({ companions: v })} />
          </div>
          <datalist id="dl-job">{uniq((l) => l.jobNo).map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-company">{uniq((l) => l.company).map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-dominant">{uniq((l) => l.dominant).map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-cover">{uniq((l) => l.cover).map((v) => <option key={v} value={v} />)}</datalist>
          <datalist id="dl-comp">{uniq((l) => l.companions).map((v) => <option key={v} value={v} />)}</datalist>
        </CardContent>
      </Card>

      <label className="grid max-w-md gap-1 text-sm">
        <span className="text-muted-foreground">Categoría de las fotos que saques</span>
        <NativeSelect className="h-12" value={category} onChange={(e) => setCategory(e.target.value)}>
          {cats.length === 0 && <option value="otro">Otros</option>}
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </NativeSelect>
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
          if (window.confirm("¿Eliminar la ficha completa con sus waypoints y fotos?")) { void deleteLine(line.id); onBack(); }
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

  const open = lines.find((l) => l.id === openId);
  if (open) return <FichaEditor line={open} orgId={orgId} onBack={() => setOpenId(null)} />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" className="h-14 text-base" onClick={() => void createLine(projectId).then((l) => setOpenId(l.id))}>
          Nueva ficha
        </Button>
        <Button size="lg" variant="outline" className="h-14 text-base" disabled={busy || !online || pending === 0} onClick={() => void sync()}>
          {busy ? "Sincronizando…" : `Sincronizar (${pending})`}
        </Button>
        <Badge variant={online ? "secondary" : "destructive"}>{online ? "Con conexión" : "Sin conexión"}</Badge>
      </div>
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
