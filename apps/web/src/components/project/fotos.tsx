"use client";

import { useConfirm } from "@/components/confirm";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectAdd } from "@/components/select-add";
import { useAuth } from "@/lib/auth/auth-provider";
import { addPhotoCategory, listPhotoCategories } from "@/lib/data/catalogs";
import { deletePhotoRemote, listPhotos, updatePhoto, type PhotoRow } from "@/lib/data/photos";
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
          <span className="text-muted-foreground">Epígrafe</span>
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
  if (photos.length === 0) {
    return (
      <p className="max-w-prose text-base text-muted-foreground">
        Todavía no hay fotos. Se cargan desde el celular en Relevamiento y aparecen acá al sincronizar.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
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
