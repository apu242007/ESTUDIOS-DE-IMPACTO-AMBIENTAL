"""Extrae de un IA real (.docx) lo que alimenta los catálogos: PGA, ambiente, declaraciones y secciones narrativas.

Lee el XML del Word sin cargar las imágenes (estos informes pesan 100+ MB). No interpreta ni reescribe: copia los
textos tal cual; lo que no puede clasificar lo informa en `report`. Sin IA (A.6.11).
"""
from __future__ import annotations

import re
import unicodedata
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def norm(s: str) -> str:
    t = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", t).strip()


@dataclass
class Block:
    kind: str            # h1 | h2 | h3 | h4 | p | table | caption
    text: str = ""
    rows: list[list[str]] = field(default_factory=list)


def _text(el: Any) -> str:
    return "".join(t.text or "" for t in el.iter(W + "t")).strip()


def read_blocks(path: Path) -> list[Block]:
    with zipfile.ZipFile(path) as z:
        styles = etree.fromstring(z.read("word/styles.xml"))
        sname = {s.get(W + "styleId"): (s.find(W + "name").get(W + "val") if s.find(W + "name") is not None else "")
                 for s in styles.iter(W + "style")}
        body = etree.fromstring(z.read("word/document.xml")).find(W + "body")
    out: list[Block] = []
    for el in body:
        if el.tag == W + "p":
            st = el.find(f"{W}pPr/{W}pStyle")
            style = (sname.get(st.get(W + "val"), "") if st is not None else "").lower()
            text = _text(el)
            if not text:
                continue
            m = re.fullmatch(r"heading (\d)", style)
            if m:
                out.append(Block(f"h{m.group(1)}", re.sub(r"^[-–]\s*", "", text)))
            elif style in ("caption", "table of figures") or style.startswith("toc"):
                if style == "caption":
                    out.append(Block("caption", text))
            else:
                out.append(Block("p", text))
        elif el.tag == W + "tbl":
            rows: list[list[str]] = []
            carry: list[str] = []
            for tr in el.findall(W + "tr"):
                cells = []
                for i, tc in enumerate(tr.findall(W + "tc")):
                    vm = tc.find(f"{W}tcPr/{W}vMerge")
                    t = _text(tc)
                    # celda combinada en vertical: hereda el valor de la fila de arriba
                    if vm is not None and vm.get(W + "val") != "restart" and not t and i < len(carry):
                        t = carry[i]
                    cells.append(t)
                carry = cells
                rows.append(cells)
            out.append(Block("table", rows=rows))
    return out


# ----------------------------------------------------------------------------------------------- secciones

def _h1(blocks: list[Block], starts: str) -> tuple[int, int]:
    """Rango [i, j) de bloques del capítulo h1 cuyo título empieza con `starts` (sin tildes)."""
    idx = next((i for i, b in enumerate(blocks) if b.kind == "h1" and norm(b.text).startswith(norm(starts))), None)
    if idx is None:
        return (0, 0)
    end = next((j for j in range(idx + 1, len(blocks)) if blocks[j].kind == "h1"), len(blocks))
    return idx + 1, end


def _by_heading(blocks: list[Block], level: str) -> list[tuple[str, list[str]]]:
    """[(título, [párrafos])] agrupando por encabezado del nivel dado; ignora tablas y epígrafes."""
    out: list[tuple[str, list[str]]] = []
    for b in blocks:
        if b.kind == level:
            out.append((b.text, []))
        elif b.kind == "p" and out:
            out[-1][1].append(b.text)
    return out


# grupo del ambiente por encabezado (clasificación de los 19 apartados del IA; lo que no coincide va a "otro")
AMBIENTE_GRUPO = {
    "geologia": "geologia", "geomorfologia": "geologia", "sismicidad": "geologia", "suelos": "suelos",
    "topografia y drenaje": "hidrologia", "regimen termico": "clima", "precipitaciones": "clima",
    "humedad relativa": "clima", "vientos": "clima", "caracterizacion general": "flora", "flora": "flora",
    "fauna": "fauna", "paisaje": "paisaje", "calidad visual": "paisaje", "patrimonio arqueologico": "patrimonio",
    "patrimonio paleontologico": "patrimonio", "poblacion": "socioeconomico", "actividad economica": "socioeconomico",
    "infraestructura": "socioeconomico",
}


@dataclass
class Extract:
    source: str
    pga_general: list[str]
    pga_particular: list[dict[str, str]]
    environment: list[dict[str, str]]
    declarations: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    report: list[str]


def extract_ia(path: Path) -> Extract:
    blocks = read_blocks(path)
    report: list[str] = []

    # --- PGA: medidas generales (párrafos entre "Medidas generales" y "Medidas particulares") y tabla de particulares
    a, b = _h1(blocks, "PLAN DE GESTION AMBIENTAL")
    pga = blocks[a:b]
    i_gen = next((i for i, x in enumerate(pga) if x.kind in ("p", "h2") and norm(x.text) == "medidas generales"), None)
    i_par = next((i for i, x in enumerate(pga) if x.kind in ("p", "h2") and norm(x.text) == "medidas particulares"), None)
    general: list[str] = []
    if i_gen is not None and i_par is not None:
        general = [x.text for x in pga[i_gen + 2:i_par] if x.kind == "p"]  # +2: salta el párrafo introductorio
    else:
        report.append("PGA: no se encontraron los títulos 'Medidas generales' / 'Medidas particulares'.")
    particular: list[dict[str, str]] = []
    tabla = next((x for x in pga if x.kind == "table" and x.rows and norm(x.rows[0][0]).startswith("etapa")), None)
    if tabla:
        head = [norm(h) for h in tabla.rows[0]]

        def col(*names: str) -> int:
            return next((i for i, h in enumerate(head) if any(n in h for n in names)), -1)

        ix = {"stage": col("etapa"), "action": col("accion"), "measure": col("medida"), "resource": col("recurso"),
              "timing": col("cronograma"), "responsible": col("responsable"), "follow_up": col("metodologia", "seguimiento")}
        for r in tabla.rows[1:]:
            rec = {k: (r[i].strip() if 0 <= i < len(r) else "") for k, i in ix.items()}
            if rec["measure"]:
                particular.append(rec)
        faltan = [k for k, i in ix.items() if i < 0]
        if faltan:
            report.append(f"PGA: columnas no encontradas en la tabla: {', '.join(faltan)}.")
    else:
        report.append("PGA: no se encontró la tabla de medidas particulares.")

    # --- ambiente
    a, b = _h1(blocks, "DESCRIPCION GENERAL DEL AMBIENTE")
    env: list[dict[str, str]] = []
    for level in ("h3", "h2"):
        grupos = _by_heading(blocks[a:b], level)
        if grupos:
            for label, paras in grupos:
                if not paras:
                    continue
                g = AMBIENTE_GRUPO.get(norm(label))
                if g is None:
                    report.append(f"Ambiente: apartado sin grupo conocido → 'otro': {label!r}")
                env.append({"section": g or "otro", "label": label, "body": "\n\n".join(paras)})
            break

    # --- declaraciones por factor
    a, b = _h1(blocks, "DECLARACION DE IMPACTO AMBIENTAL")
    decl = [{"heading": h, "paragraphs": p} for h, p in _by_heading(blocks[a:b], "h3") if p]

    # --- secciones narrativas por capítulo/subcapítulo
    sections: list[dict[str, Any]] = []
    for cap in ("RESUMEN EJECUTIVO", "UBICACION Y DESCRIPCION GENERAL DEL PROYECTO", "IDENTIFICACION DE IMPACTOS",
                "REFERENCIAS"):
        a, b = _h1(blocks, cap)
        chunk = blocks[a:b]
        title = next((x.text for x in blocks[max(a - 1, 0):a] if x.kind == "h1"), cap)
        intro = [x.text for x in chunk[: next((i for i, x in enumerate(chunk) if x.kind in ("h2", "h3")), len(chunk))] if x.kind == "p"]
        if intro:
            sections.append({"path": title, "paragraphs": intro})
        for level in ("h2", "h3"):
            for h, p in _by_heading(chunk, level):
                if p:
                    sections.append({"path": f"{title} / {h}", "paragraphs": p})

    if not particular:
        report.append("PGA: sin medidas particulares.")
    return Extract(path.name, general, particular, env, decl, sections, report)
