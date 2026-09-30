"use client";

import type { z } from "zod";
import {
  catalogStageLabels, catalogStages, createImpactAction, deleteImpactAction, impactActionInputSchema,
  listImpactActions, updateImpactAction,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = impactActionInputSchema as z.ZodType<CatalogValues, CatalogValues>;
const stageOptions = [{ value: "", label: "Sin etapa" }, ...catalogStages.map((value) => ({ value, label: catalogStageLabels[value] }))];

export function AccionesCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Acciones de impacto" singular="acción" queryKey="catalog-impact-actions"
      load={async () => (await listImpactActions(orgId)).map((row): CatalogItem => ({
        id: row.id, title: `${row.code} — ${row.name}`, badge: row.stage ? catalogStageLabels[row.stage] : "Sin etapa",
        values: { code: row.code, name: row.name, stage: row.stage ?? "", sort_order: row.sort_order },
      }))}
      create={(values) => createImpactAction(orgId, impactActionInputSchema.parse({ ...values, stage: values.stage || null }))}
      update={(id, values) => updateImpactAction(id, impactActionInputSchema.parse({ ...values, stage: values.stage || null }))}
      remove={deleteImpactAction} schema={schema}
      fields={[
        { name: "code", label: "Código" }, { name: "name", label: "Nombre" },
        { name: "stage", label: "Etapa", kind: "select", options: stageOptions },
        { name: "sort_order", label: "Orden", kind: "number" },
      ]}
      blank={{ code: "", name: "", stage: "", sort_order: 0 }}
    />
  );
}
