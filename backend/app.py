"""API del tablero de campanas de Meta vs. solicitantes (version demo).

Sirve las rutas de datos y, en produccion, el frontend ya compilado.

    python -m backend.app

Esta es la version para compartir: los datos salen de un SQLite con
datos generados (ver datos/generar_datos_demo.py), no de las bases de la
empresa. La logica de negocio -- homologacion de sucursales y puestos,
atribucion de solicitudes a campanas, deteccion de reasignaciones, marco
de decision -- es la misma; lo unico que cambio fue el dialecto de SQL y
de donde se lee.

Diferencias de dialecto contra la version interna (SQL Server):

    DATEFROMPARTS(YEAR(x), MONTH(x), 1)          -> date(x, 'start of month')
    DATEADD(WEEK, DATEDIFF(WEEK, 0, x), 0)       -> date(x, '-6 days', 'weekday 1')
    CAST(x AS DATE)                              -> date(x)
    bi.dbo.tabla / origen.dbo.tabla              -> tabla
    LTRIM(RTRIM(x))                              -> trim(x)
    columna de tipo DATE                          -> alias AS "col [DATE]" (ver bd.py)
"""
from datetime import date, datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory

from . import bd, config
from .catalogo import (
    ESTABLECIMIENTOS, PUESTOS, PUESTOS_FOLIO, PUESTO_ALMACEN,
    SUCURSALES, VARIANTES_VACANTE, almacen,
)

app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")

# --- Correccion de vacante y sucursal ------------------------------------
# Dos correcciones encadenadas, y el orden entre ellas no es negociable:
# primero se homologa el PUESTO (vacante vacia, escrita sin acentos o en
# otro idioma), porque la correccion de SUCURSAL necesita el puesto ya
# limpio para decidir si la solicitud va a la tienda de la ciudad o al
# almacen regional. El formulario nunca pregunta por el almacen, solo por
# la ciudad: que un montacarguista de Altamira trabaja en el almacen y no
# en la tienda se deduce del puesto, no del texto de la sucursal.
#
# Las dos se generan desde backend/catalogo.py en vez de escribirse a
# mano: una variante nueva en el formulario se agrega en un solo lugar y
# aparece sola en las dos consultas.


def _caso_vacante() -> str:
    """Toda forma conocida de escribir un puesto -> su texto canonico."""
    lineas = []
    for codigo, variantes in VARIANTES_VACANTE.items():
        canonico = PUESTOS[codigo]
        for texto, _peso in variantes:
            if texto == canonico:
                continue  # ya esta en su forma final; lo recoge el ELSE
            lineas.append(
                f"WHEN rs.vacante_interes = '{texto}' THEN '{canonico}'"
            )
    return "\n                ".join(lineas)


def _caso_sucursal() -> str:
    """Ciudad + puesto ya homologado -> centro de trabajo canonico."""
    lineas = []
    for original, venta, codigo in SUCURSALES:
        for puesto_codigo, puesto in PUESTOS.items():
            destino = almacen(codigo) if puesto_codigo == PUESTO_ALMACEN else venta
            lineas.append(
                f"WHEN cv.sucursal_interes = '{original}' AND cv.vacante = "
                f"'{puesto}' THEN '{destino}'"
            )
    return "\n                ".join(lineas)


SOLICITANTES_CTE = f"""
    correccion_vacantes AS (
        SELECT
            rs.fecha_realizado,
            rs.id,
            rs.sucursal_interes,
            CASE
                {_caso_vacante()}
                ELSE rs.vacante_interes
            END AS vacante
        FROM rh_solicitantes AS rs
    ),
    correccion_sucursal AS (
        SELECT
            fecha_realizado,
            id,
            vacante,
            CASE
                {_caso_sucursal()}
                ELSE cv.sucursal_interes
            END AS sucursal
        FROM correccion_vacantes AS cv
    )
"""

# dia -> fecha; semana -> lunes de esa semana; mes -> dia 1.
#
# El lunes se resuelve con date(x, '-6 days', 'weekday 1'): "retrocede
# seis dias y avanza al siguiente lunes". Es la unica forma que da el
# mismo resultado para los siete dias de la semana, incluido el lunes
# mismo (donde 'weekday 1' solo no se moveria) y el domingo (que en la
# norma ISO pertenece a la semana que empezo el lunes anterior, no a la
# que empieza manana).
_PERIODOS = {
    "dia":    "date({col})",
    "semana": "date({col}, '-6 days', 'weekday 1')",
    "mes":    "date({col}, 'start of month')",
}


def _periodo_sql(col: str, granularidad: str) -> str:
    return _PERIODOS[granularidad].format(col=col)


# La base interna usa una colacion insensible a mayusculas, asi que
# 'ALTAMIRA' y 'Altamira' son la misma fila para SQL -- pero no para un
# set() de Python. Sin normalizar, el selector mostraria cada sucursal
# dos veces (una por cada fuente, con su propia mayuscula/minuscula).
_CANONICO = {}
for _original, _venta, _codigo in SUCURSALES:
    _CANONICO[_venta.upper()] = _venta
    _CANONICO[almacen(_codigo).upper()] = almacen(_codigo)


def _normalizar_sucursal(nombre: str) -> str:
    return _CANONICO.get(nombre.upper(), nombre)


# --- Contrataciones (folios de RH + nomina) -------------------------------
# Fuente distinta de rh_solicitantes: aqui cada fila es una vacante que de
# verdad se lleno (folio interno de RH + registro de nomina), no una
# aplicacion. Sirve para marcar el momento exacto de contratacion en las
# graficas y estimar cuanto costo en anuncios cada una.
#
# El nombre de establecimiento en nomina no es el mismo texto que usa el
# diccionario de campanas de Meta (ahi los almacenes vienen con el
# nombre completo: 'ALMACEN ALTAMIRA', no el codigo 'ALT'; la tienda de
# la ciudad se llama 'MATRIZ ALTAMIRA'). Se traduce al mismo nombre
# canonico que ya usa el resto del tablero (ver backend/catalogo.py).

FOLIOS_SQL = """
    WITH campannas_puesto_establecimiento AS (
        SELECT
            rcr.fecha_creacion AS fecha_creacion_campanna,
            e.fecha_ingreso AS fecha_ingreso,
            e.clave_candidato AS clave_candidato,
            rcr.folio, rcr.cod_estab, rcr.num_empleado_baja, rcr.num_empleado_alta,
            UPPER(rcr.puesto) AS nombre_puesto_original,
            rcr.nombre_completo_alta, rcr.nombre_completo_baja
        FROM rh_campanas_reclutamiento AS rcr
        LEFT JOIN empleados AS e ON rcr.num_empleado_alta = e.empleado
    )
    SELECT
        cpe.fecha_creacion_campanna AS "fecha_creacion_campanna [DATE]",
        cpe.fecha_ingreso AS "fecha_ingreso [DATE]",
        cpe.folio, cpe.cod_estab,
        cpe.num_empleado_baja, cpe.num_empleado_alta, cpe.nombre_puesto_original,
        cpe.nombre_completo_alta, cpe.nombre_completo_baja,
        trim(est.nombre) AS nombre_establecimiento,
        MIN(rs.fecha_realizado) AS "fecha_solicitud [DATE]"
    FROM campannas_puesto_establecimiento cpe
    LEFT JOIN establecimientos est ON cpe.cod_estab = est.cod_estab
    -- MIN(): la misma persona a veces aplica mas de una vez con la misma
    -- clave (aplico como "Montacarguista" y luego como "Operador de
    -- montacargas", que ya sabiamos que son el mismo puesto). Sin el
    -- MIN, el JOIN duplicaria
    -- ese folio en dos filas. Se toma la primera solicitud, no la
    -- ultima: es la que de verdad marca cuando esa persona empezo su
    -- camino con la empresa.
    LEFT JOIN rh_solicitantes rs
        ON cpe.clave_candidato = rs.clave_candidato
        AND rs.clave_candidato <> '' AND rs.clave_candidato IS NOT NULL
    GROUP BY cpe.fecha_creacion_campanna, cpe.fecha_ingreso, cpe.folio, cpe.cod_estab,
             cpe.num_empleado_baja, cpe.num_empleado_alta, cpe.nombre_puesto_original,
             cpe.nombre_completo_alta, cpe.nombre_completo_baja, est.nombre
"""
# Nota: aqui NO se filtra "WHERE fecha_ingreso IS NOT NULL" -- esta
# consulta es la unica fuente de verdad para TODOS los folios (activos y
# cubiertos). Quien solo quiera cubiertos (_folios_validos, mas abajo)
# filtra en Python.


def _folios_todos(cur) -> list[dict]:
    """Todos los folios homologados (sucursal reconocida, puesto mapeado,
    sin Corporativo), cada uno con su estatus: 'activa' (sin fecha de
    ingreso todavia), 'cubierta' (contratacion nueva) o 'reasignacion'
    (el folio se lleno con alguien que ya trabajaba en la empresa desde
    antes, no cuenta como contratacion nueva).
    """
    filas = cur.execute(FOLIOS_SQL).fetchall()
    cols = [c[0] for c in cur.description]

    resultado = []
    for r in filas:
        f = dict(zip(cols, r))

        sucursal_folio = ESTABLECIMIENTOS.get(f["nombre_establecimiento"])
        mapeo_puesto = PUESTOS_FOLIO.get(f["nombre_puesto_original"])
        if sucursal_folio is None or mapeo_puesto is None:
            continue
        puesto_texto, puesto_cod = mapeo_puesto

        # Ya vienen como datetime.date (ver bd.py). En la version interna
        # son DATETIME y hay que pedirles .date() antes de restarlas.
        creacion = f["fecha_creacion_campanna"]
        ingreso = f["fecha_ingreso"]
        solicitud = f["fecha_solicitud"]

        if ingreso is None:
            estatus = "activa"
        elif (ingreso - creacion).days < -config.UMBRAL_REASIGNACION_DIAS:
            estatus = "reasignacion"
        else:
            estatus = "cubierta"

        resultado.append({
            "folio": f["folio"],
            "sucursal": sucursal_folio,
            "puesto": puesto_texto,
            "puesto_codigo": puesto_cod,
            "estatus": estatus,
            "fecha_creacion_campanna": creacion,
            "fecha_ingreso": ingreso,
            "fecha_solicitud": solicitud,
            "nombre": f["nombre_completo_alta"] or None,
            "nombre_baja": (f["nombre_completo_baja"] or "").strip() or None,
        })
    return resultado


def _folios_validos(cur, sucursal: str, puesto_codigo: str | None = None) -> list[dict]:
    """Folios cubiertos por una contratacion nueva (no activos, no
    reasignaciones) de una sucursal (y opcionalmente puesto) en
    particular. `puesto_codigo` lo usa la vista por campana, donde ademas
    del almacen-vs-ciudad que ya resuelve `sucursal` hace falta el puesto
    exacto (una sucursal puede tener dos campanas de puestos distintos a
    la vez).
    """
    resultado = []
    for f in _folios_todos(cur):
        if f["estatus"] != "cubierta" or f["sucursal"] != sucursal:
            continue
        if puesto_codigo is not None and f["puesto_codigo"] != puesto_codigo:
            continue
        resultado.append(f)
    return resultado


def _serializar_contratacion(f: dict) -> dict:
    # fecha_ingreso/fecha_solicitud se dejan como date, NO como texto: quien
    # llama todavia necesita hacer aritmetica de fechas (_bucket) antes de
    # convertir a JSON al final.
    ingreso, creacion = f["fecha_ingreso"], f["fecha_creacion_campanna"]
    solicitud = f["fecha_solicitud"]
    return {
        "folio": f["folio"],
        "fecha_ingreso": ingreso,
        "fecha_solicitud": solicitud,
        "nombre": f["nombre"],
        "puesto": f["puesto"],
        "dias_contratacion": (ingreso - creacion).days,
        "dias_desde_solicitud": (ingreso - solicitud).days if solicitud else None,
    }


def _contrataciones(cur, sucursal: str, desde_d, hasta_d) -> list[dict]:
    """Vista por sucursal: filtra por fecha_ingreso, el costo suma TODAS
    las campanas de esa sucursal+puesto durante la ventana del folio."""
    resultado = []
    for f in _folios_validos(cur, sucursal):
        if not (desde_d <= f["fecha_ingreso"] <= hasta_d):
            continue
        costo = cur.execute("""
            SELECT SUM(fb.importe)
            FROM rh_campannas_facebook fb
            JOIN dim_campana_facebook d ON d.nombre_campana = fb.nombre_campana
            WHERE d.sucursal = ? AND d.puesto = ? AND fb.dia BETWEEN ? AND ?
        """, f["sucursal"], f["puesto_codigo"], f["fecha_creacion_campanna"], f["fecha_ingreso"]).fetchval()
        resultado.append({**_serializar_contratacion(f), "costo_estimado": float(costo) if costo is not None else None})
    return resultado


def _contrataciones_campana(cur, nombre_campana: str, sucursal: str, puesto_codigo: str,
                            ventana_ini, ventana_fin) -> list[dict]:
    """Vista por campana: filtra por fecha_solicitud dentro de la ventana
    real de ESTA campana (interseccion con el filtro de fechas pedido), y
    el costo es solo el gasto de esta campana especifica -- no el de toda
    la sucursal+puesto como en _contrataciones, porque aqui ya se eligio
    una campana en particular."""
    resultado = []
    for f in _folios_validos(cur, sucursal, puesto_codigo):
        if f["fecha_solicitud"] is None or not (ventana_ini <= f["fecha_solicitud"] <= ventana_fin):
            continue
        costo = cur.execute("""
            SELECT SUM(fb.importe) FROM rh_campannas_facebook fb
            WHERE fb.nombre_campana = ? AND fb.dia BETWEEN ? AND ?
        """, nombre_campana, f["fecha_creacion_campanna"], f["fecha_ingreso"]).fetchval()
        resultado.append({**_serializar_contratacion(f), "costo_estimado": float(costo) if costo is not None else None})
    return resultado


# dia/semana/mes -> el mismo periodo que ya usan Meta y solicitantes,
# reutilizando el mismo criterio de "lunes de la semana" / "dia 1 del
# mes" -- para que una contratacion caiga en la misma barra que el resto
# del tablero, no en una fecha suelta aparte.
def _bucket(f, gran):
    if gran == "dia":
        return f
    if gran == "semana":
        return f - timedelta(days=f.weekday())
    return f.replace(day=1)


def _rango(predeterminado_desde: str | None = None):
    """desde/hasta de la query string, validados. Devuelve
    (desde, hasta, None) o (None, None, respuesta_de_error)."""
    desde = request.args.get("desde") or predeterminado_desde or "2026-05-01"
    hasta = request.args.get("hasta", date.today().isoformat())
    try:
        return (datetime.strptime(desde, "%Y-%m-%d").date(),
                datetime.strptime(hasta, "%Y-%m-%d").date(), None)
    except ValueError:
        return None, None, (jsonify(error="desde/hasta deben ser YYYY-MM-DD"), 400)


# --- Rutas -----------------------------------------------------------------

@app.get("/api/sucursales")
def sucursales():
    with bd.conexion() as cn:
        cur = cn.cursor()
        nombres = {_normalizar_sucursal(r[0]) for r in cur.execute(
            "SELECT DISTINCT sucursal FROM dim_campana_facebook"
        )}
        nombres |= {_normalizar_sucursal(r[0]) for r in cur.execute(
            f"WITH {SOLICITANTES_CTE} "
            "SELECT DISTINCT sucursal FROM correccion_sucursal"
        )}
    return jsonify(sorted(nombres))


@app.get("/api/ranking_sucursales")
def ranking_sucursales():
    """Mismo ranking que /api/ranking_campanas (costo por contratacion,
    tasa de contratacion, conversion impresion->solicitud) pero agregado
    por SUCURSAL en vez de por campana -- todas las campanas de esa
    sucursal dentro del rango, sumadas. Para el panel lateral de la vista
    'Por sucursal'."""
    desde_d, hasta_d, error = _rango()
    if error:
        return error

    filas = []
    with bd.conexion() as cn:
        cur = cn.cursor()
        lista_sucursales = sorted({_normalizar_sucursal(r[0]) for r in cur.execute(
            "SELECT DISTINCT sucursal FROM dim_campana_facebook"
        )})

        for suc in lista_sucursales:
            fb_totales = cur.execute("""
                SELECT SUM(f.impresiones) imp, SUM(f.importe) gasto
                FROM rh_campannas_facebook f
                JOIN dim_campana_facebook d ON d.nombre_campana = f.nombre_campana
                WHERE d.sucursal = ? AND f.dia BETWEEN ? AND ?
            """, suc, desde_d, hasta_d).fetchone()
            total_impresiones = fb_totales.imp or 0
            total_gasto = float(fb_totales.gasto) if fb_totales.gasto is not None else 0.0

            total_solicitantes = cur.execute(f"""
                WITH {SOLICITANTES_CTE}
                SELECT COUNT(*) FROM correccion_sucursal
                WHERE sucursal = ? AND date(fecha_realizado) BETWEEN ? AND ?
            """, suc, desde_d, hasta_d).fetchval()

            total_contrataciones = len(_contrataciones(cur, suc, desde_d, hasta_d))

            filas.append({
                "sucursal": suc,
                "costo_por_contratacion": total_gasto / total_contrataciones if total_contrataciones > 0 else None,
                "tasa_contratacion": (total_contrataciones / total_solicitantes * 100
                                      if total_solicitantes >= config.MINIMO_MUESTRA_RANKING else None),
                "tasa_conversion_impresiones": (total_solicitantes / total_impresiones * 100
                                                if total_impresiones > 0 and total_solicitantes >= config.MINIMO_MUESTRA_RANKING else None),
            })

    def _top5(clave, ascendente):
        con_dato = [f for f in filas if f[clave] is not None]
        con_dato.sort(key=lambda f: f[clave], reverse=not ascendente)
        return [{"sucursal": f["sucursal"], "valor": f[clave]} for f in con_dato[:5]]

    return jsonify(
        costo_por_contratacion=_top5("costo_por_contratacion", ascendente=True),
        tasa_contratacion=_top5("tasa_contratacion", ascendente=False),
        tasa_conversion_impresiones=_top5("tasa_conversion_impresiones", ascendente=False),
    )


@app.get("/api/metricas")
def metricas():
    sucursal = request.args.get("sucursal")
    granularidad = request.args.get("granularidad", "dia")
    if granularidad not in _PERIODOS:
        return jsonify(error="granularidad debe ser dia, semana o mes"), 400
    if not sucursal:
        return jsonify(error="falta el parametro sucursal"), 400

    desde_d, hasta_d, error = _rango()
    if error:
        return error

    periodo_fb = _periodo_sql("f.dia", granularidad)
    periodo_sol = _periodo_sql("cs.fecha_realizado", granularidad)
    # El alcance NO se suma entre dias (Meta lo deduplica solo dentro de UN
    # rango pedido como tal); en grano semana/mes solo se puede mostrar como
    # el maximo de un dia dentro del periodo -- una cota inferior honesta,
    # nunca la suma inflada.
    alcance_expr = "SUM(f.alcance)" if granularidad == "dia" else "MAX(f.alcance)"

    with bd.conexion() as cn:
        cur = cn.cursor()

        fb = {
            r.periodo: {
                "impresiones": r.impresiones,
                "clics_enlace": r.clics_enlace,
                "clics_todos": r.clics_todos,
                "gasto": float(r.gasto) if r.gasto is not None else None,
                "alcance": r.alcance,
                "resultados": r.resultados,
            }
            for r in cur.execute(f"""
                SELECT {periodo_fb} AS "periodo [DATE]",
                       SUM(f.impresiones)  AS impresiones,
                       SUM(f.clics_enlace) AS clics_enlace,
                       SUM(f.clics_todos)  AS clics_todos,
                       SUM(f.importe)      AS gasto,
                       SUM(f.resultados)   AS resultados,
                       {alcance_expr}      AS alcance
                FROM rh_campannas_facebook f
                JOIN dim_campana_facebook d ON d.nombre_campana = f.nombre_campana
                WHERE d.sucursal = ? AND f.dia BETWEEN ? AND ?
                GROUP BY {periodo_fb}
            """, sucursal, desde_d, hasta_d)
        }

        sol = {
            r.periodo: r.solicitantes
            for r in cur.execute(f"""
                WITH {SOLICITANTES_CTE}
                SELECT {periodo_sol} AS "periodo [DATE]", COUNT(*) AS solicitantes
                FROM correccion_sucursal cs
                WHERE cs.sucursal = ?
                  AND date(cs.fecha_realizado) BETWEEN ? AND ?
                GROUP BY {periodo_sol}
            """, sucursal, desde_d, hasta_d)
        }

        # Que campana(s) contribuyeron a cada periodo. Una sucursal puede
        # tener mas de una campana activa el mismo dia (los relevos de 2-5
        # dias que ya se detectaron en el diccionario), asi que es una
        # LISTA por periodo, nunca un solo nombre -- una etiqueta fija
        # mentiria justo en esos dias de traslape.
        campanas_por_periodo: dict = {}
        for r in cur.execute(f"""
            SELECT DISTINCT {periodo_fb} AS "periodo [DATE]", f.nombre_campana
            FROM rh_campannas_facebook f
            JOIN dim_campana_facebook d ON d.nombre_campana = f.nombre_campana
            WHERE d.sucursal = ? AND f.dia BETWEEN ? AND ?
        """, sucursal, desde_d, hasta_d):
            campanas_por_periodo.setdefault(r.periodo, []).append(r.nombre_campana)

        # Resumen estatico: todas las campanas de esta sucursal cuya ventana
        # de fechas toca el rango pedido, con sus fechas -- para mostrar
        # arriba de la grafica sin tener que pasar el mouse.
        campanas_rango = [
            {
                "nombre_campana": r.nombre_campana,
                "fecha_inicio": r.fecha_inicio.isoformat(),
                "fecha_fin": r.fecha_fin.isoformat() if r.fecha_fin else None,
            }
            for r in cur.execute("""
                SELECT nombre_campana, fecha_inicio, fecha_fin
                FROM dim_campana_facebook
                WHERE sucursal = ?
                  AND fecha_inicio <= ?
                  AND (fecha_fin IS NULL OR fecha_fin >= ?)
                ORDER BY fecha_inicio
            """, sucursal, hasta_d, desde_d)
        ]

        contrataciones = _contrataciones(cur, sucursal, desde_d, hasta_d)

    contrataciones_por_periodo: dict = {}
    # Mismos folios, agrupados por CUANDO APLICARON en vez de cuando
    # entraron -- para marcar en la barra de solicitantes cual dia trajo a
    # alguien que, mas adelante, si se contrato. Solo entra si se
    # encontro fecha_solicitud (puede faltar si la clave no aparece en
    # rh_solicitantes).
    solicitudes_contratadas_por_periodo: dict = {}
    for c in contrataciones:
        p_ingreso = _bucket(c["fecha_ingreso"], granularidad)
        contrataciones_por_periodo.setdefault(p_ingreso, []).append({
            **c,
            "fecha_ingreso": c["fecha_ingreso"].isoformat(),
            "fecha_solicitud": c["fecha_solicitud"].isoformat() if c["fecha_solicitud"] else None,
        })
        if c["fecha_solicitud"] is not None:
            p_solicitud = _bucket(c["fecha_solicitud"], granularidad)
            solicitudes_contratadas_por_periodo.setdefault(p_solicitud, []).append({
                **c,
                "fecha_ingreso": c["fecha_ingreso"].isoformat(),
                "fecha_solicitud": c["fecha_solicitud"].isoformat(),
            })

    periodos = sorted(
        set(fb) | set(sol) | set(contrataciones_por_periodo)
        | set(solicitudes_contratadas_por_periodo)
    )
    puntos = []
    for p in periodos:
        m = fb.get(p, {})
        puntos.append({
            "periodo": p.isoformat(),
            "impresiones": m.get("impresiones"),
            "clics_enlace": m.get("clics_enlace"),
            "clics_todos": m.get("clics_todos"),
            "gasto": m.get("gasto"),
            "resultados": m.get("resultados"),
            "alcance": m.get("alcance") if granularidad == "dia" else None,
            "solicitantes": sol.get(p, 0),
            "campanas": sorted(campanas_por_periodo.get(p, [])),
            "contrataciones": contrataciones_por_periodo.get(p, []),
            "solicitudes_contratadas": solicitudes_contratadas_por_periodo.get(p, []),
        })

    return jsonify(
        sucursal=sucursal, granularidad=granularidad, puntos=puntos,
        campanas_rango=campanas_rango,
    )


# --- Vista por campana -------------------------------------------------
# codigo corto (dim_campana_facebook.puesto) -> texto largo, para mostrar.
_PUESTO_CODIGO_A_TEXTO = dict(PUESTOS)


@app.get("/api/campanas")
def campanas():
    sucursal = request.args.get("sucursal")
    with bd.conexion() as cn:
        cur = cn.cursor()
        if sucursal and sucursal != "Todas":
            filas = cur.execute("""
                SELECT nombre_campana, sucursal, puesto, fecha_inicio, fecha_fin
                FROM dim_campana_facebook WHERE sucursal = ?
                ORDER BY fecha_inicio DESC
            """, sucursal).fetchall()
        else:
            filas = cur.execute("""
                SELECT nombre_campana, sucursal, puesto, fecha_inicio, fecha_fin
                FROM dim_campana_facebook
                ORDER BY fecha_inicio DESC
            """).fetchall()
    return jsonify([
        {
            "nombre_campana": r.nombre_campana,
            "sucursal": _normalizar_sucursal(r.sucursal),
            "puesto": _PUESTO_CODIGO_A_TEXTO.get(r.puesto, r.puesto),
            "fecha_inicio": r.fecha_inicio.isoformat(),
            "fecha_fin": r.fecha_fin.isoformat() if r.fecha_fin else None,
        }
        for r in filas
    ])


@app.get("/api/rango_campanas")
def rango_campanas():
    with bd.conexion() as cn:
        cur = cn.cursor()
        desde = cur.execute(
            'SELECT MIN(fecha_inicio) AS "desde [DATE]" FROM dim_campana_facebook'
        ).fetchval()
        hasta = cur.execute(
            'SELECT MAX(dia) AS "hasta [DATE]" FROM rh_campannas_facebook'
        ).fetchval()
    return jsonify(
        desde=desde.isoformat() if desde else None,
        hasta=hasta.isoformat() if hasta else None,
    )


# --- Vista de vacantes ---------------------------------------------------
# nombre_completo_baja normalmente es la persona cuya salida abrio la
# vacante, pero el sistema de folios tambien usa esa misma columna para
# dos estados que no son una persona: una plaza nueva ("Aumento de
# plantilla") o una baja de antes de que existiera este sistema ("Baja
# antes de sistema"). Se distinguen para que el frontend no los muestre
# como si fueran un nombre.
_RAZONES_BAJA_SIN_PERSONA = {
    "AUMENTO DE PLANTILLA": "Aumento de plantilla",
    "BAJA ANTES DE SISTEMA": "Baja registrada antes del sistema",
}


def _describir_baja(texto: str | None) -> dict | None:
    if not texto:
        return None
    especial = _RAZONES_BAJA_SIN_PERSONA.get(texto.upper())
    return {"texto": especial, "es_persona": False} if especial else {"texto": texto, "es_persona": True}


@app.get("/api/vacantes")
def vacantes():
    hoy = date.today()
    with bd.conexion() as cn:
        cur = cn.cursor()
        folios = _folios_todos(cur)

    filas = []
    for f in folios:
        if f["estatus"] == "activa":
            dias_abierta = (hoy - f["fecha_creacion_campanna"]).days
        elif f["estatus"] == "cubierta":
            dias_abierta = (f["fecha_ingreso"] - f["fecha_creacion_campanna"]).days
        else:
            # reasignacion: fecha_ingreso es cuando esa persona entro a la
            # EMPRESA, no cuando se lleno ESTE folio -- "dias abierta" no
            # describe nada real aqui.
            dias_abierta = None

        filas.append({
            "folio": f["folio"],
            "sucursal": f["sucursal"],
            "puesto": f["puesto"],
            "estatus": f["estatus"],
            "fecha_apertura": f["fecha_creacion_campanna"].isoformat(),
            "fecha_solicitud": f["fecha_solicitud"].isoformat() if f["fecha_solicitud"] else None,
            "fecha_ingreso": f["fecha_ingreso"].isoformat() if f["fecha_ingreso"] else None,
            "dias_abierta": dias_abierta,
            "nombre_alta": f["nombre"],
            "baja": _describir_baja(f["nombre_baja"]),
        })

    activas = [f for f in filas if f["estatus"] == "activa"]
    cubiertas = [f for f in filas if f["estatus"] == "cubierta"]
    mas_antigua = max(activas, key=lambda f: f["dias_abierta"], default=None)

    resumen = {
        "activas": len(activas),
        "cubiertas": len(cubiertas),
        "reasignaciones": len(filas) - len(activas) - len(cubiertas),
        "tiempo_cobertura_promedio": (
            sum(f["dias_abierta"] for f in cubiertas) / len(cubiertas) if cubiertas else None
        ),
        "vacante_mas_antigua": {
            "folio": mas_antigua["folio"], "sucursal": mas_antigua["sucursal"],
            "puesto": mas_antigua["puesto"], "dias": mas_antigua["dias_abierta"],
        } if mas_antigua else None,
    }

    # Activas primero (las que llevan mas tiempo abiertas, arriba, para
    # resaltar urgencia) -> reasignaciones -> cubiertas (ingreso mas
    # reciente primero).
    activas_ordenadas = sorted(activas, key=lambda f: f["dias_abierta"], reverse=True)
    reasignaciones_ordenadas = [f for f in filas if f["estatus"] == "reasignacion"]
    cubiertas_ordenadas = sorted(cubiertas, key=lambda f: f["fecha_ingreso"], reverse=True)
    filas = activas_ordenadas + reasignaciones_ordenadas + cubiertas_ordenadas

    return jsonify(filas=filas, resumen=resumen)


@app.get("/api/ranking_campanas")
def ranking_campanas():
    desde_d, hasta_d, error = _rango()
    if error:
        return error

    filas = []
    with bd.conexion() as cn:
        cur = cn.cursor()
        campanas_todas = cur.execute("""
            SELECT nombre_campana, sucursal, puesto, fecha_inicio, fecha_fin
            FROM dim_campana_facebook
        """).fetchall()

        for c in campanas_todas:
            sucursal_c = _normalizar_sucursal(c.sucursal)
            fecha_inicio_c = c.fecha_inicio
            fecha_fin_c = c.fecha_fin or date.today()
            ventana_ini = max(desde_d, fecha_inicio_c)
            ventana_fin = min(hasta_d, fecha_fin_c)
            if ventana_ini > ventana_fin:
                continue  # esta campana no toca el rango pedido

            fb_totales = cur.execute("""
                SELECT SUM(impresiones) imp, SUM(importe) gasto
                FROM rh_campannas_facebook
                WHERE nombre_campana = ? AND dia BETWEEN ? AND ?
            """, c.nombre_campana, desde_d, hasta_d).fetchone()
            total_impresiones = fb_totales.imp or 0
            total_gasto = float(fb_totales.gasto) if fb_totales.gasto is not None else 0.0

            # AND vacante = ? -- ver el mismo fix y su comentario en
            # metricas_campana: sin esto, dos campanas de la misma sucursal
            # con ventanas traslapadas suman los mismos solicitantes.
            total_solicitantes = cur.execute(f"""
                WITH {SOLICITANTES_CTE}
                SELECT COUNT(*) FROM correccion_sucursal
                WHERE sucursal = ? AND vacante = ? AND date(fecha_realizado) BETWEEN ? AND ?
            """, sucursal_c, _PUESTO_CODIGO_A_TEXTO.get(c.puesto, c.puesto), ventana_ini, ventana_fin).fetchval()

            contrataciones = _contrataciones_campana(
                cur, c.nombre_campana, sucursal_c, c.puesto, ventana_ini, ventana_fin
            )
            total_contrataciones = len(contrataciones)

            filas.append({
                "nombre_campana": c.nombre_campana,
                "sucursal": sucursal_c,
                "costo_por_contratacion": total_gasto / total_contrataciones if total_contrataciones > 0 else None,
                "tasa_contratacion": (total_contrataciones / total_solicitantes * 100
                                      if total_solicitantes >= config.MINIMO_MUESTRA_RANKING else None),
                "tasa_conversion_impresiones": (total_solicitantes / total_impresiones * 100
                                                if total_impresiones > 0 and total_solicitantes >= config.MINIMO_MUESTRA_RANKING else None),
            })

    def _top5(clave, ascendente):
        con_dato = [f for f in filas if f[clave] is not None]
        con_dato.sort(key=lambda f: f[clave], reverse=not ascendente)
        return [{"nombre_campana": f["nombre_campana"], "sucursal": f["sucursal"], "valor": f[clave]} for f in con_dato[:5]]

    return jsonify(
        costo_por_contratacion=_top5("costo_por_contratacion", ascendente=True),
        tasa_contratacion=_top5("tasa_contratacion", ascendente=False),
        tasa_conversion_impresiones=_top5("tasa_conversion_impresiones", ascendente=False),
    )


# --- Marco de decision por campana -----------------------------------------
# Automatiza las 6 acciones del documento "Marco de decision para campanas
# de reclutamiento": cada condicion (CPA bajo/alto, solicitantes altos,
# conversion baja, etc.) se resuelve comparando contra la MEDIANA del
# cohorte de campanas activas de hoy, no contra un dolar fijo -- para que
# el umbral se recalibre solo conforme cambien los datos, en vez de
# quedarse pegado a los cortes de un rango especifico.
_UMBRAL_DIAS_RECIENTE = 21  # 3 semanas
_UMBRAL_CONTRATACIONES_RECIENTE = 2
_UMBRAL_CAIDA_TENDENCIA = 0.25  # 25% de caida contra el pico de semanas previas
_MINIMO_SEMANAS_TENDENCIA = 4  # 3 previas + la mas reciente

_DECISIONES = {
    "pausar":            {"etiqueta": "Pausar", "color": "critico"},
    "refrescar":         {"etiqueta": "Refrescar o pausar", "color": "critico"},
    "optimizar_anuncio": {"etiqueta": "Optimizar el anuncio", "color": "alerta"},
    "revisar_proceso":   {"etiqueta": "Revisar el proceso", "color": "alerta"},
    "esperar":           {"etiqueta": "Esperar antes de juzgar", "color": "neutra"},
    "mantener":          {"etiqueta": "Mantener", "color": "neutra"},
    "invertir_mas":      {"etiqueta": "Invertir más", "color": "bien"},
}


def _tendencia_semanal_campana(cur, nombre_campana: str, sucursal: str, puesto_codigo: str, fecha_inicio, ventana_fin):
    """Solicitantes por cada 1,000 impresiones, por semana, desde que
    arranco la campana. No se limita al filtro de fechas pedido -- la
    tendencia necesita ver el arranque real de la campana, no un recorte
    que por casualidad empiece despues del pico."""
    periodo_fb = _periodo_sql("f.dia", "semana")
    fb_por_semana = {
        r.periodo: r.imp or 0
        for r in cur.execute(f"""
            SELECT {periodo_fb} AS "periodo [DATE]", SUM(f.impresiones) AS imp
            FROM rh_campannas_facebook f
            WHERE f.nombre_campana = ? AND f.dia BETWEEN ? AND ?
            GROUP BY {periodo_fb}
        """, nombre_campana, fecha_inicio, ventana_fin)
    }
    periodo_sol = _periodo_sql("cs.fecha_realizado", "semana")
    # AND cs.vacante = ? -- mismo fix que en metricas_campana: sin esto
    # cuenta solicitantes de CUALQUIER puesto de la sucursal, no solo el
    # de esta campana.
    vacante_campana = _PUESTO_CODIGO_A_TEXTO.get(puesto_codigo, puesto_codigo)
    sol_por_semana = {
        r.periodo: r.solicitantes
        for r in cur.execute(f"""
            WITH {SOLICITANTES_CTE}
            SELECT {periodo_sol} AS "periodo [DATE]", COUNT(*) AS solicitantes
            FROM correccion_sucursal cs
            WHERE cs.sucursal = ? AND cs.vacante = ? AND date(cs.fecha_realizado) BETWEEN ? AND ?
            GROUP BY {periodo_sol}
        """, sucursal, vacante_campana, fecha_inicio, ventana_fin)
    }
    # Semanas con muy pocas impresiones (huecos de sincronizacion de Meta,
    # o la campana recien encendida/apagada a mitad de semana) dan una
    # tasa por 1,000 impresiones que no significa nada -- una sola
    # solicitud sobre 224 impresiones se ve como "31 por 1,000", un pico
    # falso que ensucia la comparacion contra semanas reales. Se
    # descartan como si no hubiera dato esa semana, igual que imp=0.
    UMBRAL_MINIMO_IMPRESIONES_SEMANA = 1000
    semanas = sorted(fb_por_semana)
    return [
        (sol_por_semana.get(s, 0) / fb_por_semana[s] * 1000)
        if fb_por_semana[s] >= UMBRAL_MINIMO_IMPRESIONES_SEMANA else None
        for s in semanas
    ]


def _tendencia_bajando(tasas: list) -> tuple[bool, float | None]:
    tasas_validas = [t for t in tasas if t is not None]
    if len(tasas_validas) < _MINIMO_SEMANAS_TENDENCIA:
        return False, None
    *previas, ultima = tasas_validas
    pico = max(previas)
    if pico <= 0:
        return False, None
    caida = (pico - ultima) / pico
    return caida >= _UMBRAL_CAIDA_TENDENCIA, caida


def _decidir_campana(m: dict, medianas: dict) -> tuple[str, str]:
    """m: metricas de una campana. medianas: medianas del cohorte. Devuelve
    (clave_decision, motivo). El orden de los if importa -- es la
    prioridad de negocio, no una lista de reglas independientes: primero
    lo que anula todo lo demas (sin vacante -> pausar), despues lo que
    todavia no tiene muestra confiable, despues las senales de alerta
    tempranas, y al final las de "todo bien"."""
    if not m["tiene_vacante_activa"]:
        return "pausar", "No hay ninguna vacante activa para esta sucursal y puesto — no hay necesidad vigente que justifique seguir pagando."

    if m["dias_activa"] < _UMBRAL_DIAS_RECIENTE and m["contrataciones"] <= _UMBRAL_CONTRATACIONES_RECIENTE:
        return "esperar", f"Solo {m['dias_activa']} días activa y {m['contrataciones']} contratación(es) — todavía no hay muestra suficiente para juzgarla."

    if m["tendencia_bajando"]:
        return "refrescar", f"Solicitantes por 1,000 impresiones cayó {round(m['caida_tendencia']*100)}% desde su semana pico — señal de cansancio de audiencia."

    if m["conv_clic_solicitud"] is not None and medianas["conv_clic_solicitud"] is not None \
            and m["conv_clic_solicitud"] < medianas["conv_clic_solicitud"]:
        return "optimizar_anuncio", (
            f"Conversión clic→solicitud ({m['conv_clic_solicitud']:.1f}%) por debajo de la mediana del "
            f"cohorte ({medianas['conv_clic_solicitud']:.1f}%) — el problema esta arriba del embudo "
            "(creativo, landing, oferta), no en el presupuesto."
        )

    if m["solicitantes"] >= medianas["solicitantes"] and m["tasa_contratacion"] is not None \
            and medianas["tasa_contratacion"] is not None and m["tasa_contratacion"] < medianas["tasa_contratacion"]:
        return "revisar_proceso", (
            f"Solicitantes por encima de la mediana del cohorte pero tasa de contratación "
            f"({m['tasa_contratacion']:.2f}%) por debajo ({medianas['tasa_contratacion']:.2f}%) — la gente "
            "sí esta llegando, el cuello de botella parece estar en la revision/seleccion, no en el anuncio."
        )

    if m["cpa"] is not None and medianas["cpa"] is not None and m["cpa"] <= medianas["cpa"] \
            and m["solicitantes"] >= medianas["solicitantes"]:
        return "invertir_mas", (
            f"Costo por contratación (${m['cpa']:.0f}) por debajo de la mediana (${medianas['cpa']:.0f}) "
            "y buen volumen de solicitantes — el anuncio funciona y todavia hay demanda que cubrir."
        )

    return "mantener", "Ninguna señal fuerte en ninguna dirección con los umbrales actuales — mantener el presupuesto tal como esta."


def _mediana(valores: list) -> float | None:
    limpios = sorted(v for v in valores if v is not None)
    n = len(limpios)
    if n == 0:
        return None
    mitad = n // 2
    return limpios[mitad] if n % 2 else (limpios[mitad - 1] + limpios[mitad]) / 2


@app.get("/api/decision_campanas")
def decision_campanas():
    desde_d, hasta_d, error = _rango()
    if error:
        return error

    hoy = date.today()
    filas = []
    with bd.conexion() as cn:
        cur = cn.cursor()

        vacantes_activas = {
            (f["sucursal"], f["puesto_codigo"])
            for f in _folios_todos(cur) if f["estatus"] == "activa"
        }

        campanas_todas = cur.execute("""
            SELECT nombre_campana, sucursal, puesto, fecha_inicio, fecha_fin
            FROM dim_campana_facebook
        """).fetchall()

        for c in campanas_todas:
            if c.fecha_fin is not None and c.fecha_fin < hoy:
                continue  # ya termino -- no hay ninguna decision que tomar sobre ella hoy

            sucursal_c = _normalizar_sucursal(c.sucursal)
            fecha_fin_c = c.fecha_fin or hoy
            ventana_ini = max(desde_d, c.fecha_inicio)
            ventana_fin = min(hasta_d, fecha_fin_c)
            if ventana_ini > ventana_fin:
                continue  # esta campana no toca el rango pedido

            fb_totales = cur.execute("""
                SELECT SUM(impresiones) imp, SUM(clics_enlace) clics, SUM(importe) gasto
                FROM rh_campannas_facebook
                WHERE nombre_campana = ? AND dia BETWEEN ? AND ?
            """, c.nombre_campana, desde_d, hasta_d).fetchone()
            total_impresiones = fb_totales.imp or 0
            total_clics = fb_totales.clics or 0
            total_gasto = float(fb_totales.gasto) if fb_totales.gasto is not None else 0.0

            # AND vacante = ? -- mismo fix que en metricas_campana/ranking_campanas.
            total_solicitantes = cur.execute(f"""
                WITH {SOLICITANTES_CTE}
                SELECT COUNT(*) FROM correccion_sucursal
                WHERE sucursal = ? AND vacante = ? AND date(fecha_realizado) BETWEEN ? AND ?
            """, sucursal_c, _PUESTO_CODIGO_A_TEXTO.get(c.puesto, c.puesto), ventana_ini, ventana_fin).fetchval()

            total_contrataciones = len(_contrataciones_campana(
                cur, c.nombre_campana, sucursal_c, c.puesto, ventana_ini, ventana_fin
            ))

            tasas_semanales = _tendencia_semanal_campana(cur, c.nombre_campana, sucursal_c, c.puesto, c.fecha_inicio, ventana_fin)
            tendencia_bajando, caida = _tendencia_bajando(tasas_semanales)

            filas.append({
                "nombre_campana": c.nombre_campana,
                "sucursal": sucursal_c,
                "puesto": _PUESTO_CODIGO_A_TEXTO.get(c.puesto, c.puesto),
                "gasto": round(total_gasto, 2),
                "solicitantes": total_solicitantes,
                "contrataciones": total_contrataciones,
                "cpa": (total_gasto / total_contrataciones) if total_contrataciones > 0 else None,
                "conv_clic_solicitud": (total_solicitantes / total_clics * 100) if total_clics > 0 else None,
                "tasa_contratacion": (total_contrataciones / total_solicitantes * 100
                                      if total_solicitantes >= config.MINIMO_MUESTRA_RANKING else None),
                "dias_activa": (hoy - c.fecha_inicio).days,
                "tiene_vacante_activa": (sucursal_c, c.puesto) in vacantes_activas,
                "tendencia_bajando": tendencia_bajando,
                "caida_tendencia": caida,
            })

    medianas = {
        "cpa": _mediana([f["cpa"] for f in filas]),
        "conv_clic_solicitud": _mediana([f["conv_clic_solicitud"] for f in filas]),
        "solicitantes": _mediana([f["solicitantes"] for f in filas]),
        "tasa_contratacion": _mediana([f["tasa_contratacion"] for f in filas]),
    }

    for f in filas:
        clave, motivo = _decidir_campana(f, medianas)
        f["decision"] = clave
        f["decision_etiqueta"] = _DECISIONES[clave]["etiqueta"]
        f["decision_color"] = _DECISIONES[clave]["color"]
        f["motivo"] = motivo

    return jsonify(filas=filas, medianas=medianas, decisiones=_DECISIONES)


@app.get("/api/metricas_campana")
def metricas_campana():
    nombre_campana = request.args.get("campana")
    granularidad = request.args.get("granularidad", "dia")
    if granularidad not in _PERIODOS:
        return jsonify(error="granularidad debe ser dia, semana o mes"), 400
    if not nombre_campana:
        return jsonify(error="falta el parametro campana"), 400

    desde_d, hasta_d, error = _rango()
    if error:
        return error

    with bd.conexion() as cn:
        cur = cn.cursor()
        fila_campana = cur.execute("""
            SELECT nombre_campana, sucursal, puesto, fecha_inicio, fecha_fin
            FROM dim_campana_facebook WHERE nombre_campana = ?
        """, nombre_campana).fetchone()
        if fila_campana is None:
            return jsonify(error="campana no encontrada"), 404

        sucursal_campana = _normalizar_sucursal(fila_campana.sucursal)
        puesto_codigo = fila_campana.puesto
        fecha_inicio_campana = fila_campana.fecha_inicio
        fecha_fin_campana = fila_campana.fecha_fin or date.today()

        # Ventana real de atribucion: interseccion del filtro de fechas
        # pedido con la ventana real de ESTA campana. Sin esto, un filtro
        # amplio (el rango por omision de la pestana cubre TODAS las
        # campanas) contaria solicitantes de fechas en las que esta
        # campana en particular ni siquiera estaba corriendo.
        ventana_ini = max(desde_d, fecha_inicio_campana)
        ventana_fin = min(hasta_d, fecha_fin_campana)

        periodo_fb = _periodo_sql("f.dia", granularidad)
        periodo_sol = _periodo_sql("cs.fecha_realizado", granularidad)
        alcance_expr = "SUM(f.alcance)" if granularidad == "dia" else "MAX(f.alcance)"

        fb = {
            r.periodo: {
                "impresiones": r.impresiones,
                "clics_enlace": r.clics_enlace,
                "clics_todos": r.clics_todos,
                "gasto": float(r.gasto) if r.gasto is not None else None,
                "resultados": r.resultados,
                "alcance": r.alcance,
            }
            for r in cur.execute(f"""
                SELECT {periodo_fb} AS "periodo [DATE]",
                       SUM(f.impresiones)  AS impresiones,
                       SUM(f.clics_enlace) AS clics_enlace,
                       SUM(f.clics_todos)  AS clics_todos,
                       SUM(f.importe)      AS gasto,
                       SUM(f.resultados)   AS resultados,
                       {alcance_expr}      AS alcance
                FROM rh_campannas_facebook f
                WHERE f.nombre_campana = ? AND f.dia BETWEEN ? AND ?
                GROUP BY {periodo_fb}
            """, nombre_campana, desde_d, hasta_d)
        }

        sol = {}
        if ventana_ini <= ventana_fin:
            # cs.vacante = ? -- sin esto, dos campanas de la MISMA sucursal
            # con ventanas que se traslapan (p.ej. una de soldador y
            # otra de refrigeracion en la misma plaza, ambas hoy) sumaban
            # exactamente los mismos solicitantes: el filtro solo miraba
            # sucursal, nunca puesto. _contrataciones_campana (abajo) ya
            # filtraba por puesto_codigo; a esta consulta le faltaba el
            # mismo filtro.
            vacante_campana = _PUESTO_CODIGO_A_TEXTO.get(puesto_codigo, puesto_codigo)
            sol = {
                r.periodo: r.solicitantes
                for r in cur.execute(f"""
                    WITH {SOLICITANTES_CTE}
                    SELECT {periodo_sol} AS "periodo [DATE]", COUNT(*) AS solicitantes
                    FROM correccion_sucursal cs
                    WHERE cs.sucursal = ?
                      AND cs.vacante = ?
                      AND date(cs.fecha_realizado) BETWEEN ? AND ?
                    GROUP BY {periodo_sol}
                """, sucursal_campana, vacante_campana, ventana_ini, ventana_fin)
            }

        contrataciones = []
        if ventana_ini <= ventana_fin:
            contrataciones = _contrataciones_campana(
                cur, nombre_campana, sucursal_campana, puesto_codigo, ventana_ini, ventana_fin
            )

    contrataciones_por_periodo: dict = {}
    solicitudes_contratadas_por_periodo: dict = {}
    for c in contrataciones:
        p_ingreso = _bucket(c["fecha_ingreso"], granularidad)
        contrataciones_por_periodo.setdefault(p_ingreso, []).append({
            **c,
            "fecha_ingreso": c["fecha_ingreso"].isoformat(),
            "fecha_solicitud": c["fecha_solicitud"].isoformat() if c["fecha_solicitud"] else None,
        })
        if c["fecha_solicitud"] is not None:
            p_solicitud = _bucket(c["fecha_solicitud"], granularidad)
            solicitudes_contratadas_por_periodo.setdefault(p_solicitud, []).append({
                **c,
                "fecha_ingreso": c["fecha_ingreso"].isoformat(),
                "fecha_solicitud": c["fecha_solicitud"].isoformat(),
            })

    periodos = sorted(
        set(fb) | set(sol) | set(contrataciones_por_periodo)
        | set(solicitudes_contratadas_por_periodo)
    )
    puntos = []
    for p in periodos:
        m = fb.get(p, {})
        puntos.append({
            "periodo": p.isoformat(),
            "impresiones": m.get("impresiones"),
            "clics_enlace": m.get("clics_enlace"),
            "clics_todos": m.get("clics_todos"),
            "gasto": m.get("gasto"),
            "resultados": m.get("resultados"),
            "alcance": m.get("alcance") if granularidad == "dia" else None,
            "solicitantes": sol.get(p, 0),
            "contrataciones": contrataciones_por_periodo.get(p, []),
            "solicitudes_contratadas": solicitudes_contratadas_por_periodo.get(p, []),
        })

    return jsonify(
        granularidad=granularidad,
        puntos=puntos,
        campana={
            "nombre_campana": nombre_campana,
            "sucursal": sucursal_campana,
            "puesto": _PUESTO_CODIGO_A_TEXTO.get(puesto_codigo, puesto_codigo),
            "fecha_inicio": fecha_inicio_campana.isoformat(),
            "fecha_fin": fila_campana.fecha_fin.isoformat() if fila_campana.fecha_fin else None,
        },
    )


# --- Resumen general -------------------------------------------------------
# La pestana de entrada: una sola lectura de "como va esto" sin elegir
# sucursal ni campana. Todo el tablero son cuatro numeros encadenados --
#
#     usuarios alcanzados -> impresiones -> resultados -> solicitudes
#
# -- los tres primeros los reporta Meta, el ultimo es de la empresa y es
# el unico que de verdad importa: una solicitud es el resultado que estas
# campanas existen para producir. Un anuncio puede ganar en los tres
# primeros y seguir siendo un fracaso si el cuarto no se mueve, y es
# exactamente el error que esta pestana esta hecha para no dejar pasar.
#
# "Que tan bueno" no se puede contestar contra un numero absoluto (no
# existe un "bueno" universal para impresiones de reclutamiento), asi que
# se contesta contra el PERIODO ANTERIOR de la misma longitud: mismo
# motor, mismas sucursales, misma estacionalidad aproximada. Lo que se
# juzga es la direccion, no la magnitud.

# Un cambio por debajo de esto es ruido: con 30 dias y este volumen, dos
# periodos consecutivos nunca salen identicos ni haciendo lo mismo.
_UMBRAL_CAMBIO = 10.0        # %
_UMBRAL_EFICIENCIA = 15.0    # % de caida en solicitudes por mil impresiones
_UMBRAL_FRECUENCIA = 1.8     # impresiones por persona alcanzada

_VEREDICTOS = {
    "bueno":    {"etiqueta": "Bueno", "color": "bien"},
    "volumen":  {"etiqueta": "Más volumen, no mejor desempeño", "color": "alerta"},
    "estable":  {"etiqueta": "Estable", "color": "neutra"},
    "debil":    {"etiqueta": "Débil", "color": "critico"},
    "sin_base": {"etiqueta": "Sin periodo anterior comparable", "color": "neutra"},
}


def _caso_puesto_codigo(col: str) -> str:
    """CASE que traduce la vacante ya homologada al codigo corto de
    puesto que usa el diccionario de campanas. Es el reverso de
    PUESTOS, generado desde el mismo diccionario para que no se puedan
    desincronizar."""
    lineas = [f"WHEN {col} = '{texto}' THEN '{codigo}'" for codigo, texto in PUESTOS.items()]
    return "CASE " + " ".join(lineas) + " END"


def _agregados_meta(cur, desde_d, hasta_d, granularidad):
    """Serie por periodo de las metricas de Meta, solo de campanas que si
    estan en el diccionario (las demas no se pueden atribuir a ninguna
    sucursal ni puesto, ver /api/resumen)."""
    periodo = _periodo_sql("f.dia", granularidad)
    dia = _periodo_sql("f.dia", "dia")
    # El alcance se agrega en dos pasos a proposito: primero por DIA
    # (donde sumar los conjuntos de anuncios es lo que ya hace el resto
    # del tablero), y de ahi al periodo pedido. Asi el maximo diario
    # sigue siendo calculable aunque se este viendo por semana -- y ese
    # maximo es la unica cota inferior honesta de usuarios unicos.
    return cur.execute(f"""
        WITH por_dia AS (
            SELECT {dia} AS dia,
                   {periodo} AS periodo,
                   SUM(f.impresiones)  AS impresiones,
                   SUM(f.alcance)      AS alcance,
                   SUM(f.resultados)   AS resultados,
                   SUM(f.clics_enlace) AS clics_enlace,
                   SUM(f.clics_todos)  AS clics_todos,
                   SUM(f.importe)      AS importe
            FROM rh_campannas_facebook f
            JOIN dim_campana_facebook d ON d.nombre_campana = f.nombre_campana
            WHERE f.dia BETWEEN ? AND ?
            GROUP BY {dia}, {periodo}
        )
        SELECT periodo AS "periodo [DATE]",
               SUM(impresiones)  AS impresiones,
               SUM(alcance)      AS alcance,
               MAX(alcance)      AS alcance_max_dia,
               SUM(resultados)   AS resultados,
               SUM(clics_enlace) AS clics_enlace,
               SUM(clics_todos)  AS clics_todos,
               SUM(importe)      AS gasto
        FROM por_dia
        GROUP BY periodo
        ORDER BY periodo
    """, desde_d, hasta_d).fetchall()


def _solicitudes_por_periodo(cur, desde_d, hasta_d, granularidad):
    """Solicitudes del periodo, en dos conteos que NO son lo mismo:

    * `total`: todas las que llegaron. Es el resultado de la empresa.
    * `atribuibles`: las que cayeron en una sucursal y puesto que ESE DIA
      tenia una campana corriendo. Es la parte que Meta puede reclamar.

    La diferencia entre las dos es la linea base organica (referidos, la
    vacante pegada en la sucursal, gente que llega sola). Reportar solo
    el total le regalaria a la publicidad un merito que no es suyo;
    reportar solo lo atribuible esconderia solicitudes que la empresa de
    verdad recibio."""
    periodo = _periodo_sql("cs.fecha_realizado", granularidad)
    return cur.execute(f"""
        WITH {SOLICITANTES_CTE}
        SELECT {periodo} AS "periodo [DATE]",
               COUNT(*) AS total,
               SUM(CASE WHEN EXISTS (
                   SELECT 1 FROM dim_campana_facebook d
                   WHERE d.sucursal = cs.sucursal
                     AND d.puesto = {_caso_puesto_codigo('cs.vacante')}
                     AND d.fecha_inicio <= date(cs.fecha_realizado)
                     AND (d.fecha_fin IS NULL OR d.fecha_fin >= date(cs.fecha_realizado))
               ) THEN 1 ELSE 0 END) AS atribuibles
        FROM correccion_sucursal cs
        WHERE date(cs.fecha_realizado) BETWEEN ? AND ?
        GROUP BY {periodo}
        ORDER BY {periodo}
    """, desde_d, hasta_d).fetchall()


def _totales_periodo(cur, desde_d, hasta_d, granularidad="dia"):
    """Los numeros del periodo, ya sumados, mas la serie que los compone."""
    meta = _agregados_meta(cur, desde_d, hasta_d, granularidad)
    solicitudes = {r.periodo: r for r in _solicitudes_por_periodo(cur, desde_d, hasta_d, granularidad)}

    totales = {
        "impresiones": sum(r.impresiones or 0 for r in meta),
        # Suma del alcance diario: cota SUPERIOR de usuarios distintos.
        # Meta deduplica el alcance solo dentro del rango que se le pide
        # como tal, asi que entre dias hay personas contadas dos veces.
        "alcance": sum(r.alcance or 0 for r in meta),
        "alcance_max_dia": max((r.alcance_max_dia or 0 for r in meta), default=0),
        "resultados": sum(r.resultados or 0 for r in meta),
        "clics_enlace": sum(r.clics_enlace or 0 for r in meta),
        "gasto": float(sum(r.gasto or 0 for r in meta)),
        "solicitudes": sum(r.total for r in solicitudes.values()),
        "solicitudes_atribuibles": sum(r.atribuibles or 0 for r in solicitudes.values()),
        "dias_con_dato": len(meta),
    }

    periodos = sorted(set(solicitudes) | {r.periodo for r in meta})
    por_periodo = {r.periodo: r for r in meta}
    serie = []
    for p in periodos:
        m = por_periodo.get(p)
        s = solicitudes.get(p)
        serie.append({
            "periodo": p.isoformat(),
            "impresiones": m.impresiones if m else None,
            "alcance": m.alcance if m else None,
            "resultados": m.resultados if m else None,
            "clics_enlace": m.clics_enlace if m else None,
            "clics_todos": m.clics_todos if m else None,
            "gasto": float(m.gasto) if m and m.gasto is not None else None,
            "solicitantes": s.total if s else 0,
            "solicitudes_atribuibles": (s.atribuibles or 0) if s else 0,
        })
    return totales, serie


def _tasas(t: dict) -> dict:
    """Todos los cocientes se derivan aqui, nunca se guardan -- misma
    regla que ya rige el resto del proyecto. Cada uno devuelve None en
    vez de 0 cuando no hay denominador: un hueco no es un cero."""
    imp = t["impresiones"]
    return {
        "frecuencia": imp / t["alcance"] if t["alcance"] else None,
        "resultados_por_mil": t["resultados"] / imp * 1000 if imp else None,
        "solicitudes_por_mil": t["solicitudes_atribuibles"] / imp * 1000 if imp else None,
        "conv_resultado_solicitud": (t["solicitudes_atribuibles"] / t["resultados"] * 100
                                     if t["resultados"] else None),
        "costo_por_solicitud": (t["gasto"] / t["solicitudes_atribuibles"]
                                if t["solicitudes_atribuibles"] else None),
        "cpm": t["gasto"] / imp * 1000 if imp else None,
    }


def _cambio(nuevo, anterior):
    """Cambio porcentual, o None si no hay con que comparar. Un periodo
    anterior en cero no da 'infinito por ciento': da None, porque
    'crecio' no describe nada cuando antes no habia nada."""
    if nuevo is None or anterior is None or anterior == 0:
        return None
    return (nuevo - anterior) / anterior * 100


def _senal(clave, etiqueta, cambio, texto, mejor_es_subir=True, umbral=_UMBRAL_CAMBIO):
    if cambio is None:
        color = "neutra"
    elif abs(cambio) < umbral:
        color = "neutra"
    elif (cambio > 0) == mejor_es_subir:
        color = "bien"
    else:
        color = "alerta"
    return {"clave": clave, "etiqueta": etiqueta, "cambio": cambio, "color": color, "texto": texto}


def _pct(v, decimales=0):
    if v is None:
        return "—"
    return f"{v:+.{decimales}f}%"


def _evaluar(actual, anterior, tasas, tasas_ant, vacantes):
    """Las senales del periodo y el veredicto que sale de ellas.

    El veredicto se decide con DOS senales, no con un promedio de todas:
    el volumen de solicitudes (lo que la empresa necesita) y la
    eficiencia por impresion (si ese volumen vino de trabajar mejor o
    nada mas de pagar mas). Las demas senales se muestran porque
    explican, pero no votan -- un promedio de seis indicadores siempre
    sale "regular" y no sirve para decidir nada."""
    cambio_solicitudes = _cambio(actual["solicitudes_atribuibles"], anterior["solicitudes_atribuibles"])
    cambio_eficiencia = _cambio(tasas["solicitudes_por_mil"], tasas_ant["solicitudes_por_mil"])

    senales = [
        _senal("solicitudes", "Solicitudes atribuibles a campaña", cambio_solicitudes,
               f"{actual['solicitudes_atribuibles']:,} contra {anterior['solicitudes_atribuibles']:,} "
               "del periodo anterior de la misma longitud."),
        _senal("eficiencia", "Solicitudes por cada 1,000 impresiones", cambio_eficiencia,
               "Cuántas solicitudes deja cada mil impresiones compradas. Si sube el volumen "
               "pero esta baja, el crecimiento se compró, no se ganó.",
               umbral=_UMBRAL_EFICIENCIA),
        _senal("costo", "Costo por solicitud",
               _cambio(tasas["costo_por_solicitud"], tasas_ant["costo_por_solicitud"]),
               "Gasto del periodo ÷ solicitudes atribuibles.", mejor_es_subir=False),
        _senal("conversion", "Conversión resultado→solicitud",
               _cambio(tasas["conv_resultado_solicitud"], tasas_ant["conv_resultado_solicitud"]),
               "De cada resultado que reporta Meta (conversación iniciada o clic al enlace), "
               "qué parte terminó en una solicitud llenada."),
        _senal("alcance", "Usuarios alcanzados",
               _cambio(actual["alcance"], anterior["alcance"]),
               "Suma del alcance diario: cota superior, Meta solo deduplica dentro de un "
               "rango pedido como tal."),
    ]

    # Frecuencia: no es contra el periodo anterior sino contra un umbral
    # absoluto, porque aqui si existe un "demasiado" que no depende de la
    # historia -- arriba de ~1.8 impresiones por persona la campana le
    # esta repitiendo el mismo anuncio a la misma gente.
    if tasas["frecuencia"] is not None:
        cansada = tasas["frecuencia"] >= _UMBRAL_FRECUENCIA
        senales.append({
            "clave": "frecuencia",
            "etiqueta": "Frecuencia",
            "cambio": _cambio(tasas["frecuencia"], tasas_ant["frecuencia"]),
            "color": "alerta" if cansada else "neutra",
            "texto": (f"{tasas['frecuencia']:.2f} impresiones por persona alcanzada. "
                      + ("Arriba de 1.8: la audiencia ya está viendo el mismo anuncio de más."
                         if cansada else "Dentro de lo razonable.")),
        })

    senales.append({
        "clave": "cobertura",
        "etiqueta": "Vacantes cubiertas en el periodo",
        "cambio": None,
        "color": "bien" if vacantes["cubiertas"] > 0 else "neutra",
        "texto": (f"{vacantes['cubiertas']} de {vacantes['abiertas_al_cierre']} vacantes del tablero "
                  f"se cubrieron con una contratación nueva dentro del periodo; "
                  f"quedan {vacantes['activas']} abiertas."),
    })

    if cambio_solicitudes is None or cambio_eficiencia is None:
        clave = "sin_base"
        resumen = ("No hay un periodo anterior de la misma longitud con datos suficientes, "
                   "así que no se puede decir si esto es mejor o peor que antes. "
                   "Los números de abajo son del periodo seleccionado, sin comparación.")
    elif cambio_solicitudes <= -_UMBRAL_CAMBIO or cambio_eficiencia <= -_UMBRAL_EFICIENCIA * 2:
        clave = "debil"
        resumen = (f"Las solicitudes atribuibles a campaña cambiaron {_pct(cambio_solicitudes)} y la "
                   f"eficiencia por impresión {_pct(cambio_eficiencia)} contra el periodo anterior. "
                   "Se está pagando por menos resultado del que se pagaba antes.")
    elif cambio_solicitudes >= _UMBRAL_CAMBIO and cambio_eficiencia > -_UMBRAL_EFICIENCIA:
        clave = "bueno"
        resumen = (f"Las solicitudes atribuibles subieron {_pct(cambio_solicitudes)} y la eficiencia por "
                   f"impresión aguantó ({_pct(cambio_eficiencia)}): el crecimiento no salió solo de "
                   "comprar más impresiones.")
    elif cambio_solicitudes >= _UMBRAL_CAMBIO:
        clave = "volumen"
        resumen = (f"Las solicitudes atribuibles subieron {_pct(cambio_solicitudes)}, pero la eficiencia "
                   f"por impresión cayó {_pct(cambio_eficiencia)}: el crecimiento viene de comprar más "
                   "impresiones, no de que los anuncios estén funcionando mejor.")
    else:
        clave = "estable"
        resumen = (f"Solicitudes {_pct(cambio_solicitudes)} y eficiencia por impresión "
                   f"{_pct(cambio_eficiencia)} contra el periodo anterior: con este volumen, "
                   "ninguno de los dos cambios sale del ruido normal entre dos periodos.")

    veredicto = {"clave": clave, **_VEREDICTOS[clave], "resumen": resumen}
    return senales, veredicto


@app.get("/api/resumen")
def resumen():
    """Vista de entrada: el embudo completo del periodo, contra el periodo
    anterior de la misma longitud."""
    hoy = date.today()
    desde_d, hasta_d, error = _rango(
        (hoy - timedelta(days=config.DIAS_RESUMEN_POR_OMISION - 1)).isoformat()
    )
    if error:
        return error
    if desde_d > hasta_d:
        return jsonify(error="desde no puede ser posterior a hasta"), 400

    dias = (hasta_d - desde_d).days + 1
    # Periodo anterior: inmediatamente antes y de la MISMA longitud, para
    # que la comparacion no mezcle 30 dias contra 45.
    hasta_ant = desde_d - timedelta(days=1)
    desde_ant = hasta_ant - timedelta(days=dias - 1)

    # Por dia hasta ~10 semanas; de ahi en adelante la grafica se vuelve
    # ilegible y se agrupa por semana sola.
    granularidad = request.args.get("granularidad") or ("dia" if dias <= 70 else "semana")
    if granularidad not in _PERIODOS:
        return jsonify(error="granularidad debe ser dia, semana o mes"), 400

    with bd.conexion() as cn:
        cur = cn.cursor()
        actual, serie = _totales_periodo(cur, desde_d, hasta_d, granularidad)
        anterior, _ = _totales_periodo(cur, desde_ant, hasta_ant, granularidad)

        folios = _folios_todos(cur)
        cubiertas_periodo = [
            f for f in folios
            if f["estatus"] == "cubierta" and desde_d <= f["fecha_ingreso"] <= hasta_d
        ]
        vacantes = {
            "cubiertas": len(cubiertas_periodo),
            "activas": sum(1 for f in folios if f["estatus"] == "activa"),
            # Vacantes que estuvieron abiertas en algun momento del
            # periodo: las que se cubrieron dentro + las que siguen
            # abiertas y se habian abierto antes del cierre del periodo.
            "abiertas_al_cierre": len(cubiertas_periodo) + sum(
                1 for f in folios
                if f["estatus"] == "activa" and f["fecha_creacion_campanna"] <= hasta_d
            ),
            "dias_cobertura_promedio": (
                sum((f["fecha_ingreso"] - f["fecha_creacion_campanna"]).days for f in cubiertas_periodo)
                / len(cubiertas_periodo) if cubiertas_periodo else None
            ),
        }

        campanas_activas = cur.execute("""
            SELECT COUNT(DISTINCT d.nombre_campana)
            FROM dim_campana_facebook d
            WHERE d.fecha_inicio <= ? AND (d.fecha_fin IS NULL OR d.fecha_fin >= ?)
        """, hasta_d, desde_d).fetchval()

        # Campanas que corrieron en Meta pero no estan en el diccionario:
        # no tienen sucursal ni puesto, asi que no se pueden atribuir y
        # quedan FUERA de todos los numeros de arriba. Se reportan
        # aparte, con su gasto, en vez de callarlas -- es dinero que si
        # se gasto y que el tablero no puede explicar.
        sin_dicc = cur.execute("""
            SELECT COUNT(DISTINCT f.nombre_campana) AS campanas,
                   SUM(f.impresiones) AS impresiones,
                   SUM(f.importe) AS gasto
            FROM rh_campannas_facebook f
            LEFT JOIN dim_campana_facebook d ON d.nombre_campana = f.nombre_campana
            WHERE d.nombre_campana IS NULL AND f.dia BETWEEN ? AND ?
        """, desde_d, hasta_d).fetchone()

    tasas_actual = _tasas(actual)
    tasas_anterior = _tasas(anterior)
    senales, veredicto = _evaluar(actual, anterior, tasas_actual, tasas_anterior, vacantes)

    # El embudo en el orden en que de verdad pasa, cada etapa con el
    # cociente que la liga con la anterior. Las tres primeras son de
    # Meta; la cuarta es de la empresa y es la unica que paga la nomina.
    #
    # Las cuatro etapas NO estan en las mismas unidades (personas, vistas,
    # acciones, solicitudes) y la segunda es mas grande que la primera a
    # proposito -- un anuncio se le muestra varias veces a la misma
    # persona. Por eso el frontend dibuja la cadena con el cociente entre
    # etapas, no barras proporcionales: unas barras de 766,530 contra
    # 1,195 harian invisible justo la etapa que importa.
    embudo = [
        {"etapa": "Usuarios alcanzados", "valor": actual["alcance"], "fuente": "Meta",
         "conversion": None, "unidad": None,
         "conversion_etiqueta": None, "conversion_corta": None,
         "nota": "Suma del alcance diario: cota superior de personas distintas, "
                 "porque Meta solo deduplica dentro de un rango pedido como tal."},
        {"etapa": "Impresiones", "valor": actual["impresiones"], "fuente": "Meta",
         "conversion": tasas_actual["frecuencia"], "unidad": "razon",
         "conversion_etiqueta": "impresiones por persona alcanzada",
         "conversion_corta": "por persona",
         "nota": "Veces que se mostró el anuncio. Siempre más que el alcance: "
                 "a la misma persona se le muestra varias veces."},
        {"etapa": "Resultados", "valor": actual["resultados"], "fuente": "Meta",
         "conversion": (actual["resultados"] / actual["impresiones"] * 100) if actual["impresiones"] else None,
         "unidad": "porcentaje", "conversion_etiqueta": "de las impresiones dejó un resultado",
         "conversion_corta": "de las impresiones",
         "nota": "Conversaciones iniciadas o clics al enlace, según el objetivo de cada "
                 "campaña: no todas miden lo mismo."},
        {"etapa": "Solicitudes", "valor": actual["solicitudes_atribuibles"], "fuente": "Empresa",
         "conversion": tasas_actual["conv_resultado_solicitud"],
         "unidad": "porcentaje", "conversion_etiqueta": "de los resultados llegó a una solicitud",
         "conversion_corta": "de los resultados",
         "nota": "Solicitudes llenadas en una sucursal y puesto que ese día tenía campaña "
                 "corriendo. Es el resultado que estas campañas existen para producir."},
    ]

    return jsonify(
        desde=desde_d.isoformat(), hasta=hasta_d.isoformat(), dias=dias,
        granularidad=granularidad,
        comparacion={"desde": desde_ant.isoformat(), "hasta": hasta_ant.isoformat()},
        totales=actual, anterior=anterior,
        tasas=tasas_actual, tasas_anterior=tasas_anterior,
        embudo=embudo, senales=senales, veredicto=veredicto,
        vacantes=vacantes, campanas_activas=campanas_activas,
        sin_diccionario={
            "campanas": sin_dicc.campanas or 0,
            "impresiones": sin_dicc.impresiones or 0,
            "gasto": float(sin_dicc.gasto) if sin_dicc.gasto is not None else 0.0,
        },
        puntos=serie,
    )


# --- Frontend compilado ------------------------------------------------

@app.get("/")
@app.get("/<path:ruta>")
def frontend(ruta="index.html"):
    return send_from_directory(app.static_folder, ruta)


if __name__ == "__main__":
    # host="127.0.0.1": a diferencia de la version interna (que escucha en
    # toda la red local para que otras maquinas de la oficina entren por
    # IP), esta version es para correr en la computadora de quien la
    # revisa. Sin datos reales dentro no hay nada que exponer, pero
    # tampoco hay razon para abrir un puerto a la red.
    app.run(host="127.0.0.1", port=8000, debug=True)
