"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmProvider } from "@/components/confirm";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/auth-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  );
  // Tras un deploy, el service worker nuevo toma el control (skipWaiting + clientsClaim) pero la pestaña
  // sigue con el JS viejo: recargar una vez. Sin controlador previo es la primera instalación, no una versión nueva.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) return;
    const reload = () => window.location.reload();
    sw.addEventListener("controllerchange", reload, { once: true });
    return () => sw.removeEventListener("controllerchange", reload);
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
