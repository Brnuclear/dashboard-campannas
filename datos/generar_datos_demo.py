"""Genera la base SQLite de demostracion: datos/demo.sqlite.

    python datos/generar_datos_demo.py [--hasta YYYY-MM-DD] [--semilla N]

NO hay ninguna cifra real de la empresa aqui. Todo sale de un generador
con semilla fija: mismos parametros -> misma base, byte por byte. Lo que
se conservo del sistema real es la *forma*, no los valores:

  * el embudo (alcance -> impresiones -> resultados -> solicitudes ->
    contrataciones) y los ordenes de magnitud entre un nivel y el
    siguiente;
  * que el alcance no es aditivo entre dias (Meta lo deduplica por
    rango pedido), asi que frecuencia = impresiones / alcance > 1;
  * que "Resultados" mide dos cosas distintas segun el objetivo de la
    campana (conversaciones de Messenger iniciadas vs. clics al enlace),
    y que hay campanas que cambian de objetivo a la mitad;
  * la suciedad de los datos de origen: la sucursal escrita con acento
    en la solicitud y sin acento en el diccionario de Meta, el mismo
    puesto escrito de cuatro formas, campanas activas en Meta que no
    estan en el diccionario, una persona que aplica dos veces con la
    misma clave, un folio cubierto por alguien que ya trabajaba en la
    empresa;
  * el cansancio de audiencia: campanas cuya tasa de solicitudes por
    impresion se cae semana a semana.

Las fechas se generan RELATIVAS al dia de la corrida (`--hasta`, por
omision hoy), para que la demo nunca se vea vencida: volver a correr
este script la re-ancla al presente.
"""
import argparse
import math
import random
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.catalogo import (  # noqa: E402
    ALMACENES, ESTABLECIMIENTOS, PUESTOS, PUESTOS_FOLIO, PUESTO_ALMACEN,
    SUCURSALES, VARIANTES_VACANTE, almacen, sucursal_canonica,
)

RUTA_BD = Path(__file__).resolve().parent / "demo.sqlite"

# --- Campanas de la demo ---------------------------------------------------
# (nombre, codigo de sucursal, puesto, dias atras del inicio, dias atras
#  del fin o None si sigue activa, impresiones/dia base, solicitudes por
#  impresion, CPM en pesos, cansancio semanal, num. de conjuntos de
#  anuncios, tipo de resultado)
#
# 'cansancio' es el factor que multiplica la tasa de solicitudes cada
# semana que la campana lleva corriendo: 1.0 = no se cansa, 0.82 = pierde
# 18% de efectividad por semana. Es lo que hace que la regla de
# "refrescar o pausar" del marco de decision tenga de donde dispararse.
MENSAJES = "Conversaciones con mensajes iniciadas"
ENLACE = "Clics en el enlace"

CAMPANAS = [
    # Historia vieja: hace falta para que la pestana Resumen pueda
    # comparar un rango de 90 dias contra los 90 anteriores. Sin ella,
    # el periodo de comparacion sale casi vacio y los cambios se van a
    # "+1000%", que no describe nada.
    ("SOLD_MRS_ABRIL",                      "MRS", "SOLDADOR",      168, 140, 2500, 0.00130, 25.0, 0.96, 1, MENSAJES),
    ("C1_Montacargas ALMACEN GRA_ABR",      "GRA", "MONTACARGAS",   162, 132, 2200, 0.00140, 24.0, 0.98, 1, ENLACE),
    ("SOLDADOR LOMAS CLARAS MAYO",          "LMC", "SOLDADOR",      155, 120, 2700, 0.00115, 27.0, 0.95, 2, MENSAJES),
    ("SOLDADOR ISLOTE MAYO 02",             "ISL", "SOLDADOR",      150, 118, 3000, 0.00150, 23.0, 0.93, 1, MENSAJES),
    ("REFRI JDV MAYO",                      "JDV", "REFRIGERACION", 142, 110, 1600, 0.00105, 28.0, 1.00, 1, ENLACE),
    ("SOLD_FUENTES_MAYO",                   "FTS", "SOLDADOR",      138, 100, 3400, 0.00160, 24.0, 0.94, 2, MENSAJES),

    ("C1_SOLDADOR_MRS_12Jun2026",           "MRS", "SOLDADOR",      112,  70, 3200, 0.00150, 24.0, 0.95, 2, MENSAJES),
    ("SOLDADOR LOMAS CLARAS",               "LMC", "SOLDADOR",      105,  66, 2600, 0.00120, 26.0, 0.93, 1, MENSAJES),
    ("MONT_ALMACEN_GRANADOS",               "GRA", "MONTACARGAS",    98,  90, 4100, 0.00180, 21.0, 1.00, 2, ENLACE),
    ("C1_Montacargas ALMACEN ALT",          "ALT", "MONTACARGAS",   105,  57, 2900, 0.00135, 23.0, 0.97, 1, MENSAJES),
    ("Soldador_Islote_Dic2025 - Copia 2",   "ISL", "SOLDADOR",       95,  82, 2100, 0.00095, 29.0, 0.90, 1, MENSAJES),
    ("SOLDADO ISLOTE JULIO 09",             "ISL", "SOLDADOR",       86, None, 3400, 0.00165, 25.0, 0.84, 2, MENSAJES),
    ("SOLDADOR DOS RIOS",                   "DRI", "SOLDADOR",       87,  68, 2400, 0.00110, 27.0, 0.94, 1, MENSAJES),
    ("SOLDADOR EL PARAJE",                  "PRJ", "SOLDADOR",       86, None, 2800, 0.00125, 26.0, 0.96, 1, MENSAJES),
    ("SOLDADOR JDV JULIO 07",               "JDV", "SOLDADOR",       88, None, 4300, 0.00145, 24.0, 0.93, 2, MENSAJES),
    ("SOLDADOR ALTAMIRA JULIO 08",          "ALT", "SOLDADOR",       87, None, 3700, 0.00155, 25.0, 0.95, 2, MENSAJES),
    ("SOLDADOR_FUENTES_JUL29",              "FTS", "SOLDADOR",       66, None, 5100, 0.00170, 23.0, 0.97, 2, ENLACE),
    ("HTN_Soldador_15May2026",              "HTN", "SOLDADOR",       73, None, 2300, 0.00085, 31.0, 0.92, 1, MENSAJES),
    ("BAHÍA VERDE_Soldador taller_30Abr2026", "BHV", "SOLDADOR",     47, None, 2000, 0.00105, 28.0, 0.98, 1, MENSAJES),
    ("260818_CAMP_GRA_SOLDADOR",            "GRA", "SOLDADOR",       46, None, 2700, 0.00075, 33.0, 0.99, 1, MENSAJES),
    ("260819_CAMP_FUENTES_REFRI",           "FTS", "REFRIGERACION",  45, None, 1900, 0.00115, 27.0, 0.98, 1, ENLACE),
    ("260826_CAMP_DRI_SOLDADOR",            "DRI", "SOLDADOR",       38, None, 3100, 0.00160, 24.0, 1.00, 1, MENSAJES),
    ("MONT_ALMACEN_MIRASOL",                "MRS", "MONTACARGAS",    32, None, 3600, 0.00190, 22.0, 1.00, 2, ENLACE),
    ("REFRI LOMAS CLARAS SEP",              "LMC", "REFRIGERACION",  25, None, 1700, 0.00100, 29.0, 1.00, 1, MENSAJES),
    ("SOLDADOR HUERTA NUEVA RELEVO",        "HTN", "SOLDADOR",       20, None, 3300, 0.00175, 23.0, 1.00, 1, MENSAJES),
]

# Campanas que existen en Meta pero NO en el diccionario de campanas:
# nadie les asigno sucursal ni puesto, asi que no entran al cruce contra
# solicitudes. En el sistema real son cinco; aqui dos. El tablero las
# cuenta aparte y lo dice, en vez de sumarlas como si estuvieran
# atribuidas.
CAMPANAS_SIN_DICCIONARIO = [
    ("CAMP_ALCANCE_RH", 14, None, 1800, 12.0, 1, "Alcance"),
    ("CAMP_MARCA_EMPLEADOR",   60,  30, 1200, 15.0, 1, ENLACE),
]

# Sucursal sin ninguna campana registrada: existe, recibe solicitudes
# espontaneas y abre vacantes, pero nunca se le ha pagado publicidad.
# El tablero tiene que poder mostrarla vacia sin romperse.
SIN_CAMPANA = "CRZ"

# Como llega escrito el puesto en los folios de RH (ya en mayusculas).
# Los textos NO se escriben aqui: salen de catalogo.PUESTOS_FOLIO, que es
# la misma tabla con la que el backend los homologa. Aqui solo se decide
# que tan seguido aparece cada forma.
PESOS_PUESTO_FOLIO = {
    "SOLDADOR INDUSTRIAL": 100,
    "OPERADOR DE MONTACARGAS": 60,
    "MONTACARGUISTA": 40,
    "TÉCNICO EN REFRIGERACIÓN": 70,
    "TECNICO EN REFRIGERACION": 30,
}
assert set(PESOS_PUESTO_FOLIO) == set(PUESTOS_FOLIO), (
    "PESOS_PUESTO_FOLIO quedo desincronizado de catalogo.PUESTOS_FOLIO"
)

VARIANTES_PUESTO_FOLIO = {
    codigo: [(texto, PESOS_PUESTO_FOLIO[texto])
             for texto, (_canonico, cod) in PUESTOS_FOLIO.items() if cod == codigo]
    for codigo in PUESTOS
}

NOMBRES = [
    "ADRIAN", "ARACELI", "BEATRIZ", "BRAULIO", "CECILIA", "CLAUDIO", "DALIA",
    "DIONISIO", "ELOISA", "EMILIANO", "FABIOLA", "FELIPE", "GABRIELA",
    "GERARDO", "HILDA", "HORACIO", "IRENE", "ISMAEL", "JIMENA", "JOAQUIN",
    "KARINA", "LAURO", "LETICIA", "MARCELO", "NADIA", "NORBERTO", "OFELIA",
    "OSVALDO", "PATRICIA", "RAMIRO", "ROSALBA", "SALVADOR", "TERESA",
    "ULISES", "VIRIDIANA", "WENCESLAO", "XIMENA", "YOLANDA", "ZOILA",
]
APELLIDOS = [
    "ABREGO", "BALCAZAR", "CANTELLANO", "DURANTE", "ESQUIVIAS", "FRESNEDO",
    "GALLARDO", "HUERTAS", "IBARGUEN", "JAUREGUI", "LANDEROS", "MALVIDO",
    "NAVARRETE", "OLAVARRIA", "PRECIADO", "QUEZADA", "RETANA", "SANDOVAL",
    "TOLENTINO", "URIBARREN", "VELAZQUEZ", "ZARAGOZA",
]

RAZONES_SIN_PERSONA = ["AUMENTO DE PLANTILLA", "BAJA ANTES DE SISTEMA"]

ESQUEMA = """
PRAGMA journal_mode = DELETE;

-- Diccionario de campanas: lo unico que le da sucursal y puesto a una
-- campana de Meta. Lo mantiene RH a mano; una campana que no este aqui
-- no se puede cruzar contra solicitudes.
CREATE TABLE dim_campana_facebook (
    nombre_campana TEXT PRIMARY KEY COLLATE NOCASE,
    sucursal       TEXT NOT NULL COLLATE NOCASE,
    puesto         TEXT NOT NULL,
    fecha_inicio   DATE NOT NULL,
    fecha_fin      DATE          -- NULL = sigue corriendo
);

-- Export diario de Meta Ads Manager, un renglon por campana + conjunto
-- de anuncios + dia. Las columnas son las 12 del reporte real que sirven
-- para el embudo; los cocientes (CTR, costo por resultado) NO se
-- guardan, se derivan al momento de mostrarse.
CREATE TABLE rh_campannas_facebook (
    id                  INTEGER PRIMARY KEY,
    nombre_campana      TEXT NOT NULL COLLATE NOCASE,
    nombre_set_anuncios TEXT,
    dia                 DATE NOT NULL,
    estado_entrega      TEXT,
    nivel_entrega       TEXT,
    tipo_resultado      TEXT,
    resultados          INTEGER,
    importe             REAL,
    impresiones         INTEGER,
    alcance             INTEGER,
    clics_enlace        INTEGER,
    clics_todos         INTEGER
);
CREATE INDEX ix_fb_campana_dia ON rh_campannas_facebook (nombre_campana, dia);

-- Solicitudes en linea. En el sistema real es la replica de una tabla de
-- 51 columnas; aqui solo estan las que el tablero lee de verdad.
CREATE TABLE rh_solicitantes (
    id               INTEGER PRIMARY KEY,
    fecha_realizado  DATE NOT NULL,
    sucursal_interes TEXT,
    vacante_interes  TEXT,
    clave_candidato  TEXT   -- identificador de persona; en el sistema real, su clave oficial de identidad
);
CREATE INDEX ix_sol_atribucion
    ON rh_solicitantes (sucursal_interes, vacante_interes, fecha_realizado);

-- Catalogo de establecimientos de nomina: el tercer texto para la misma
-- sucursal, el que hay que homologar.
CREATE TABLE establecimientos (
    cod_estab TEXT PRIMARY KEY,
    nombre    TEXT NOT NULL
);

-- Registro de nomina. Solo aporta la fecha de ingreso real y la clave de
-- la persona, para saber si el folio se lleno y con quien.
CREATE TABLE empleados (
    empleado        INTEGER PRIMARY KEY,
    clave_candidato TEXT,
    fecha_ingreso   DATE
);

-- Folios de vacante del sistema interno de reclutamiento: la necesidad
-- que la campana intenta cubrir. Uno por plaza, no por campana.
CREATE TABLE rh_campanas_reclutamiento (
    folio                TEXT PRIMARY KEY,
    cod_estab            TEXT,
    puesto               TEXT,
    fecha_creacion       DATE,
    num_empleado_alta    INTEGER,
    num_empleado_baja    INTEGER,
    nombre_completo_alta TEXT,
    nombre_completo_baja TEXT
);
"""


def _elegir_ponderado(rng, opciones):
    total = sum(p for _, p in opciones)
    corte = rng.uniform(0, total)
    acumulado = 0
    for valor, peso in opciones:
        acumulado += peso
        if corte <= acumulado:
            return valor
    return opciones[-1][0]


def _poisson(rng, lam):
    """Knuth. Las lambdas de aqui son chicas (< 15 solicitudes/dia), asi
    que la version simple sobra y no arrastra una dependencia mas."""
    if lam <= 0:
        return 0
    limite, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limite:
            return k
        k += 1


def _nombre_persona(rng):
    return f"{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}"


# Lunes a jueves la gente aplica mas que en fin de semana; Meta tambien
# entrega distinto. Indice 0 = lunes.
FACTOR_DIA_SEMANA = [1.08, 1.10, 1.06, 1.02, 0.96, 0.82, 0.78]


def generar_facebook(rng, hoy):
    """Un renglon por campana + conjunto de anuncios + dia."""
    filas = []
    # (campana -> [(dia, impresiones)]) para poder derivar las solicitudes
    # del mismo volumen de impresiones que se acaba de generar.
    impresiones_por_campana = {}

    especificaciones = [
        (nombre, inicio, fin, base, cpm, n_sets, tipo, cansancio, tasa)
        for (nombre, _cod, _puesto, inicio, fin, base, tasa, cpm, cansancio, n_sets, tipo) in CAMPANAS
    ] + [
        (nombre, inicio, fin, base, cpm, n_sets, tipo, 1.0, 0.0)
        for (nombre, inicio, fin, base, cpm, n_sets, tipo) in CAMPANAS_SIN_DICCIONARIO
    ]

    for nombre, dias_inicio, dias_fin, base, cpm, n_sets, tipo, cansancio, _tasa in especificaciones:
        inicio = hoy - timedelta(days=dias_inicio)
        fin = hoy if dias_fin is None else hoy - timedelta(days=dias_fin)
        serie = []

        dia = inicio
        while dia <= fin:
            semana = (dia - inicio).days // 7
            # Huecos: dias sin renglon en el export. Pasa de verdad --
            # sincronizacion de Meta, presupuesto agotado a medio dia,
            # la campana apagada y vuelta a encender.
            if rng.random() < 0.05:
                dia += timedelta(days=1)
                continue

            factor = FACTOR_DIA_SEMANA[dia.weekday()] * rng.uniform(0.80, 1.20)
            # Arranque: Meta tarda 2-3 dias en salir del aprendizaje.
            if (dia - inicio).days < 3:
                factor *= 0.55
            impresiones_dia = max(60, int(base * factor))
            serie.append((dia, impresiones_dia))

            # El dia se reparte entre los conjuntos de anuncios activos.
            reparto = sorted(rng.uniform(0.3, 0.7) for _ in range(n_sets - 1))
            cortes = [0.0, *reparto, 1.0]
            for s in range(n_sets):
                parte = cortes[s + 1] - cortes[s]
                impresiones = max(20, int(impresiones_dia * parte))
                # El alcance no es aditivo: dentro de un mismo dia Meta
                # ya lo deduplica, y la frecuencia sube conforme la
                # campana lleva mas semanas machacando a la misma gente.
                frecuencia = min(1.95, 1.04 + 0.05 * semana + rng.uniform(0, 0.10))
                alcance = max(10, int(impresiones / frecuencia))

                ctr_todos = rng.uniform(0.028, 0.060)
                clics_todos = max(1, int(impresiones * ctr_todos))
                clics_enlace = max(1, int(clics_todos * rng.uniform(0.28, 0.52)))

                # "Resultados" no es la misma cosa en las dos campanas:
                # en las de Messenger son conversaciones iniciadas, en
                # las de trafico son los clics al enlace, y en la de
                # alcance es el alcance mismo. Se guarda el tipo junto
                # con el numero justamente por eso.
                tipo_set = tipo
                if nombre in ("MONT_ALMACEN_GRANADOS", "SOLDADOR_FUENTES_JUL29") and s == 1:
                    tipo_set = MENSAJES  # campanas que mezclan objetivos entre sus conjuntos
                if tipo_set == MENSAJES:
                    resultados = max(1, int(impresiones * rng.uniform(0.009, 0.018)))
                elif tipo_set == "Alcance":
                    resultados = alcance
                else:
                    resultados = clics_enlace

                importe = round(impresiones / 1000 * cpm * rng.uniform(0.88, 1.12), 2)
                activa = dias_fin is None
                filas.append((
                    nombre,
                    f"CA{s + 1}_{nombre[:18].strip().replace(' ', '_')}",
                    dia,
                    "active" if activa and dia > hoy - timedelta(days=3) else
                    ("not_delivering" if activa else "completed"),
                    "adset",
                    tipo_set, resultados, importe, impresiones, alcance,
                    clics_enlace, clics_todos,
                ))
            dia += timedelta(days=1)

        impresiones_por_campana[nombre] = serie
    return filas, impresiones_por_campana


def generar_solicitantes(rng, hoy, impresiones_por_campana):
    """Las solicitudes salen del volumen de impresiones que ya se genero,
    no de un conteo suelto: es lo que hace que el embudo del tablero se
    sostenga (mas impresiones -> mas solicitudes, con una tasa que se
    cansa semana a semana) en vez de ser dos series sin relacion."""
    # (sucursal canonica, puesto) -> {dia: lambda}
    lambdas = {}

    for (nombre, cod, puesto, dias_inicio, _fin, _base, tasa, _cpm, cansancio, _n, _tipo) in CAMPANAS:
        inicio = hoy - timedelta(days=dias_inicio)
        sucursal = almacen(cod) if puesto == PUESTO_ALMACEN and cod in ALMACENES else sucursal_canonica(cod)
        for dia, impresiones in impresiones_por_campana[nombre]:
            semana = (dia - inicio).days // 7
            tasa_dia = tasa * (cansancio ** semana)
            clave = (sucursal, puesto)
            lambdas.setdefault(clave, {})
            lambdas[clave][dia] = lambdas[clave].get(dia, 0.0) + impresiones * tasa_dia

    # Solicitudes espontaneas: gente que llega al formulario sin venir de
    # un anuncio (referidos, la vacante pegada en la sucursal). Son pocas
    # pero existen todos los dias, tambien donde no hay campana -- si no
    # estuvieran, el tablero daria la impresion falsa de que el 100% de
    # las solicitudes las trae Meta.
    organico = {"SOLDADOR": 0.10, "MONTACARGAS": 0.05, "REFRIGERACION": 0.04}
    primer_dia = hoy - timedelta(days=200)
    for _original, canonica, cod in SUCURSALES:
        for puesto in PUESTOS:
            # Nadie aplica a montacarguista en una ciudad que no tiene
            # almacen: ahi no existe la plaza. Sin este corte, el selector
            # de sucursales acabaria ofreciendo doce almacenes cuando solo
            # hay tres -- la lista sale de los datos, no de un catalogo.
            if puesto == PUESTO_ALMACEN and cod not in ALMACENES:
                continue
            sucursal = almacen(cod) if puesto == PUESTO_ALMACEN else canonica
            clave = (sucursal, puesto)
            lambdas.setdefault(clave, {})
            dia = primer_dia
            while dia <= hoy:
                lambdas[clave][dia] = lambdas[clave].get(dia, 0.0) + organico[puesto]
                dia += timedelta(days=1)

    # Como se escribe cada sucursal canonica en la solicitud en linea: el
    # formulario pregunta por ciudad, nunca por el almacen. Un aspirante
    # al almacen de Altamira escribe "Altamira" y "Operador de
    # montacargas"; que eso es el almacen y no la tienda de la ciudad lo
    # deduce el tablero del puesto, no del texto.
    ciudad_de_canonica = {}
    for original, canonica, cod in SUCURSALES:
        ciudad_de_canonica[canonica] = original
        ciudad_de_canonica[almacen(cod)] = original

    filas = []
    claves_usadas = []
    siguiente_id = 100_001
    for (sucursal, puesto), por_dia in sorted(lambdas.items()):
        for dia, lam in sorted(por_dia.items()):
            factor = FACTOR_DIA_SEMANA[dia.weekday()]
            for _ in range(_poisson(rng, lam * factor)):
                # ~2% de las solicitudes son de alguien que ya habia
                # aplicado antes (misma clave, otro renglon). El cruce
                # contra folios tiene que resolverlo con MIN(), no
                # duplicar el folio.
                if claves_usadas and rng.random() < 0.02:
                    clave_candidato = rng.choice(claves_usadas)
                else:
                    clave_candidato = f"CAND{siguiente_id:06d}"
                    claves_usadas.append(clave_candidato)
                filas.append((
                    siguiente_id,
                    dia,
                    ciudad_de_canonica[sucursal],
                    _elegir_ponderado(rng, VARIANTES_VACANTE[puesto]),
                    clave_candidato,
                ))
                siguiente_id += 1
    return filas


def generar_folios(rng, hoy, solicitantes):
    """Folios de vacante + su registro de nomina cuando se cubrieron.

    Un folio se cubre con una persona que ANTES mando su solicitud: se
    busca entre los solicitantes de esa misma sucursal y puesto, con
    fecha posterior a la apertura del folio. Asi el tablero puede medir
    de verdad el camino solicitud -> contratacion, que es el punto del
    ejercicio."""
    cod_por_nombre = {nombre: f"{i + 1:02d}" for i, nombre in enumerate(ESTABLECIMIENTOS)}
    cod_por_nombre["CORPORATIVO"] = f"{len(cod_por_nombre) + 1:02d}"
    establecimientos = [(cod, nombre) for nombre, cod in cod_por_nombre.items()]

    # sucursal canonica -> nombre de establecimiento en nomina
    estab_de_canonica = {canonica: nombre for nombre, canonica in ESTABLECIMIENTOS.items()}

    # Solicitantes indexados por (sucursal canonica, puesto) para poder
    # elegir a quien se contrato. Se reconstruye aqui la misma
    # homologacion que hace el tablero en SQL.
    canonica_de_ciudad = {}
    for original, canonica, cod in SUCURSALES:
        for puesto_codigo in PUESTOS:
            canonica_de_ciudad[(original, puesto_codigo)] = (
                almacen(cod) if puesto_codigo == PUESTO_ALMACEN and cod in ALMACENES
                else canonica
            )
    puesto_de_vacante = {}
    for puesto, variantes in VARIANTES_VACANTE.items():
        for texto, _peso in variantes:
            puesto_de_vacante[texto] = puesto

    por_grupo = {}
    for _id, dia, ciudad, vacante, clave in solicitantes:
        puesto = puesto_de_vacante[vacante]
        canonica = canonica_de_ciudad[(ciudad, puesto)]
        por_grupo.setdefault((canonica, puesto), []).append((dia, clave))
    for lista in por_grupo.values():
        lista.sort()

    # (sucursal canonica, puesto, fecha de apertura) de cada folio que se
    # va a abrir: uno a tres por campana, mas los de la sucursal sin
    # campana y dos de Corporativo (que el tablero debe ignorar).
    pendientes = []
    for (_nombre, cod, puesto, dias_inicio, _f, _b, _t, _c, _ca, _n, _ti) in CAMPANAS:
        canonica = almacen(cod) if puesto == PUESTO_ALMACEN and cod in ALMACENES else sucursal_canonica(cod)
        inicio = hoy - timedelta(days=dias_inicio)
        for _ in range(rng.randint(1, 3)):
            pendientes.append((canonica, puesto, inicio - timedelta(days=rng.randint(0, 6))))
    for _ in range(3):
        pendientes.append((
            sucursal_canonica(SIN_CAMPANA), "SOLDADOR",
            hoy - timedelta(days=rng.randint(30, 120)),
        ))
    pendientes.sort(key=lambda p: p[2])

    folios, empleados = [], []
    usadas = set()
    siguiente_empleado = 7001

    # El folio de 'Granados'+soldador se deja siempre cubierto y sin
    # ninguna vacante activa, para que la campana que sigue pagando ahi
    # caiga en "Pausar" en el marco de decision: hay anuncio corriendo
    # sin necesidad vigente que lo justifique. Es el caso que el tablero
    # existe para encontrar.
    for i, (canonica, puesto, apertura) in enumerate(pendientes, start=1):
        folio = f"FOL-{i:04d}"
        forzar_cubierta = (canonica, puesto) == ("Granados", "SOLDADOR")
        suerte = rng.random()

        candidatos = [
            (dia, clave) for dia, clave in por_grupo.get((canonica, puesto), [])
            if dia >= apertura and clave not in usadas
        ]
        # Una reasignacion: el folio lo lleno alguien que ya trabajaba en
        # la empresa desde mucho antes de que se abriera. Su fecha de
        # ingreso es la de su entrada a la EMPRESA, no la de este folio,
        # asi que no es una contratacion nueva y no debe contar.
        if i == 7:
            empleado = siguiente_empleado
            siguiente_empleado += 1
            empleados.append((empleado, None, apertura - timedelta(days=281)))
            folios.append((
                folio, cod_por_nombre[estab_de_canonica[canonica]],
                _elegir_ponderado(rng, VARIANTES_PUESTO_FOLIO[puesto]), apertura,
                empleado, None, _nombre_persona(rng),
                _elegir_ponderado(rng, [(_nombre_persona(rng), 55),
                                        (RAZONES_SIN_PERSONA[0], 25),
                                        (RAZONES_SIN_PERSONA[1], 20)]),
            ))
            continue

        if candidatos and (forzar_cubierta or suerte < 0.62):
            dia_solicitud, clave = candidatos[rng.randint(0, min(4, len(candidatos) - 1))]
            ingreso = dia_solicitud + timedelta(days=rng.randint(8, 34))
            if ingreso <= hoy:
                usadas.add(clave)
                empleado = siguiente_empleado
                siguiente_empleado += 1
                empleados.append((empleado, clave, ingreso))
                folios.append((
                    folio, cod_por_nombre[estab_de_canonica[canonica]],
                    _elegir_ponderado(rng, VARIANTES_PUESTO_FOLIO[puesto]), apertura,
                    empleado, None, _nombre_persona(rng),
                    _elegir_ponderado(rng, [(_nombre_persona(rng), 55),
                                            (RAZONES_SIN_PERSONA[0], 25),
                                            (RAZONES_SIN_PERSONA[1], 20)]),
                ))
                continue

        # Activa: no hay fecha de ingreso todavia, la plaza sigue abierta.
        folios.append((
            folio, cod_por_nombre[estab_de_canonica[canonica]],
            _elegir_ponderado(rng, VARIANTES_PUESTO_FOLIO[puesto]), apertura,
            None, None, None,
            _elegir_ponderado(rng, [(_nombre_persona(rng), 55),
                                    (RAZONES_SIN_PERSONA[0], 25),
                                    (RAZONES_SIN_PERSONA[1], 20)]),
        ))

    # Invariante del negocio: si una campana sigue corriendo es porque
    # hay una plaza sin cubrir que la justifica. RH no paga anuncios para
    # una vacante que ya lleno. Las vueltas de arriba cubren folios al
    # azar y pueden dejar una campana activa sin ninguna vacante abierta;
    # aqui se repone, para que el marco de decision solo marque "Pausar"
    # donde de verdad corresponde.
    #
    # La excepcion es a proposito: 'Granados' + soldador se queda sin
    # vacante activa aunque su campana siga encendida. Es el hallazgo que
    # el tablero existe para encontrar -- dinero corriendo sin necesidad
    # vigente detras -- y sin un caso asi en los datos la pestana de
    # decisiones no tendria nada que ensenar.
    activas_por_grupo = {
        (cod_estab, puesto_folio)
        for (_f, cod_estab, puesto_folio, _fc, alta, _b, _na, _nb) in folios
        if alta is None
    }
    siguiente_folio = len(pendientes) + 1
    for (_nombre, cod, puesto, dias_inicio, dias_fin, *_resto) in CAMPANAS:
        if dias_fin is not None:
            continue  # ya termino: no necesita vacante abierta
        canonica = almacen(cod) if puesto == PUESTO_ALMACEN and cod in ALMACENES else sucursal_canonica(cod)
        if (canonica, puesto) == ("Granados", "SOLDADOR"):
            continue
        cod_estab = cod_por_nombre[estab_de_canonica[canonica]]
        variantes = {texto for texto, _peso in VARIANTES_PUESTO_FOLIO[puesto]}
        if any(c == cod_estab and p in variantes for c, p in activas_por_grupo):
            continue
        apertura = hoy - timedelta(days=dias_inicio) - timedelta(days=rng.randint(0, 6))
        puesto_folio = _elegir_ponderado(rng, VARIANTES_PUESTO_FOLIO[puesto])
        folios.append((
            f"FOL-{siguiente_folio:04d}", cod_estab, puesto_folio, apertura,
            None, None, None,
            _elegir_ponderado(rng, [(_nombre_persona(rng), 55),
                                    (RAZONES_SIN_PERSONA[0], 25),
                                    (RAZONES_SIN_PERSONA[1], 20)]),
        ))
        activas_por_grupo.add((cod_estab, puesto_folio))
        siguiente_folio += 1

    # Corporativo: existe en nomina, nunca entra al tablero.
    for n in range(2):
        folios.append((
            f"FOL-9{n:03d}", cod_por_nombre["CORPORATIVO"], "SOLDADOR INDUSTRIAL",
            hoy - timedelta(days=rng.randint(40, 90)), None, None, None,
            RAZONES_SIN_PERSONA[0],
        ))

    return establecimientos, empleados, folios


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--hasta", default=date.today().isoformat(),
                   help="ultimo dia con datos (YYYY-MM-DD); por omision hoy")
    p.add_argument("--semilla", type=int, default=20261003)
    args = p.parse_args()

    hoy = date.fromisoformat(args.hasta)
    rng = random.Random(args.semilla)

    fb, impresiones = generar_facebook(rng, hoy)
    solicitantes = generar_solicitantes(rng, hoy, impresiones)
    establecimientos, empleados, folios = generar_folios(rng, hoy, solicitantes)

    dim = [
        (nombre, almacen(cod) if puesto == PUESTO_ALMACEN and cod in ALMACENES
         else sucursal_canonica(cod).upper(),
         puesto,
         hoy - timedelta(days=dias_inicio),
         None if dias_fin is None else hoy - timedelta(days=dias_fin))
        for (nombre, cod, puesto, dias_inicio, dias_fin, _b, _t, _c, _ca, _n, _ti) in CAMPANAS
    ]

    if RUTA_BD.exists():
        RUTA_BD.unlink()
    cn = sqlite3.connect(RUTA_BD)
    sqlite3.register_adapter(date, lambda d: d.isoformat())
    try:
        cn.executescript(ESQUEMA)
        cn.executemany("INSERT INTO dim_campana_facebook VALUES (?,?,?,?,?)", dim)
        cn.executemany(
            "INSERT INTO rh_campannas_facebook (nombre_campana, nombre_set_anuncios, dia,"
            " estado_entrega, nivel_entrega, tipo_resultado, resultados, importe,"
            " impresiones, alcance, clics_enlace, clics_todos)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", fb)
        cn.executemany("INSERT INTO rh_solicitantes VALUES (?,?,?,?,?)", solicitantes)
        cn.executemany("INSERT INTO establecimientos VALUES (?,?)", establecimientos)
        cn.executemany("INSERT INTO empleados VALUES (?,?,?)", empleados)
        cn.executemany("INSERT INTO rh_campanas_reclutamiento VALUES (?,?,?,?,?,?,?,?)", folios)
        cn.commit()
        cn.execute("VACUUM")
    finally:
        cn.close()

    print(f"{RUTA_BD}")
    print(f"  campanas en el diccionario : {len(dim)}")
    print(f"  campanas solo en Meta      : {len(CAMPANAS_SIN_DICCIONARIO)}")
    print(f"  renglones de Meta          : {len(fb)}")
    print(f"  solicitudes                : {len(solicitantes)}")
    print(f"  folios de vacante          : {len(folios)}")
    print(f"  rango                      : {hoy - timedelta(days=200)} .. {hoy}")


if __name__ == "__main__":
    main()
