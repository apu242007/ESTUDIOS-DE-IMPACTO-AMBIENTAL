// POSGAR 94 / Argentina faja 2 (EPSG:22182), Transverse Mercator (series de Krüger, 4to orden).
// Elipsoide WGS84 (POSGAR94 difiere < 1 mm). Convención argentina: X = NORTE, Y = ESTE.
const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 1;
const E0 = 2500000;
// EPSG:22182: latitud de origen -90 (polo sur), falso norte 0. Equivale a medir el norte desde el polo:
// N0 = k0 * RAD * pi/2 = 10.001.965,729 m (cuarto de meridiano), NO 10.000.000.
const LON0 = (-69 * Math.PI) / 180;

const n = F / (2 - F);
const n2 = n * n;
const n3 = n2 * n;
const n4 = n3 * n;
const RAD = (A / (1 + n)) * (1 + n2 / 4 + n4 / 64);
const N0_POLE = K0 * RAD * (Math.PI / 2);
const alpha = [
  n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180,
  (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440,
  (61 * n3) / 240 - (103 * n4) / 140,
  (49561 * n4) / 161280,
];
const beta = [
  n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360,
  n2 / 48 + n3 / 15 - (437 * n4) / 1440,
  (17 * n3) / 480 - (37 * n4) / 840,
  (4397 * n4) / 161280,
];
const delta = [
  2 * n - (2 * n2) / 3 - 2 * n3 + (116 * n4) / 45,
  (7 * n2) / 3 - (8 * n3) / 5 - (227 * n4) / 45,
  (56 * n3) / 15 - (136 * n4) / 35,
  (4279 * n4) / 630,
];

/** WGS84 lat/lon (grados) -> { x: norte, y: este } en EPSG:22182, metros. */
export function toPosgarFaja2(lat: number, lon: number): { x: number; y: number } {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180 - LON0;
  const c = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.asinh(Math.tan(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xi0 = Math.atan2(t, Math.cos(lam));
  const eta0 = Math.asinh(Math.sin(lam) / Math.hypot(t, Math.cos(lam)));
  let xi = xi0;
  let eta = eta0;
  alpha.forEach((a, i) => {
    const j = 2 * (i + 1);
    xi += a * Math.sin(j * xi0) * Math.cosh(j * eta0);
    eta += a * Math.cos(j * xi0) * Math.sinh(j * eta0);
  });
  return { x: N0_POLE + K0 * RAD * xi, y: E0 + K0 * RAD * eta };
}

/** Inversa: { x: norte, y: este } EPSG:22182 -> WGS84 { lat, lon } en grados. */
export function fromPosgarFaja2(x: number, y: number): { lat: number; lon: number } {
  const xi = (x - N0_POLE) / (K0 * RAD);
  const eta = (y - E0) / (K0 * RAD);
  let xi0 = xi;
  let eta0 = eta;
  beta.forEach((b, i) => {
    const j = 2 * (i + 1);
    xi0 -= b * Math.sin(j * xi) * Math.cosh(j * eta);
    eta0 -= b * Math.cos(j * xi) * Math.sinh(j * eta);
  });
  const chi = Math.asin(Math.sin(xi0) / Math.cosh(eta0));
  let phi = chi;
  delta.forEach((d, i) => {
    phi += d * Math.sin(2 * (i + 1) * chi);
  });
  const lam = LON0 + Math.atan2(Math.sinh(eta0), Math.cos(xi0));
  return { lat: (phi * 180) / Math.PI, lon: (lam * 180) / Math.PI };
}
