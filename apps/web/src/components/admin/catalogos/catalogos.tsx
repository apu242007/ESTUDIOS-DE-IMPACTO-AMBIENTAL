"use client";

import { useState } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { AccionesCatalogo } from "./acciones";
import { AmbienteCatalogo } from "./ambiente";
import { AtributosCatalogo } from "./atributos";
import { CategoriasCatalogo } from "./categorias";
import { FactoresCatalogo } from "./factores";
import { MedidasCatalogo } from "./medidas";
import { TextosCatalogo } from "./textos";

const sections = [
  ["acciones", "Acciones"], ["factores", "Factores"], ["atributos", "Atributos"],
  ["categorias", "Categorías"], ["medidas", "Medidas del PGA"], ["textos", "Bloques de texto"],
  ["ambiente", "Ambiente"],
] as const;
type Section = (typeof sections)[number][0];

export function Catalogos({ orgId }: { orgId: string }) {
  const { isAdmin } = useAuth();
  const [section, setSection] = useState<Section>("acciones");
  const props = { orgId, canEdit: isAdmin };

  return (
    <div className="grid gap-4">
      {!isAdmin && (
        <p role="note" className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
          Tenés acceso de solo lectura. Solo los administradores de la organización pueden modificar los catálogos.
        </p>
      )}
      <label className="grid max-w-sm gap-1 text-sm font-medium">
        Catálogo
        <NativeSelect value={section} onChange={(event) => setSection(event.target.value as Section)}>
          {sections.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </label>
      {section === "acciones" && <AccionesCatalogo {...props} />}
      {section === "factores" && <FactoresCatalogo {...props} />}
      {section === "atributos" && <AtributosCatalogo {...props} />}
      {section === "categorias" && <CategoriasCatalogo {...props} />}
      {section === "medidas" && <MedidasCatalogo {...props} />}
      {section === "textos" && <TextosCatalogo {...props} />}
      {section === "ambiente" && <AmbienteCatalogo {...props} />}
    </div>
  );
}
