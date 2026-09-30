"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { workKindLabel, type WorkKind } from "@/lib/alcance-parser";
import { listCompare } from "@/lib/data/features";
import { verdict, type Thresholds, type Verdict } from "@/lib/threshold";

const fmt = (n: number | null, d = 1) => (n === null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: d }));
const sign = (n: number | null, d = 1) => (n === null ? "—" : `${n > 0 ? "+" : ""}${fmt(n, d)}`);

const badge: Record<Verdict, { label: string; variant: "default" | "destructive" | "outline" }> = {
  dentro: { label: "Dentro del umbral", variant: "default" },
  fuera: { label: "Fuera del umbral", variant: "destructive" },
  sin_dato: { label: "Sin dato", variant: "outline" },
};

export function Comparacion({ projectId, thresholds }: { projectId: string; thresholds: Thresholds }) {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["works-compare", projectId], queryFn: () => listCompare(projectId) });

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Umbral del proyecto: dentro si la diferencia es ≤ {thresholds.pct} % <strong>o</strong> ≤ {thresholds.abs_m} m
        (basta uno de los dos).
      </p>
      <Card>
        <CardContent className="overflow-x-auto p-2">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                {["Obra", "Tipo", "Declarado", "Calculado", "Diferencia", "%", "Estado"].map((h) => (
                  <th key={h} className="p-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="p-4">Cargando…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin obras en el alcance.</td></tr>
              )}
              {rows.map((r) => {
                const isArea = r.declared_length_m === null && r.declared_area_m2 !== null;
                const declared = isArea ? r.declared_area_m2 : r.declared_length_m;
                const measured = isArea ? r.geom_area_m2 : r.geom_length_m;
                const diff = isArea ? r.diff_area_m2 : r.diff_length_m;
                const pct = isArea ? r.diff_area_pct : r.diff_length_pct;
                const unit = isArea ? "m²" : "m";
                // el umbral absoluto está en metros: para superficies solo aplica el porcentaje
                const v = verdict(declared, measured, isArea ? { pct: thresholds.pct, abs_m: 0 } : thresholds);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2">{workKindLabel[r.kind as WorkKind] ?? r.kind}</td>
                    <td className="p-2">{declared === null ? "—" : `${fmt(declared)} ${unit}`}</td>
                    <td className="p-2">{measured === null ? "sin geometría" : `${fmt(measured)} ${unit}`}</td>
                    <td className="p-2">{diff === null ? "—" : `${sign(diff)} ${unit}`}</td>
                    <td className="p-2">{pct === null ? "—" : `${sign(pct, 2)} %`}</td>
                    <td className="p-2"><Badge variant={badge[v].variant}>{badge[v].label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
