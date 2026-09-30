import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// GitHub Pages sirve archivos estáticos: exportación estática, sin servidor Next.
// En Pages el sitio vive en /<repo>; NEXT_PUBLIC_BASE_PATH lo fija el workflow (vacío en local).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

// Service worker para abrir la app sin señal en el campo (se desactiva en `next dev`).
const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
