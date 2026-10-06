"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signedLogoUrl, uploadClientLogo } from "@/lib/data/clients";
import { errMsg } from "@/lib/data/util";
import type { ClientRow } from "@/lib/schemas";

function Logo({ path }: { path: string | null }) {
  const { data } = useQuery({
    queryKey: ["logo", path],
    queryFn: () => (path ? signedLogoUrl(path) : Promise.resolve(null)),
    enabled: !!path,
    staleTime: 240_000,
  });
  if (!data) return <div className="size-8 rounded bg-muted" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data} alt="" className="size-8 rounded object-contain" />;
}

/** Elegir la imagen la sube al toque (Clientes y Datos del proyecto), sin abrir el formulario del cliente. */
export function ClientLogoButton({ orgId, client }: { orgId: string; client: ClientRow }) {
  const qc = useQueryClient();
  const up = useMutation({
    mutationFn: (f: File) => uploadClientLogo(orgId, client.id, f, client.logo_path),
    onSuccess: () => {
      toast.success(`Logo de ${client.name} guardado`);
      void qc.invalidateQueries({ queryKey: ["clients", orgId] });
      void qc.invalidateQueries({ queryKey: ["logo"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium ring-1 ring-input has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring">
      <Logo path={client.logo_path} />
      {up.isPending ? "Subiendo…" : client.logo_path ? "Cambiar logo" : "Subir logo"}
      <input
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        aria-label={`Logo de ${client.name}`}
        disabled={up.isPending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) up.mutate(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
