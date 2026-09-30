"use client";

import type { z } from "zod";
import {
  categoryInputSchema, createImpactCategory, deleteImpactCategory, findOverlappingRanges,
  listImpactCategories, updateImpactCategory,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = categoryInputSchema as z.ZodType<CatalogValues, CatalogValues>;

export function CategoriasCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Categorías de impacto" singular="categoría" queryKey="catalog-impact-categories"
      load={async () => {
        const rows = await listImpactCategories(orgId);
        const overlapping = new Set(findOverlappingRanges(rows).flat());
        return rows.map((row): CatalogItem => ({
          id: row.id,
          title: row.label,
          badge: row.applies_to === "negativo" ? "Negativo" : "Positivo",
          detail: `Rango [${row.min_abs}, ${row.max_abs ?? "sin tope"})${overlapping.has(row.id) ? " · Se superpone con otro rango" : ""}`,
          values: { label: row.label, min_abs: row.min_abs, max_abs: row.max_abs, applies_to: row.applies_to, sort_order: row.sort_order },
        }));
      }}
      create={(values) => createImpactCategory(orgId, categoryInputSchema.parse(values))}
      update={(id, values) => updateImpactCategory(id, categoryInputSchema.parse(values))}
      remove={deleteImpactCategory} schema={schema}
      fields={[
        { name: "label", label: "Etiqueta" },
        { name: "applies_to", label: "Aplica a", kind: "select", options: [{ value: "negativo", label: "Negativo" }, { value: "positivo", label: "Positivo" }] },
        { name: "min_abs", label: "Mínimo incluido", kind: "number" },
        { name: "max_abs", label: "Máximo excluido", kind: "number", help: "Dejalo vacío para un rango sin tope." },
        { name: "sort_order", label: "Orden", kind: "number" },
      ]}
      blank={{ label: "", min_abs: 0, max_abs: null, applies_to: "negativo", sort_order: 0 }}
      groupField="applies_to" groupLabels={{ negativo: "Impactos negativos", positivo: "Impactos positivos" }}
    />
  );
}
