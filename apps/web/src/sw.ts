/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Solo el "cascarón" de la app (HTML/JS/CSS de Next). Las respuestas de Supabase NO se guardan en la caché
// del navegador: los datos de campo viven en IndexedDB (lib/offline) y las llamadas autenticadas no se cachean.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // /proyecto/?id=<uuid> debe resolver a la página /proyecto/ precacheada
  precacheOptions: { ignoreURLParametersMatching: [/.*/] },
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [],
});
serwist.addEventListeners();
