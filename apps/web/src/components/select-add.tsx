"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { catalogErrorMessage } from "@/lib/data/catalogos";

const ADD = "__agregar__";

/**
 * Desplegable con última opción para cargar un valor a mano: abre un diálogo y, al guardar, `onAdd` crea el valor
 * (en un catálogo, o lo devuelve tal cual si es un dato libre) y devuelve el que hay que elegir. Si `canAdd` es falso
 * (catálogo solo de admins) la opción se ve deshabilitada. `inputType="number"` pide un número.
 */
export function SelectAdd({
  value, onValue, canAdd, onAdd, fields = ["Nombre"], title, addLabel = "+ Agregar nuevo…", inputType = "text", children, ...props
}: Omit<React.ComponentProps<"select">, "value" | "onChange" | "title"> & {
  value: string | number;
  onValue: (v: string) => void;
  canAdd: boolean;
  onAdd: (values: string[]) => Promise<string>;
  fields?: string[];
  title?: string;
  addLabel?: string;
  inputType?: "text" | "number";
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
        {canAdd ? <option value={ADD}>{addLabel}</option> : <option disabled>Solo un administrador puede agregar</option>}
      </NativeSelect>
      <Dialog open={!!vals} onOpenChange={(o) => !o && setVals(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title ?? `Agregar ${fields.join(" y ").toLowerCase()}`}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void save(); }}>
            {vals && fields.map((f, i) => (
              <label key={f} className="grid gap-1 text-sm font-medium">
                {f}
                <Input
                  className="h-12 text-base"
                  type={inputType}
                  inputMode={inputType === "number" ? "decimal" : undefined}
                  step={inputType === "number" ? "any" : undefined}
                  min={inputType === "number" ? 0 : undefined}
                  autoFocus={i === 0}
                  value={vals[i]}
                  onChange={(e) => setVals((s) => s && s.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => setVals(null)}>Cancelar</Button>
              <Button type="submit" className="h-11" disabled={busy || !vals || vals.some((v) => !v.trim())}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
