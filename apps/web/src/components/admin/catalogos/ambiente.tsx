"use client";

import type { z } from "zod";
import {
  createCatalogEnvironment, deleteCatalogEnvironment, environmentInputSchema, listCatalogEnvironment,
  updateCatalogEnvironment,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = environmentInputSchema as z.ZodType<CatalogValues, CatalogValues>;

export function AmbienteCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Descripción del ambiente" singular="descripción" queryKey="catalog-environment"
      filter={{ field: "zone_key", label: "Filtrar por zona", allLabel: "Todas las zonas" }} search
      load={async () => (await listCatalogEnvironment(orgId)).map((row): CatalogItem => ({
        id: row.id, title: row.label, badge: row.zone_key, detail: `${row.section} · ${row.body}`,
        values: { zone_key: row.zone_key, section: row.section, label: row.label, body: row.body, sort_order: row.sort_order },
      }))}
      create={(values) => createCatalogEnvironment(orgId, environmentInputSchema.parse(values))}
      update={(id, values) => updateCatalogEnvironment(id, environmentInputSchema.parse(values))}
      remove={deleteCatalogEnvironment} schema={schema}
      fields={[
        { name: "zone_key", label: "Zona" }, { name: "section", label: "Sección" },
        { name: "label", label: "Etiqueta" }, { name: "sort_order", label: "Orden", kind: "number" },
        { name: "body", label: "Descripción", kind: "textarea", wide: true },
      ]}
      blank={{ zone_key: "", section: "", label: "", body: "", sort_order: 0 }}
    />
  );
}
