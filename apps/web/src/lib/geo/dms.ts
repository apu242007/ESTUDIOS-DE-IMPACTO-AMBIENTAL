function part(value: number, pos: string, neg: string): string {
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.floor((abs - deg) * 60);
  let sec = Math.round(((abs - deg) * 60 - min) * 60 * 100) / 100;
  if (sec >= 60) {
    sec = 0;
    min += 1;
  }
  if (min >= 60) {
    min = 0;
    deg += 1;
  }
  // Formato del informe: minutos rellenados con espacio a 2 (`38° 7'`, `68°34'`).
  return `${deg}°${String(min).padStart(2, " ")}'${sec.toFixed(2)}"${value < 0 ? neg : pos}`;
}

/** WGS84 grados-minutos-segundos: `38° 7'47.78"S`, `68°34'8.97"O` (hemisferio O, no W). */
export function formatDms(lat: number, lon: number): { lat: string; lon: string } {
  return { lat: part(lat, "N", "S"), lon: part(lon, "E", "O") };
}

/** Inverso de formatDms para una coordenada. Acepta W como O. Devuelve null si no parsea. */
export function parseDms(text: string): number | null {
  const m = /^\s*(\d+)\s*°\s*(\d+)\s*'\s*(\d+(?:\.\d+)?)\s*"\s*([NSEOW])\s*$/i.exec(text);
  if (!m) return null;
  const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return /[SOW]/i.test(m[4]) ? -v : v;
}
