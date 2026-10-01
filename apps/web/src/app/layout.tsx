import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";

// Cuerpo: Public Sans (legible al sol, sobria). Títulos: Source Serif 4 (el producto entrega un informe).
// Números y coordenadas: IBM Plex Mono.
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"], display: "swap" });
const sourceSerif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "EIA — Informes de impacto ambiental",
  description: "Sistema interno para generar informes ambientales",
  icons: { apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "EIA" },
};

export const viewport: Viewport = { themeColor: "#0f4c5c" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // las variables de fuente van en <html>: `html { font-family }` (globals.css) las necesita en su mismo nivel
    <html lang="es-AR" suppressHydrationWarning className={`${publicSans.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
