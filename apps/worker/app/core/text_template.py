"""Variables de las plantillas de texto. Mismo comportamiento que apps/web/src/lib/text-template.ts (sin IA, A.6.11)."""
from __future__ import annotations

import re
from typing import Any


def fill_vars(text: str, vars: dict[str, Any]) -> str:
    """Reemplaza {variables}. Conserva párrafos. Conocida y vacía → ''; desconocida → queda visible ({x})."""
    def sub(m: re.Match[str]) -> str:
        k = m.group(1)
        if k not in vars:
            return m.group(0)
        v = vars[k]
        return "" if v is None else str(v)

    return re.sub(r"\{(\w+)\}", sub, text)


def project_vars(p: dict[str, Any], client_name: str | None = None) -> dict[str, Any]:
    """Variables que el sistema calcula del proyecto. `pad` cae al nombre completo si falta el nombre corto."""
    short = (p.get("short_name") or "").strip()
    return {
        "pad": short or p["name"],
        "proyecto": p["name"],
        "codigo": p.get("code") or "",
        "yacimiento": p.get("field_area") or "",
        "provincia": p.get("province") or "",
        "cliente": client_name or "",
    }


def unresolved(text: str, vars: dict[str, Any]) -> list[str]:
    seen: list[str] = []
    for m in re.finditer(r"\{(\w+)\}", text):
        if m.group(1) not in vars and m.group(1) not in seen:
            seen.append(m.group(1))
    return seen


def paragraphs(text: str) -> list[str]:
    """Separa un texto largo en párrafos (líneas en blanco). Sin párrafos vacíos."""
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


_XML_INVALIDO = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")


def xml_safe(obj: Any) -> Any:
    """Quita de todos los textos (recursivo) los caracteres que XML no admite. Un texto pegado desde Word con un
    carácter de control haría fallar el armado completo del .docx (python-docx lanza ValueError)."""
    if isinstance(obj, str):
        return _XML_INVALIDO.sub("", obj)
    if isinstance(obj, list):
        return [xml_safe(x) for x in obj]
    if isinstance(obj, dict):
        return {k: xml_safe(v) for k, v in obj.items()}
    return obj
