import zipfile
from pathlib import Path

from app.core.ia_extract import read_blocks

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
STYLES = f'<w:styles {W}><w:style w:styleId="H2"><w:name w:val="heading 2"/></w:style></w:styles>'


def _docx(tmp: Path, body: str) -> Path:
    p = tmp / "x.docx"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("word/styles.xml", STYLES)
        z.writestr("word/document.xml", f"<w:document {W} {MC}><w:body>{body}</w:body></w:document>")
    return p


def test_texto_de_cuadros_de_texto_en_figuras_no_entra_al_parrafo(tmp_path: Path) -> None:
    caja = "<w:txbxContent><w:p><w:r><w:t>Zona de estudio</w:t></w:r></w:p></w:txbxContent>"
    fig = f"<mc:AlternateContent><mc:Choice>{caja}</mc:Choice><mc:Fallback>{caja}</mc:Fallback></mc:AlternateContent>"
    body = f"<w:p><w:r><w:t>Texto real.</w:t></w:r><w:r>{fig}</w:r></w:p><w:p><w:r>{fig}</w:r></w:p>"
    blocks = read_blocks(_docx(tmp_path, body))
    assert [(b.kind, b.text) for b in blocks] == [("p", "Texto real.")]
