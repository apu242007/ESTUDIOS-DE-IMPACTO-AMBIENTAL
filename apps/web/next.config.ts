import type { NextConfig } from "next";

// GitHub Pages sirve archivos estáticos: exportación estática, sin servidor Next.
// En Pages el sitio vive en /<repo>; NEXT_PUBLIC_BASE_PATH lo fija el workflow (vacío en local).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
