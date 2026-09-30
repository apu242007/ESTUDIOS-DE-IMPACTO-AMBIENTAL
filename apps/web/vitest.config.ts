import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // e2e/ lo corre Playwright (pnpm e2e), no Vitest
  test: { exclude: ["**/node_modules/**", "e2e/**", ".next/**"] },
});
