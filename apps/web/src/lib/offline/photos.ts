import imageCompression from "browser-image-compression";

/** Tope para guardar en el teléfono y subir por datos móviles; el informe reduce más en el worker. */
export async function compressPhoto(file: File): Promise<Blob> {
  return imageCompression(file, {
    maxWidthOrHeight: 2048,
    maxSizeMB: 1.5,
    useWebWorker: true,
    fileType: "image/jpeg",
    preserveExif: false, // sin EXIF: no viaja la ubicación oculta del teléfono; la posición sale del waypoint
  });
}

export const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Chips de dirección → "O-NO" (formato de la ficha en papel). El orden es el de selección. */
export const joinViews = (dirs: Direction[]): string | null => (dirs.length ? dirs.join("-") : null);
export const splitViews = (v: string | null): Direction[] =>
  (v ?? "").split("-").filter((d): d is Direction => (DIRECTIONS as readonly string[]).includes(d));
