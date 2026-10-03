"""Configuracion de la version de demostracion.

No hay credenciales que leer: esta version no se conecta a nada. La base
de datos es un archivo SQLite dentro del propio proyecto, de solo
lectura, con datos generados (ver datos/generar_datos_demo.py).

En la version interna este archivo lee .env y arma las cadenas de
conexion a MySQL (donde caen las solicitudes) y a SQL Server (el almacen
donde se materializan las metricas de Meta). Nada de eso viaja aqui.
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

RUTA_BD = RAIZ / "datos" / "demo.sqlite"

# --- Reglas de negocio ---------------------------------------------------
# Umbral para distinguir "el folio se registro unos dias tarde" (rezago
# administrativo normal) de "a este puesto lo lleno alguien que ya
# trabajaba aqui desde antes" (reasignacion, no contratacion nueva).
UMBRAL_REASIGNACION_DIAS = 30

# Bajo esta muestra un porcentaje es ruido, no una senal: una campana con
# 1 solicitante y 1 contratacion "gana" cualquier ranking de tasa con
# 100% y tapa a las campanas con volumen real.
MINIMO_MUESTRA_RANKING = 3

# Dias del rango por omision de la pestana Resumen.
DIAS_RESUMEN_POR_OMISION = 30
