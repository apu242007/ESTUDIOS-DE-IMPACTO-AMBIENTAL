"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { workKindLabel, workKinds } from "@/lib/alcance-parser";
import { listCodes, listPhotoCategories } from "@/lib/data/catalogs";
import { errMsg } from "@/lib/data/util";
import { listWorks } from "@/lib/data/works";
import { getDb, type LineRec, type WaypointRec } from "@/lib/offline/db";
import { DIRECTIONS, compressPhoto, joinViews, splitViews } from "@/lib/offline/photos";
import { supabaseRemote } from "@/lib/offline/remote";
import { addPhoto, addWaypoint, createLine, deleteLine, deletePhoto, deleteWaypoint, saveLine, saveWaypoint } from "@/lib/offline/repo";
import { syncOutbox } from "@/lib/offline/sync";

/** Campo de texto que guarda al salir (evita escribir en IndexedDB a cada tecla). */
function Txt({
  value, label, onSave, list, type = "text", className,
}: {
  value: string | number | null; label: string; onSave: (v: string | null) => void;
  list?: string; type?: string; className?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        key={String(value ?? "")}
        className={className ?? "h-12"}
        type={type}
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

function Thumb({ blob, onRemove }: { blob: Blob; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Foto del waypoint" className="h-16 w-16 rounded border object-cover" onClick={onRemove} title="Tocar para quitar" />
  );
}

function WaypointCard({
  wp, orgId, codes, category, onDelete,
}: {
  wp: WaypointRec; orgId: string; codes: { code: string; meaning: string }[]; category: string; onDelete: () => void;
}) {
  const photos = useLiveQuery(() => getDb().photos.where("waypointId").equals(wp.id).toArray(), [wp.id]) ?? [];
  const file = useRef<HTMLInputElement>(null);
  const views = splitViews(wp.views);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Este dispositivo no tiene GPS.");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        void saveWaypoint(wp.id, {
          lat: p.coords.latitude, lon: p.coords.longitude, elevationM: p.coords.altitude, source: "telefono",
        }),
      (e) => toast.error(`No se pudo obtener la posición: ${e.message}`),
      { enableHighAccuracy: true, timeout: 20000 },
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

  return (
    <Card>
      <CardContent className="grid gap-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-[6rem_1fr_2fr]">
          <Txt label="N° waypoint" type="number" value={wp.number} onSave={(v) => void saveWaypoint(wp.id, { number: v === null ? null : Number(v) })} />
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
          <Button variant="outline" className="h-12" onClick={locate}>Tomar posición</Button>
          <Button variant="outline" className="h-12" onClick={() => { if (window.confirm(`¿Quitar el waypoint ${wp.number ?? ""}?`)) onDelete(); }}>Quitar</Button>
          {wp.lat !== null && wp.lon !== null && (
            <Badge variant="secondary">{wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}</Badge>
          )}
        </div>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <Thumb blob={p.blob} onRemove={() => { if (window.confirm("¿Quitar esta foto?")) void deletePhoto(p.id); }} />
                {!p.uploaded && <span className="absolute -right-1 -top-1 size-3 rounded-full bg-amber-500" title="Sin subir" />}
              </div>
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

  const uniq = (pick: (l: LineRec) => string | null) => [...new Set(prev.map(pick).filter((v): v is string => !!v))];
  const save = (patch: Parameters<typeof saveLine>[1]) => void saveLine(line.id, patch);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className="h-12" onClick={onBack}>← Fichas</Button>
        <h2 className="text-xl font-bold">Ficha N° {line.fichaNo ?? "—"}</h2>
        <label className="flex items-center gap-2 text-base">
          <input type="checkbox" className="size-6" checked={line.closed} onChange={(e) => save({ closed: e.target.checked })} />
          Ficha cerrada
        </label>
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
          <Txt label="N° de ficha" type="number" value={line.fichaNo} onSave={(v) => save({ fichaNo: v === null ? null : Number(v) })} />
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
        <WaypointCard key={w.id} wp={w} orgId={orgId} codes={codes} category={category} onDelete={() => void deleteWaypoint(w.id)} />
      ))}
      <Button size="lg" className="h-14 text-base" onClick={() => void addWaypoint(line.id)}>Agregar waypoint</Button>

      <Button
        variant="outline"
        className="h-12 justify-self-start"
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
  const [online, setOnline] = useState(true);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const r = await syncOutbox(supabaseRemote, projectId);
      if (r.error) toast.error(`Sin sincronizar (${r.pending} pendientes): ${r.error}`);
      else if (r.sent > 0) toast.success(`${r.sent} cambios sincronizados`);
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [sync]);

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
        Todo se guarda en este dispositivo y se sube cuando hay conexión. Lo pendiente no se pierde aunque cierres la página.
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
