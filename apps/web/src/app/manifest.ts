import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EIA — Informes ambientales",
    short_name: "EIA",
    lang: "es-AR",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f2f4f1",
    theme_color: "#0f4c5c",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
