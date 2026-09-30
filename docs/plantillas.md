# Plantillas de cliente (Word con marcadores)

Cada cliente puede tener su propio formato de informe. Se sube una plantilla `.docx` (Administración → Plantillas) y el
worker la completa con `docxtpl` (sintaxis Jinja2). **Si un proyecto no elige plantilla, se usa el armado base**, que ya
incluye todos los capítulos. Para agregar un cliente nuevo no hace falta tocar código: se sube su `.docx`.

Los textos que salen de catálogos (resumen, ubicación, ambiente, declaraciones, PGA, referencias) llegan **ya resueltos**:
con las variables `{pad}`, `{proyecto}`… reemplazadas y con los ajustes que el profesional hizo en ese proyecto.

## Marcadores

Escalares (`{{ … }}`):

| Marcador | Contenido |
|---|---|
| `{{ titulo }}` | INFORME AMBIENTAL / MEMORIA TÉCNICA DESCRIPTIVA |
| `{{ fecha }}` | "Septiembre de 2026" |
| `{{ proyecto.name }}`, `.code`, `.short_name`, `.field_area`, `.province`, `.doc_type` | datos del proyecto |
| `{{ cliente.name }}`, `.cuit`, `.address` | cliente |
| `{{ solicitante.razon_social }}`, `.cuit`, `.domicilio` | empresa solicitante |
| `{{ consultora.razon_social }}`, `.responsable`, `.matricula` | consultora |
| `{{ borrador }}` | `True` si la versión NO está aprobada (para mostrar "BORRADOR" con `{% if borrador %}…{% endif %}`) |
| `{{ variables.pad }}` | nombre corto (o el nombre completo si falta) |

Listas (con `{%p for x in lista %}` … `{%p endfor %}`, una por párrafo o fila de tabla con `{%tr for … %}`):

| Lista | Campos de cada elemento |
|---|---|
| `obras` | `name`, `kind`, `declared_length_m`, `declared_area_m2`, `geom_length_m`, `geom_area_m2` |
| `pozos` | `nombre`, `lat`, `lon` (DMS), `x` (norte), `y` (este) |
| `interferencias` | `figura`, `lat`, `lon`, `x`, `y`, `cota`, `descripcion` |
| `fotos` | `categoria`, `epigrafe`, `imagen` (usar `{{ f.imagen }}`) |
| `capas`, `gps` | `name`, `kind`, `n` |
| `ambiente` | `seccion`, `titulo`, `texto` |
| `factores` | `codigo`, `nombre`, `medio`, `uip`, `componente`, `negativos`, `positivos`, `peor`, `categoria_peor` |
| `declaraciones` | `titulo`, `medio`, `texto` |
| `secciones.resumen`, `.ubicacion`, `.impactos`, `.referencias` | `titulo` (puede estar vacío), `texto` |
| `pga.generales` | cada elemento es un texto |
| `pga.particulares` | `etapa`, `accion`, `medida`, `recurso`, `cronograma`, `responsable`, `seguimiento` |
| `matriz.acciones` | `codigo`, `nombre`, `etapa` |
| `matriz.filas` | `factor`, `medio`, `valores` (una cadena por acción, en el orden de `matriz.acciones`) |

Ejemplo de tabla de declaraciones en la plantilla:

```
{%p for d in declaraciones %}
{{ d.titulo }}
{{ d.texto }}
{%p endfor %}
```

## Convenciones que respeta el sistema

- Coordenadas planas POSGAR 94 / Argentina faja 2 (EPSG:22182): **X = norte, Y = este**. Latitud/longitud en DMS.
- Las secciones sin datos no inventan contenido: en el armado base salen como "Sección incompleta"; en una plantilla, la lista
  queda vacía y conviene envolverla en `{% if lista %}`.
- Las versiones no aprobadas llevan el encabezado BORRADOR en el armado base; en una plantilla, usá `{{ borrador }}`.
