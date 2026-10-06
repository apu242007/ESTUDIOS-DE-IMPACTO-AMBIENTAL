"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Texto que sale de una plantilla del catálogo y el profesional puede ajustar para ESTE proyecto (A.6.11).
 * Solo se guarda lo que difiere de la plantilla: si vuelve a ser igual, se borra el ajuste.
 */
export function TextoEditable({
  id, label, base, override, onSave, rows = 9, disabled,
}: {
  id: string;
  label: string;
  /** Plantilla ya con las variables reemplazadas. */
  base: string;
  /** Ajuste guardado del proyecto (null = usa la plantilla). */
  override: string | null;
  onSave: (text: string | null) => void;
  rows?: number;
  disabled?: boolean;
}) {
  const current = override ?? base;
  const [draft, setDraft] = useState(current);
  const [seen, setSeen] = useState(current);
  if (current !== seen) {
    // el texto cambió desde afuera (otro guardado o variables nuevas): se resincroniza el borrador
    setSeen(current);
    setDraft(current);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
        {override !== null && <Badge variant="secondary">Editado en este proyecto</Badge>}
      </div>
      <Textarea
        id={id}
        rows={rows}
        value={draft}
        disabled={disabled}
        className="text-base leading-relaxed"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const t = draft.trim();
          if (t === current.trim()) return;
          onSave(t === base.trim() || t === "" ? null : t);
        }}
      />
      {override !== null && (
        <div>
          <Button variant="outline" disabled={disabled} onClick={() => onSave(null)}>
            Restablecer al texto original
          </Button>
        </div>
      )}
    </div>
  );
}
