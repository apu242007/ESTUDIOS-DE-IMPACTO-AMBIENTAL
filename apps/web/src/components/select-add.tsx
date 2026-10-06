"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { catalogErrorMessage } from "@/lib/data/catalogos";

const ADD = "__agregar__";

/**
 * Desplegable con última opción "+ Agregar nuevo…": abre campos debajo y, al guardar, `onAdd` crea el valor
 * y devuelve el que hay que elegir. Si `canAdd` es falso (catálogo solo de admins) la opción se ve deshabilitada.
 */
export function SelectAdd({
  value, onValue, canAdd, onAdd, fields = ["Nombre"], children, ...props
}: Omit<React.ComponentProps<"select">, "value" | "onChange"> & {
  value: string | number;
  onValue: (v: string) => void;
  canAdd: boolean;
  onAdd: (values: string[]) => Promise<string>;
  fields?: string[];
}) {
  const [vals, setVals] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  // `busy` llega tarde: dos Enter seguidos (o Enter + clic) corren antes del re-render y duplicaban el alta.
  const inFlight = useRef(false);
  const save = async () => {
    if (inFlight.current || !vals || vals.some((v) => !v.trim())) return;
    inFlight.current = true;
    setBusy(true);
    try {
      onValue(await onAdd(vals.map((v) => v.trim())));
      setVals(null);
    } catch (e) {
      toast.error(catalogErrorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <NativeSelect
        {...props}
        value={value}
        onChange={(e) => (e.target.value === ADD ? setVals(fields.map(() => "")) : onValue(e.target.value))}
      >
        {children}
        {canAdd ? <option value={ADD}>+ Agregar nuevo…</option> : <option disabled>Solo un administrador puede agregar</option>}
      </NativeSelect>
      {vals && (
        <span className="flex flex-wrap items-center gap-2">
          {fields.map((f, i) => (
            <Input
              key={f}
              className="h-11 min-w-32 flex-1"
              aria-label={f}
              placeholder={f}
              autoFocus={i === 0}
              value={vals[i]}
              onChange={(e) => setVals((s) => s && s.map((v, j) => (j === i ? e.target.value : v)))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }}
            />
          ))}
          <Button type="button" className="h-11" disabled={busy || vals.some((v) => !v.trim())} onClick={() => void save()}>Guardar</Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => setVals(null)}>Cancelar</Button>
        </span>
      )}
    </>
  );
}
