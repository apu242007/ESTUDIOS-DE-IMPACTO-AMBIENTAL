"use client";

import type { z } from "zod";
import {
  createCatalogTextBlock, deleteCatalogTextBlock, listCatalogTextBlocks, templateVariables,
  textBlockInputSchema, unknownTemplateVariables, updateCatalogTextBlock,
} from "@/lib/data/catalogos";
import { CrudCatalog, type CatalogItem, type CatalogValues } from "./shared";

const schema = textBlockInputSchema as z.ZodType<CatalogValues, CatalogValues>;
const SCOPE_LABEL: Record<string, string> = {
  interferencia: "Interferencia", declaracion: "Declaración", resumen: "Resumen", obra: "Obra", seccion: "Sección", otro: "Otro",
};
const scopes = ["interferencia", "declaracion", "resumen", "obra", "seccion", "otro"].map((value) => ({ value, label: SCOPE_LABEL[value] ?? value }));
const normalize = (values: CatalogValues) => textBlockInputSchema.parse({ ...values, title: values.title || null });

export function TextosCatalogo({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <CrudCatalog
      orgId={orgId} canEdit={canEdit} title="Bloques de texto" singular="bloque" queryKey="catalog-text-blocks" search
      filter={{ field: "scope", label: "Filtrar por alcance", allLabel: "Todos los alcances" }}
      load={async () => (await listCatalogTextBlocks(orgId)).map((row): CatalogItem => ({
        id: row.id, title: row.title || row.key, badge: row.scope, detail: `${row.key} · ${row.template}`,
        values: { key: row.key, scope: row.scope, title: row.title, template: row.template, sort_order: row.sort_order },
      }))}
      create={(values) => createCatalogTextBlock(orgId, normalize(values))}
      update={(id, values) => updateCatalogTextBlock(id, normalize(values))}
      remove={deleteCatalogTextBlock} schema={schema}
      fields={[
        { name: "key", label: "Clave" }, { name: "scope", label: "Alcance", kind: "select", options: scopes },
        { name: "title", label: "Título" }, { name: "sort_order", label: "Orden", kind: "number" },
        { name: "template", label: "Plantilla", kind: "textarea", wide: true, help: `Variables disponibles: ${templateVariables.map((name) => `{${name}}`).join(" ")}` },
      ]}
      blank={{ key: "", scope: "otro", title: null, template: "", sort_order: 0 }}
      warning={(values) => {
        const unknown = unknownTemplateVariables(String(values.template ?? ""));
        return unknown.length > 0 ? `Variables desconocidas: ${unknown.map((name) => `{${name}}`).join(", ")}. Podés guardar, pero no se reemplazarán.` : null;
      }}
    />
  );
}
