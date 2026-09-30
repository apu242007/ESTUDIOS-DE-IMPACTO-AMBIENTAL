import { defineConfig } from "@playwright/test";

// Pruebas E2E contra un servidor ya levantado (pnpm dev) y la base real de Supabase.
//   EIA_EMAIL=... EIA_PASS=... pnpm e2e
// Usan el Edge instalado (no descargan navegadores). Crean y borran sus propios datos de prueba.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "msedge",
    viewport: { width: 1280, height: 900 },
  },
});
