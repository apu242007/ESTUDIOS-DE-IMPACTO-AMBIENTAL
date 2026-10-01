import { z } from "zod";

export const thresholdsSchema = z.object({ pct: z.number().nonnegative(), abs_m: z.number().nonnegative() });
export type Thresholds = z.infer<typeof thresholdsSchema>;
export const DEFAULT_THRESHOLDS: Thresholds = { pct: 1, abs_m: 5 };

export type Verdict = "dentro" | "fuera" | "sin_dato";

/**
 * A.7: una obra está dentro del umbral si cumple `pct` O `abs_m` (basta uno).
 * `abs_m` se aplica tal cual a longitudes (m); para superficies el llamador pasa el umbral que corresponda.
 */
export function verdict(declared: number | null, measured: number | null, t: Thresholds): Verdict {
  if (declared === null || measured === null || declared <= 0) return "sin_dato";
  const abs = Math.abs(measured - declared);
  const pct = (abs / declared) * 100;
  return pct <= t.pct || abs <= t.abs_m ? "dentro" : "fuera";
}

/** false si el umbral guardado no tiene el formato esperado: parseThresholds usaría el valor por defecto sin avisar. */
export const thresholdsValid = (raw: unknown): boolean => thresholdsSchema.safeParse(raw).success;

export function parseThresholds(raw: unknown): Thresholds {
  const r = thresholdsSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_THRESHOLDS;
}
