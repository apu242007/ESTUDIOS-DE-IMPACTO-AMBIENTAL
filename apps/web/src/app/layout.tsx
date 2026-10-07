import type { Metadata, Viewport } from "next";
import { Archivo, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";

// Interfaz: Atkinson Hyperlegible Next (hecha para legibilidad: sol, apuro, guantes).
// Títulos y cifras: Archivo con eje de ancho, expandido como el rotulado de un plano o una carta topográfica.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-ui", subsets: ["latin"], display: "swap" });
const archivo = Archivo({ variable: "--font-rot", subsets: ["latin"], axes: ["wdth"], display: "swap" });

export const metadata: Metadata = {
  title: "EIA — Informes de impacto ambiental",
  description: "Sistema interno para generar informes ambientales",
  icons: { apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png` },
  appleWebApp: { capable: true, title: "EIA" },
};

export const viewport: Viewport = { themeColor: "#1e1a16" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // las variables de fuente van en <html>: `html { font-family }` (globals.css) las necesita en su mismo nivel
    <html lang="es-AR" suppressHydrationWarning className={`${atkinson.variable} ${archivo.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
