"use client";

import { useConfirm } from "@/components/confirm";
import { useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectAdd } from "@/components/select-add";
import { useAuth } from "@/lib/auth/auth-provider";
import { addPhotoCategory, listPhotoCategories } from "@/lib/data/catalogs";
import { deletePhotoRemote, listPhotos, updatePhoto, uploadLoosePhotos, type PhotoRow } from "@/lib/data/photos";
import { errMsg } from "@/lib/data/util";

function Foto({
  p,
  cats,
  onCaption,
  onCategory,
  canAdd,
  onAddCat,
  onDelete,
}: {
  p: PhotoRow;
  cats: { key: string; label: string }[];
  onCaption: (v: string | null) => void;
  onCategory: (k: string) => void;
  canAdd: boolean;
  onAddCat: (label: string) => Promise<string>;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted">
        {p.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.url} alt={p.caption ?? `Foto de ${p.category}`} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted-foreground">Sin imagen</div>
        )}
      </div>
      <CardContent className="grid gap-2 pt-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Epígrafe (opcional)</span>
          <Input
            key={p.caption ?? ""}
            defaultValue={p.caption ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (p.caption ?? "")) onCaption(v === "" ? null : v);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Categoría</span>
          <SelectAdd value={p.category} onValue={onCategory} canAdd={canAdd} onAdd={([label]) => onAddCat(label)}>
            {!cats.some((c) => c.key === p.category) && <option value={p.category}>{p.category}</option>}
            {cats.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </SelectAdd>
        </label>
        {p.heading && <p className="text-sm text-muted-foreground">Vistas: {p.heading}</p>}
        <Button
          variant="outline"
          onClick={() => {
            void confirm({ title: "¿Quitar esta foto del anexo?", confirmLabel: "Quitar", danger: true }).then((ok) => ok && onDelete());
          }}
        >
          Quitar
        </Button>
      </CardContent>
    </Card>
  );
}

/** Fotos sueltas (de gabinete o sin waypoint): varias a la vez, con una categoría. Las del campo van por Relevamiento. */
function SubirFotos({ orgId, projectId, cats, onDone, canAdd, onAddCat }: {
  orgId: string; projectId: string; cats: { key: string; label: string }[]; onDone: () => void;
  canAdd: boolean; onAddCat: (label: string) => Promise<string>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState(cats[0]?.key ?? "otro");
  const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);
  // el catálogo puede llegar después del primer render: siempre una categoría que exista
  const cat = cats.some((c) => c.key === categoria) ? categoria : cats[0]?.key ?? "otro";
  const subir = async (files: File[]) => {
    if (files.length === 0) return;
    setAvance({ hechas: 0, total: files.length });
    try {
      const n = await uploadLoosePhotos(orgId, projectId, files, cat, (hechas) => setAvance({ hechas, total: files.length }));
      toast.success(`${n} ${n === 1 ? "foto subida" : "fotos subidas"}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setAvance(null);
      onDone();
      if (input.current) input.current.value = "";
    }
  };
  return (
    <section aria-labelledby="subir-fotos" className="grid gap-3 border bg-card p-4">
      <h2 id="subir-fotos" className="text-lg font-bold [font-stretch:100%]">Subir fotos</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Para fotos de gabinete o que no van en un waypoint. Se comprimen y se les quita la ubicación oculta del archivo.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Categoría</span>
          <SelectAdd className="h-11 w-64 max-w-full" value={cat} onValue={setCategoria} disabled={!!avance}
            canAdd={canAdd} fields={["Categoría"]} onAdd={([label]) => onAddCat(label)}>
            {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </SelectAdd>
        </label>
        <input ref={input} type="file" accept="image/jpeg,image/png" multiple className="sr-only" id="fotos-sueltas"
          onChange={(e) => void subir([...(e.target.files ?? [])])} />
        <Button size="lg" disabled={!!avance || cats.length === 0} onClick={() => input.current?.click()}>
          <ImagePlus aria-hidden="true" />
          {avance ? `Subiendo ${avance.hechas} de ${avance.total}…` : "Elegir fotos"}
        </Button>
      </div>
    </section>
  );
}

export function Fotos({ orgId, projectId }: { orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const key = ["photos", projectId];
  const { data: photos = [], isLoading } = useQuery({ queryKey: key, queryFn: () => listPhotos(projectId) });
  const { data: cats = [] } = useQuery({ queryKey: ["photocats", orgId], queryFn: () => listPhotoCategories(orgId) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["checklist", projectId] });
  };
  const fail = (e: unknown) => toast.error(errMsg(e));
  const { isAdmin } = useAuth();
  const addCat = async (label: string) => {
    const k = await addPhotoCategory(orgId, label, cats.length);
    await qc.invalidateQueries({ queryKey: ["photocats", orgId] });
    return k;
  };

  const upd = useMutation({
    mutationFn: (a: { id: string; patch: { caption?: string | null; category?: string } }) => updatePhoto(a.id, a.patch),
    onSuccess: refresh,
    onError: fail,
  });
  const del = useMutation({ mutationFn: deletePhotoRemote, onSuccess: refresh, onError: fail });

  // en el orden del catálogo (el del anexo); las categorías desconocidas van al final
  const groups = useMemo(() => {
    const order = new Map(cats.map((c, i) => [c.key, i]));
    const by = new Map<string, PhotoRow[]>();
    for (const p of photos) by.set(p.category, [...(by.get(p.category) ?? []), p]);
    return [...by.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
  }, [photos, cats]);
  const label = (k: string) => cats.find((c) => c.key === k)?.label ?? k;

  if (isLoading) return <p>Cargando…</p>;
  const subir = <SubirFotos orgId={orgId} projectId={projectId} cats={cats} onDone={refresh} canAdd={isAdmin} onAddCat={addCat} />;
  if (photos.length === 0) {
    return (
      <div className="grid gap-6">
        {subir}
        <p className="max-w-prose text-base text-muted-foreground">
          Todavía no hay fotos. Las del campo se cargan desde el celular en Relevamiento y aparecen acá al sincronizar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {subir}
      <p className="tnum text-base text-muted-foreground">
        {photos.length} fotos en {groups.length} categorías.
      </p>
      {groups.map(([cat, list]) => (
        <section key={cat} aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="mb-3 font-heading text-xl font-semibold">
            {label(cat)} <span className="tnum text-base font-normal text-muted-foreground">({list.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Foto
                key={p.id}
                p={p}
                cats={cats}
                onCaption={(v) => upd.mutate({ id: p.id, patch: { caption: v } })}
                onCategory={(k) => upd.mutate({ id: p.id, patch: { category: k } })}
                canAdd={isAdmin}
                onAddCat={addCat}
                onDelete={() => del.mutate(p)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
