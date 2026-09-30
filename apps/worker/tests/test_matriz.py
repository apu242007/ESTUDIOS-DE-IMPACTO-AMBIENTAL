from pathlib import Path

import pytest

from app.core.matriz import ATTRS, attr_options, importance, norm, parse_matriz
from app.core.matriz_sql import project_impacts_sql, seed_sql, verify_sql

XLSX = Path(__file__).resolve().parents[3] / "fixtures" / "excel" / "2947-26_Matriz_YB.xlsx"
needs_excel = pytest.mark.skipif(not XLSX.exists(), reason="falta fixtures/excel/2947-26_Matriz_YB.xlsx")

ORG = "00000000-0000-0000-0000-00000000000a"


# --- fórmula y utilidades (no necesitan el Excel)
def test_importancia_celda_real_del_excel() -> None:
    # Calidad del aire × Traslado de equipos y materiales: signo −1, IN1 EX2 MO4 PE1 RV1 SI1 AC1 EF4 PR1 MC1 → −21
    a = {"IN": 1, "EX": 2, "MO": 4, "PE": 1, "RV": 1, "SI": 1, "AC": 1, "EF": 4, "PR": 1, "MC": 1}
    assert importance(-1, a) == -21
    assert importance(1, a) == 21
    # Suelo × Construcción de locaciones y caminos: −40
    assert importance(-1, {"IN": 4, "EX": 2, "MO": 4, "PE": 4, "RV": 4, "SI": 1, "AC": 1, "EF": 4, "PR": 4, "MC": 2}) == -40


def test_norm_ignora_tildes_y_signos() -> None:
    assert norm("PERFORACIÓN Y TERMINACIÓN") == "PERFORACION Y TERMINACION"
    assert norm("MEDIO SOCIOCUL-TURAL") == "MEDIO SOCIOCUL TURAL"


# --- contra el Excel real
@needs_excel
def test_estructura_de_la_matriz_real() -> None:
    m = parse_matriz(XLSX)
    assert len(m.factors) == 13 and len(m.actions) == 20
    assert sum(len(f.cells) for f in m.factors) == 132
    assert sum(f.uip or 0 for f in m.factors) == 1000
    assert {s for s, _ in m.actions} == {"construccion", "perforacion", "complementarias", "operacion", "abandono"}
    assert {f.medio for f in m.factors} == {"fisico", "biotico", "perceptual", "cultural", "socioeconomico"}


@needs_excel
def test_la_formula_reproduce_la_importancia_de_las_132_celdas() -> None:
    m = parse_matriz(XLSX)
    malas = [(f.name, c.action, importance(c.sign, c.attrs), c.excel_i)
             for f in m.factors for c in f.cells if importance(c.sign, c.attrs) != c.excel_i]
    assert malas == []


@needs_excel
def test_no_toma_hojas_resumen_ni_ocultas_como_factores() -> None:
    m = parse_matriz(XLSX)
    nombres = {f.name for f in m.factors}
    assert "INERTE" not in nombres and "Nivel de ocupación" not in nombres
    assert any("Hoja oculta omitida" in r for r in m.report)


@needs_excel
def test_opciones_cubren_todos_los_valores_usados() -> None:
    m = parse_matriz(XLSX)
    op = attr_options(m)
    assert set(op) == set(ATTRS)
    for f in m.factors:
        for c in f.cells:
            for a in ATTRS:
                assert c.attrs[a] in op[a], (f.name, c.action, a)
    assert op["IN"] == [1, 2, 4, 8, 12] and op["AC"] == [1, 4]


@needs_excel
def test_el_reporte_admite_lo_que_no_esta_en_el_excel() -> None:
    m = parse_matriz(XLSX)
    txt = "\n".join(m.report)
    assert "sin nombres" in txt          # las etiquetas de las opciones no vienen en el Excel
    assert "25, 50 o 75" in txt          # el límite entre categorías es ambiguo


@needs_excel
def test_sql_de_carga_es_idempotente_y_comilla_segura() -> None:
    sql = seed_sql(parse_matriz(XLSX), ORG)
    assert sql.count("on conflict") == 4
    assert "'Crítico'" in sql and "'Positivo'" in sql
    assert "'Características físico-químicas del suelo'" in sql
    assert "drop " not in sql.lower() and "delete " not in sql.lower()  # solo agrega/actualiza


@needs_excel
def test_sql_de_verificacion_no_deja_datos() -> None:
    sql = verify_sql(parse_matriz(XLSX))
    assert "MATRIZ_RESULT" in sql and sql.count("::jsonb") == 132


@needs_excel
def test_sql_de_matriz_de_proyecto_carga_las_132_celdas_y_es_idempotente() -> None:
    sql = project_impacts_sql(parse_matriz(XLSX), "00000000-0000-0000-0000-00000000000b")
    assert sql.count("::jsonb") == 132
    assert "on conflict (project_id, action_id, factor_id) do update" in sql
    assert "join public.projects p on p.id = '00000000-0000-0000-0000-00000000000b'" in sql
    assert "drop " not in sql.lower() and "delete " not in sql.lower()
