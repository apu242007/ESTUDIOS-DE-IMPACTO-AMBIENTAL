"use client";

import type { z } from "zod";
import {
  catalogStageLabels, catalogStages, createCatalogMeasure, deleteCatalogMeasure, listCatalogMeasures,
  measureInputSchema, updateCatalogMeasure,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = measureInputSchema as z.ZodType<CatalogValues, CatalogValues>;
const stageOptions = [{ value: "", label: "Sin etapa" }, ...catalogStages.map((value) => ({ value, label: catalogStageLabels[value] }))];
const normalize = (values: CatalogValues) => measureInputSchema.parse({
  ...values,
  stage: values.stage || null,
  action: values.action || null,
  resource: values.resource || null,
  timing: values.timing || null,
  responsible: values.responsible || null,
  follow_up: values.follow_up || null,
});

export function MedidasCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Medidas del PGA" singular="medida" queryKey="catalog-measures" search
      filter={{ field: "stage", label: "Filtrar por etapa", allLabel: "Todas las etapas", labels: catalogStageLabels }}
      load={async () => (await listCatalogMeasures(orgId)).map((row): CatalogItem => ({
        id: row.id,
        title: row.name,
        badge: row.general ? "General" : (row.stage ? catalogStageLabels[row.stage] : "Sin etapa"),
        detail: [row.program, row.action, row.body].filter(Boolean).join(" · "),
        values: {
          program: row.program, name: row.name, body: row.body, stage: row.stage ?? "", action: row.action,
          resource: row.resource, timing: row.timing, responsible: row.responsible, follow_up: row.follow_up,
          general: row.general, sort_order: row.sort_order,
        },
      }))}
      create={(values) => createCatalogMeasure(orgId, normalize(values))}
      update={(id, values) => updateCatalogMeasure(id, normalize(values))}
      remove={deleteCatalogMeasure} schema={schema}
      fields={[
        { name: "program", label: "Programa" }, { name: "name", label: "Nombre" },
        { name: "stage", label: "Etapa", kind: "select", options: stageOptions }, { name: "general", label: "Medida general", kind: "checkbox" },
        { name: "action", label: "Acción" }, { name: "resource", label: "Recurso afectado" },
        { name: "body", label: "Medida", kind: "textarea", wide: true },
        { name: "timing", label: "Cronograma" }, { name: "responsible", label: "Responsable" },
        { name: "follow_up", label: "Seguimiento", kind: "textarea", wide: true },
        { name: "sort_order", label: "Orden", kind: "number" },
      ]}
      blank={{ program: "", name: "", body: "", stage: "", action: null, resource: null, timing: null, responsible: null, follow_up: null, general: false, sort_order: 0 }}
    />
  );
}
