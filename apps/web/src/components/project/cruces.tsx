"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { CROSSING_DISTANCES, crossingDescription, defaultCode, type Crossing, type CrossingDistance } from "@/lib/cruces";
import { listCodes } from "@/lib/data/catalogs";
import { addCrossings, findCrossings } from "@/lib/data/cruces";
import { errMsg } from "@/lib/data/util";

/** Busca elementos de las capas del cliente que cruzan o están cerca de las obras y los agrega como interferencias de gabinete. */
export function Cruces({ orgId, projectId }: { orgId: string; projectId: string }) {
  const qc = useQueryClient();
  const [dist, setDist] = useState<CrossingDistance>(50);
  const [found, setFound] = useState<Crossing[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [codes, setCodes] = useState<Record<string, string>>({});
  const { data: catalog = [] } = useQuery({ queryKey: ["codes", orgId], queryFn: () => listCodes(orgId) });

  const search = useMutation({
    mutationFn: () => findCrossings(projectId, dist),
    onSuccess: (rows) => {
      setFound(rows);
      setChecked(new Set(rows.filter((r) => r.crosses).map((r) => r.featureId)));
      setCodes(Object.fromEntries(rows.map((r) => [r.featureId, defaultCode(r, catalog) ?? ""])));
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const add = useMutation({
    mutationFn: () =>
      addCrossings(projectId, (found ?? []).filter((c) => checked.has(c.featureId)).map((c) => ({ crossing: c, code: codes[c.featureId] || null }))),
    onSuccess: (n) => {
      toast.success(n === 0 ? "Esos cruces ya estaban agregados" : `${n} interferencias agregadas al tramo Gabinete`);
      void qc.invalidateQueries({ queryKey: ["interferencias", projectId] });
      void qc.invalidateQueries({ queryKey: ["checklist", projectId] });
      setFound(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <section aria-labelledby="cruces" className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 id="cruces" className="font-heading text-lg font-semibold">Buscar cruces</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Encuentra ductos, caminos y líneas de las capas del cliente que cruzan las obras o pasan cerca. Elegí cuáles agregar como interferencias.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Distancia máxima</span>
          <NativeSelect className="w-40" value={dist} onChange={(e) => setDist(Number(e.target.value) as CrossingDistance)}>
            {CROSSING_DISTANCES.map((d) => <option key={d} value={d}>{d} m</option>)}
          </NativeSelect>
        </label>
        <Button size="lg" variant="outline" disabled={search.isPending} onClick={() => search.mutate()}>
          {search.isPending ? "Buscando…" : "Buscar cruces"}
        </Button>
      </div>

      {found !== null && found.length === 0 && (
        <p className="text-base text-muted-foreground" role="status">
          No hay elementos a menos de {dist} m. Probá con una distancia mayor, o revisá que las obras tengan geometría y que haya capas importadas.
        </p>
      )}

      {found !== null && found.length > 0 && (
        <>
          <ul className="grid gap-2">
            {found.map((c) => (
              <li key={c.featureId} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_11rem] sm:items-center">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-6 shrink-0 accent-primary"
                    checked={checked.has(c.featureId)}
                    onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(c.featureId); else n.delete(c.featureId); return n; })}
                  />
                  <span className="grid gap-1">
                    <span className="text-base">{crossingDescription(c)}</span>
                    <span>{c.crosses ? <Badge>Cruza la obra</Badge> : <Badge variant="outline">Cercano</Badge>}</span>
                  </span>
                </label>
                <NativeSelect
                  aria-label={`Sigla para ${c.featureName ?? c.layerName}`}
                  value={codes[c.featureId] ?? ""}
                  onChange={(e) => setCodes((s) => ({ ...s, [c.featureId]: e.target.value }))}
                >
                  <option value="">Sin sigla</option>
                  {catalog.map((k) => <option key={k.code} value={k.code}>{k.code} · {k.meaning}</option>)}
                </NativeSelect>
              </li>
            ))}
          </ul>
          <div>
            <Button size="lg" disabled={checked.size === 0 || add.isPending} onClick={() => add.mutate()}>
              Agregar {checked.size} {checked.size === 1 ? "interferencia" : "interferencias"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
