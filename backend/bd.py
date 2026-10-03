"""Acceso a la base SQLite de la demo: unica puerta a los datos.

Expone la MISMA forma que el modulo de SQL Server de la version interna
(`conexion()` como context manager, cursores que se pueden encadenar,
filas con acceso por atributo, `fetchval()`), para que app.py sea el
mismo archivo salvo el dialecto de SQL. Sin esta capa, portar el tablero
a SQLite habria significado reescribir las 20 consultas dos veces.

Tres decisiones que valen un comentario:

1. **Solo lectura.** Se abre con `mode=ro`: el tablero nunca escribe.
   Un error de programacion no puede corromper el archivo que se
   comparte, y correr dos instancias a la vez no tiene consecuencias.

2. **Fechas tipadas.** SQLite no tiene tipo fecha: guarda texto. Con
   `detect_types` las columnas declaradas DATE regresan como
   `datetime.date` de Python, no como cadenas -- el tablero hace
   aritmetica de fechas (dias que llevo abierto un folio, en que semana
   cae una contratacion) y hacerla sobre texto es como se cuelan los
   errores de un dia. Para las columnas calculadas, que no traen tipo
   declarado, se marca el tipo en el alias: `AS "periodo [DATE]"`.

3. **Comparacion insensible a mayusculas.** La base interna usa una
   colacion CI (Modern_Spanish_CI_AS), donde 'ALTAMIRA' = 'Altamira' es
   verdadero. SQLite compara texto byte por byte, asi que las columnas
   que se cruzan entre fuentes (nombre de campana, sucursal) se
   declararon COLLATE NOCASE en el esquema para conservar ese
   comportamiento. Sin eso, el join del diccionario contra el export de
   Meta se caeria en silencio con cualquier diferencia de capitalizacion.
"""
import sqlite3
from contextlib import contextmanager
from datetime import date

from . import config

sqlite3.register_adapter(date, lambda d: d.isoformat())
sqlite3.register_converter("DATE", lambda b: date.fromisoformat(b.decode()))


class Fila(tuple):
    """Fila con acceso por atributo (r.impresiones) y por indice (r[0]).

    Es lo que ya devolvia el driver de SQL Server, y lo que esperan las
    consultas de app.py.

    Sin __slots__ a proposito: una subclase de tuple no admite __slots__
    no vacio (la tupla ya tiene tamano variable), asi que `_columnas`
    vive en el diccionario de instancia."""

    def __new__(cls, columnas, valores):
        fila = super().__new__(cls, valores)
        fila._columnas = columnas
        return fila

    def __getattr__(self, nombre):
        try:
            return self[self._columnas.index(nombre)]
        except ValueError:
            raise AttributeError(
                f"la consulta no devolvio ninguna columna '{nombre}' "
                f"(devolvio: {', '.join(self._columnas)})"
            ) from None


class Cursor:
    """Cursor encadenable: `cur.execute(sql, a, b).fetchall()`.

    Los parametros van sueltos, no en una tupla, igual que en el driver
    de SQL Server -- asi las consultas de app.py no cambian.
    """

    def __init__(self, cursor: sqlite3.Cursor):
        self._cursor = cursor
        self._columnas: list[str] = []

    def execute(self, sql: str, *parametros):
        self._cursor.execute(sql, parametros)
        self._columnas = [d[0] for d in self._cursor.description or ()]
        return self

    def _envolver(self, valores):
        return Fila(self._columnas, valores)

    def fetchall(self) -> list[Fila]:
        return [self._envolver(v) for v in self._cursor.fetchall()]

    def fetchone(self) -> Fila | None:
        valores = self._cursor.fetchone()
        return self._envolver(valores) if valores is not None else None

    def fetchval(self):
        """Primera columna de la primera fila, o None si no hubo filas.

        Atajo para los innumerables `SELECT COUNT(*)` / `SELECT SUM(...)`
        del tablero. Ojo: SUM() de cero filas es NULL en SQL, no 0 --
        quien llama tiene que decidir que significa (`or 0` donde un
        hueco es un cero de verdad, `None` donde es "no hay dato")."""
        valores = self._cursor.fetchone()
        return valores[0] if valores is not None else None

    def __iter__(self):
        for valores in self._cursor:
            yield self._envolver(valores)

    @property
    def description(self):
        return self._cursor.description


def conectar() -> sqlite3.Connection:
    if not config.RUTA_BD.exists():
        raise RuntimeError(
            f"No existe {config.RUTA_BD}. Generala con:\n"
            "    python datos/generar_datos_demo.py"
        )
    # as_uri() escapa espacios y acentos de la ruta; concatenar a mano se
    # rompe en cuanto el proyecto vive en una carpeta con espacios, que
    # es justo donde suele vivir.
    return sqlite3.connect(
        f"{config.RUTA_BD.as_uri()}?mode=ro",
        uri=True,
        detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
    )


@contextmanager
def conexion():
    """Conexion de un solo uso, cerrada pase lo que pase."""
    cn = conectar()
    try:
        yield _Conexion(cn)
    finally:
        cn.close()


class _Conexion:
    def __init__(self, cn: sqlite3.Connection):
        self._cn = cn

    def cursor(self) -> Cursor:
        return Cursor(self._cn.cursor())
