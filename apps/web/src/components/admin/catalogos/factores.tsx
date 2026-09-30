"use client";

import type { z } from "zod";
import {
  createImpactFactor, deleteImpactFactor, impactFactorInputSchema, listImpactFactors, sumUip, updateImpactFactor,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = impactFactorInputSchema as z.ZodType<CatalogValues, CatalogValues>;
const medios = [
  { value: "fisico", label: "Físico" }, { value: "biotico", label: "Biótico" },
  { value: "perceptual", label: "Perceptual" }, { value: "socioeconomico", label: "Socioeconómico" },
  { value: "cultural", label: "Cultural" },
];

export function FactoresCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Factores de impacto" singular="factor" queryKey="catalog-impact-factors"
      load={async () => {
        const rows = await listImpactFactors(orgId);
        return rows.map((row): CatalogItem => ({
          id: row.id, title: `${row.code} — ${row.name}`, badge: `UIP ${row.uip ?? "—"}`,
          detail: [row.medio, row.component].filter(Boolean).join(" · "),
          values: { code: row.code, name: row.name, medio: row.medio, uip: row.uip, component: row.component, sort_order: row.sort_order },
        }));
      }}
      create={(values) => createImpactFactor(orgId, impactFactorInputSchema.parse(values))}
      update={(id, values) => updateImpactFactor(id, impactFactorInputSchema.parse(values))}
      remove={deleteImpactFactor} schema={schema}
      fields={[
        { name: "code", label: "Código" }, { name: "name", label: "Nombre" },
        { name: "medio", label: "Medio", kind: "select", options: medios },
        { name: "uip", label: "UIP", kind: "number" }, { name: "component", label: "Componente" },
        { name: "sort_order", label: "Orden", kind: "number" },
      ]}
      blank={{ code: "", name: "", medio: "fisico", uip: null, component: null, sort_order: 0 }}
      headerExtra={(items) => {
        const total = sumUip(items.map((item) => ({ uip: typeof item.values.uip === "number" ? item.values.uip : null })));
        return <p className={total === 1000 ? "text-sm text-ok" : "text-sm text-warn"}>Suma UIP: <strong>{total}</strong> de 1000{total !== 1000 ? " — revisá la ponderación." : ""}</p>;
      }}
    />
  );
}
