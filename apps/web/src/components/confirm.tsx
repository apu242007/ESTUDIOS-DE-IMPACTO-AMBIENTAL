"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  /** Consecuencias, una por renglón. */
  details?: string[];
  confirmLabel?: string;
  /** Acción que borra o no se puede deshacer: botón rojo. */
  danger?: boolean;
};

const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));

/** Reemplaza a window.confirm: se ve igual que la app, explica la consecuencia y tiene botones grandes. */
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={opts !== null} onOpenChange={(o) => { if (!o) close(false); }}>
        <DialogContent showCloseButton={false} className="gap-4 p-5 sm:max-w-md">
          <DialogTitle className="text-xl font-semibold leading-snug">{opts?.title}</DialogTitle>
          {opts?.details && opts.details.length > 0 && (
            <DialogDescription render={<ul className="grid list-disc gap-1 pl-5 text-base" />}>
              {opts.details.map((d) => <li key={d}>{d}</li>)}
            </DialogDescription>
          )}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" size="lg" onClick={() => close(false)}>Cancelar</Button>
            <Button
              size="lg"
              autoFocus
              className={opts?.danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              onClick={() => close(true)}
            >
              {opts?.confirmLabel ?? "Aceptar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
