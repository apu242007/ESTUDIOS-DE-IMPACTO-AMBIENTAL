"""Coordenadas del informe. Debe coincidir con apps/web/src/lib/geo (mismos resultados, mismo formato)."""
from __future__ import annotations

from pyproj import Transformer

_TO_FAJA2 = Transformer.from_crs(4326, 22182, always_xy=True)  # POSGAR 94 / Argentina faja 2


def to_gauss_kruger(lat: float, lon: float) -> tuple[float, float]:
    """(X, Y) en convención argentina: X = NORTE, Y = ESTE (A.7). Es el orden inverso al de GIS."""
    este, norte = _TO_FAJA2.transform(lon, lat)
    return norte, este


def _part(value: float, pos: str, neg: str) -> str:
    a = abs(value)
    deg = int(a)
    minutes = int((a - deg) * 60)
    sec = round(((a - deg) * 60 - minutes) * 60 * 100) / 100
    if sec >= 60:
        sec, minutes = 0.0, minutes + 1
    if minutes >= 60:
        minutes, deg = 0, deg + 1
    # minutos rellenados con espacio a 2: `38° 7'47.78"S`, `68°34'8.97"O`
    return f"{deg}°{minutes:>2}'{sec:.2f}\"{neg if value < 0 else pos}"


def format_dms(lat: float, lon: float) -> tuple[str, str]:
    """WGS84 en grados-minutos-segundos. Hemisferio Oeste como 'O' (no 'W')."""
    return _part(lat, "N", "S"), _part(lon, "E", "O")
