"use client";

import type { z } from "zod";
import {
  createImpactAttr, deleteImpactAttr, impactAttrInputSchema, impactAttrLabels, impactAttrs,
  listImpactAttrs, updateImpactAttr,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = impactAttrInputSchema as z.ZodType<CatalogValues, CatalogValues>;
const attrOptions = impactAttrs.map((value) => ({ value, label: `${value} — ${impactAttrLabels[value]}` }));

export function AtributosCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Opciones de atributos" singular="opcion" queryKey="catalog-impact-attrs"
      load={async () => (await listImpactAttrs(orgId)).map((row): CatalogItem => ({
        id: row.id, title: row.label, badge: String(row.value), values: { attr: row.attr, label: row.label, value: row.value, sort_order: row.sort_order },
      }))}
      create={(values) => createImpactAttr(orgId, impactAttrInputSchema.parse(values))}
      update={(id, values) => updateImpactAttr(id, impactAttrInputSchema.parse(values))}
      remove={deleteImpactAttr} schema={schema}
      fields={[
        { name: "attr", label: "Atributo", kind: "select", options: attrOptions },
        { name: "label", label: "Etiqueta", placeholder: "Baja, Media, Alta..." },
        { name: "value", label: "Valor numérico", kind: "number" },
        { name: "sort_order", label: "Orden", kind: "number" },
      ]}
      blank={{ attr: "IN", label: "", value: 1, sort_order: 0 }}
      groupField="attr" groupLabels={impactAttrLabels}
    />
  );
}
