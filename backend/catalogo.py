"""Catalogo de entidades de la demo: sucursales, puestos, establecimientos.

Este archivo es la frontera del enmascarado. En la version interna del
tablero estos nombres son los reales (las ciudades donde opera la
empresa, los establecimientos de nomina, los puestos tal como los
escribe el sistema de RH); aqui son inventados. Todo lo demas del
proyecto -- consultas, homologacion, reglas de decision -- es identico,
porque nunca mira un nombre especifico: solo pasa por estas tablas.

Las *formas* si se conservaron a proposito, porque son lo que el codigo
de homologacion tiene que resolver y seria deshonesto esconderlo:

  * la solicitud en linea guarda la sucursal CON acentos ("Bahia Verde"
    se escribe "Bahía Verde"); el diccionario de campanas de Meta la
    guarda SIN acentos y en mayusculas ("BAHIA VERDE").
  * nomina usa un tercer texto para la misma sucursal ("MATRIZ
    ALTAMIRA" para la tienda de la ciudad, "ALMACEN ALTAMIRA" para su
    almacen regional, "CD. FUENTES" con abreviatura).
  * el mismo puesto llega escrito de hasta cuatro maneras: con acento,
    sin acento, abreviado, en otro idioma, o en blanco.

Esas tres fuentes se reconcilian al nombre canonico: la columna de en
medio de SUCURSALES y el valor de PUESTOS.
"""

# (como lo escribe la solicitud en linea, canonico del tablero, codigo del almacen)
SUCURSALES = [
    ("Altamira",        "Altamira",        "ALT"),
    ("Bahía Verde",     "Bahia Verde",     "BHV"),
    ("Cerro Azul",      "Cerro Azul",      "CRZ"),
    ("Dos Ríos",        "Dos Rios",        "DRI"),
    ("El Paraje",       "El Paraje",       "PRJ"),
    ("Fuentes",         "Fuentes",         "FTS"),
    ("Granados",        "Granados",        "GRA"),
    ("Huerta Nueva",    "Huerta Nueva",    "HTN"),
    ("Islote",          "Islote",          "ISL"),
    ("Jara del Valle",  "Jara del Valle",  "JDV"),
    ("Lomas Claras",    "Lomas Claras",    "LMC"),
    ("Mirasol",         "Mirasol",         "MRS"),
]

# Solo tres sucursales tienen almacen regional propio; son las unicas que
# pueden traer campana de montacarguista.
ALMACENES = ["ALT", "GRA", "MRS"]

# El nombre canonico de un almacen se arma asi en los tres lados (SQL,
# Python y el diccionario de campanas). Sin acento, igual que el resto de
# los nombres canonicos: el diccionario de campanas no los lleva, y la
# comparacion insensible a mayusculas de SQLite solo pliega ASCII.
def almacen(codigo: str) -> str:
    """'ALT' -> 'Almacen ALT'."""
    return f"Almacen {codigo}"


# codigo corto (dim_campana_facebook.puesto) -> texto canonico, el que se
# muestra y el que usan las consultas. Los tres oficios que cubre el
# tablero.
PUESTOS = {
    "SOLDADOR":      "Soldador industrial",
    "MONTACARGAS":   "Montacarguista",
    "REFRIGERACION": "Técnico en refrigeración",
}

# Cual de los tres se trabaja en el almacen y no en la sucursal de venta.
# De aqui sale la regla que separa "Altamira" de "Almacen ALT": el
# formulario nunca dice almacen, solo ciudad, asi que a que centro de
# trabajo va un aspirante se deduce del PUESTO.
PUESTO_ALMACEN = "MONTACARGAS"

# Todas las formas en que llega escrito el puesto en la solicitud en
# linea, con el peso que tiene cada una (el peso solo lo usa el generador
# de datos; el backend solo necesita la lista de textos). La primera de
# cada lista es el texto canonico; las demas son las que hay que
# homologar.
#
# Son reales como problema, no como anecdota: el formulario cambio de
# opciones con el tiempo, estuvo un rato publicado en frances por un
# error de plantilla, el campo no era obligatorio al principio (de ahi
# los vacios, que son el caso mas comun despues del canonico) y la misma
# palabra llega con y sin acentos segun el teclado de quien la escribio.
VARIANTES_VACANTE = {
    "SOLDADOR": [
        ("Soldador industrial", 78),
        ("", 12),
        ("soudeur", 5),
        ("Welder", 5),
    ],
    "MONTACARGAS": [
        ("Montacarguista", 35),
        ("Operador de montacargas", 50),
        ("Operador montacargas", 15),
    ],
    "REFRIGERACION": [
        ("Técnico en refrigeración", 60),
        ("Tecnico en refrigeracion", 25),
        ("Refrigeración", 15),
    ],
}

# nombre del establecimiento en nomina -> sucursal canonica del tablero.
# 'CORPORATIVO' se deja fuera a proposito: no es ninguna de las 12
# sucursales que cubre el tablero (en la version interna pasa lo mismo).
ESTABLECIMIENTOS = {
    "MATRIZ ALTAMIRA":  "Altamira",
    "ALMACEN ALTAMIRA": "Almacen ALT",
    "BAHÍA VERDE":      "Bahia Verde",
    "CERRO AZUL":       "Cerro Azul",
    "DOS RÍOS":         "Dos Rios",
    "EL PARAJE":        "El Paraje",
    "CD. FUENTES":      "Fuentes",
    "GRANADOS":         "Granados",
    "ALMACEN GRANADOS": "Almacen GRA",
    "HUERTA NUEVA":     "Huerta Nueva",
    "ISLOTE":           "Islote",
    "JARA DEL VALLE":   "Jara del Valle",
    "LOMAS CLARAS":     "Lomas Claras",
    "MIRASOL":          "Mirasol",
    "ALMACEN MIRASOL":  "Almacen MRS",
}

# nombre_puesto de los folios de RH -> (texto canonico, codigo corto).
# Hacen falta los dos: el primero para lo que se muestra, el segundo para
# cruzar contra la campana correcta -- una sucursal puede tener campana de
# soldador y de refrigeracion a la vez, asi que el cruce de costo tiene
# que ir por sucursal Y puesto, no solo sucursal.
#
# Las llaves se guardan YA en mayusculas en la base: UPPER() de SQLite
# solo toca el rango ASCII, asi que 'refrigeración' no se convertiria
# sola y la llave acentuada no calzaria nunca.
PUESTOS_FOLIO = {
    "SOLDADOR INDUSTRIAL":      ("Soldador industrial", "SOLDADOR"),
    "MONTACARGUISTA":           ("Montacarguista", "MONTACARGAS"),
    "OPERADOR DE MONTACARGAS":  ("Montacarguista", "MONTACARGAS"),
    "TÉCNICO EN REFRIGERACIÓN": ("Técnico en refrigeración", "REFRIGERACION"),
    "TECNICO EN REFRIGERACION": ("Técnico en refrigeración", "REFRIGERACION"),
}


def sucursal_canonica(codigo: str) -> str:
    """'ALT' -> 'Altamira'."""
    for _original, canonica, cod in SUCURSALES:
        if cod == codigo:
            return canonica
    raise KeyError(codigo)
