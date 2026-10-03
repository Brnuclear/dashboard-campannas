# Tablero de campañas de reclutamiento

Mide si la publicidad en Meta (Facebook/Instagram) sirve para contratar
gente. Cada campaña se hace para **una sucursal y un puesto**, lleva a
llenar una solicitud en línea, y esa solicitud puede terminar —semanas
después— en una contratación. El tablero sigue ese camino completo:

```
usuarios alcanzados → impresiones → resultados → solicitudes → contrataciones
└──────────── lo que reporta Meta ───────────┘   └──── lo que sabe la empresa ────┘
```

La pregunta que contesta no es «cuántas impresiones compramos» sino
**«cuánto de ese gasto se convirtió en alguien trabajando»** — y, cuando
no se convirtió, en qué escalón se rompió.

> **Esta es una versión de demostración.** Todos los datos son
> generados: nombres de sucursal, campañas, personas y folios son
> inventados, y las cifras salen de un generador con semilla fija. No hay
> ningún dato real de ninguna empresa en este paquete, ni credenciales, ni
> conexión a ninguna base de datos externa. Ver [Qué es sintético y qué
> no](#qué-es-sintético-y-qué-no).

## Arrancar

Necesita Python 3.11+ y Node 20+ (Node solo si se quiere recompilar el
frontend; el paquete ya trae la versión compilada).

```bash
python -m venv .venv
.venv/Scripts/activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m backend.app
```

Y abrir <http://127.0.0.1:8000>. Eso es todo: la base de datos
(`datos/demo.sqlite`) ya viene en el paquete.

Para regenerar los datos —por ejemplo para re-anclarlos a la fecha de hoy,
porque las fechas se generan relativas al día de la corrida:

```bash
python datos/generar_datos_demo.py            # hasta hoy
python datos/generar_datos_demo.py --semilla 7  # otro universo de datos
```

Para trabajar en el frontend con recarga en caliente:

```bash
cd frontend && npm install && npm run dev
```

Vite levanta en el 5173 y manda `/api/*` al backend del 8000, que hay que
tener corriendo aparte.

## Publicarlo

El repositorio trae un `render.yaml`, asi que en [Render](https://render.com)
basta con *New → Blueprint*, apuntar al repositorio y confirmar: Render lee
el archivo, instala las dependencias, regenera la base y arranca el
servicio. No hay variables de entorno que llenar ni secretos que guardar
— esta version no se conecta a nada.

Dos detalles que conviene saber antes:

**El bundle compilado se versiona.** El servidor solo instala Python, no
Node, asi que `frontend/dist/` viaja en el repositorio. Despues de tocar
cualquier cosa de `frontend/src/` hay que correr `npm run build` y
versionar el resultado, o el sitio publicado seguira mostrando la version
anterior.

**La base se regenera en cada despliegue.** El `buildCommand` corre
`generar_datos_demo.py`, asi que las fechas de la demo quedan ancladas al
dia del deploy y el tablero nunca se ve vencido. Si pasa el tiempo y los
«ultimos 30 dias» empiezan a quedar fuera del rango con datos, un
*Manual Deploy* lo vuelve a anclar.

El plan gratuito de Render duerme el servicio tras 15 minutos sin
visitas, y quien llegue despues espera unos 40 segundos a que despierte.
Si eso importa, [PythonAnywhere](https://www.pythonanywhere.com) tiene un
plan gratuito que no duerme: se sube el proyecto, se crea una *Web app*
de tipo *Manual configuration (Flask)* y en su archivo WSGI se apunta a
`backend.app:app`.

Netlify, Vercel y GitHub Pages **no** sirven para esta app: publican
archivos estaticos y funciones serverless en JavaScript, y aqui el
tablero se calcula en Python. Para publicarlo ahi habria que portar el
backend al navegador (SQLite compilado a WebAssembly), que es otro
proyecto.

## Las cuatro pestañas

| Pestaña | Para qué |
|---|---|
| **Resumen** | Cómo va el gasto publicitario en conjunto, contra el periodo anterior. Es la pestaña de entrada. |
| **Por sucursal** | El embudo de una sucursal: todas sus campañas sumadas, con las contrataciones marcadas sobre la gráfica. |
| **Por campaña** | Una campaña a la vez, más el marco de decisión que recomienda qué hacer con cada una de las activas. |
| **Vacantes** | Los folios del sistema interno de reclutamiento: cuáles siguen abiertos, cuánto tardaron en cubrirse. |

### Resumen: cómo se decide «qué tan bueno»

No existe un «bueno» universal para impresiones de reclutamiento, así que
la pregunta se contesta **contra el periodo anterior de la misma
longitud** (30 días por omisión). Mismas sucursales, mismo motor, misma
estacionalidad aproximada: lo que se juzga es la dirección, no la
magnitud.

El veredicto lo deciden **dos** señales, no un promedio de todas:

1. **Volumen de solicitudes atribuibles** — lo que la empresa necesita.
2. **Solicitudes por cada 1,000 impresiones** — si ese volumen vino de
   trabajar mejor o nada más de pagar más.

De ahí salen cuatro desenlaces: *Bueno* (sube el volumen y la eficiencia
aguanta), *Más volumen, no mejor desempeño* (sube el volumen pero la
eficiencia se cae: el crecimiento se compró), *Estable* (ningún cambio
sale del ruido) y *Débil* (cae el volumen, o la eficiencia se desploma).
Las otras señales —costo por solicitud, conversión resultado→solicitud,
alcance, frecuencia, vacantes cubiertas— se muestran porque explican,
pero no votan: un promedio de seis indicadores siempre sale «regular» y no
sirve para decidir nada.

### Marco de decisión por campaña

La pestaña **Por campaña** automatiza seis acciones (pausar, refrescar,
optimizar el anuncio, revisar el proceso, esperar, mantener, invertir
más). Cada condición se resuelve comparando contra la **mediana del
cohorte de campañas activas de hoy**, no contra un número fijo: el umbral
se recalibra solo conforme cambian los datos, en vez de quedarse pegado a
los cortes del trimestre en que se escribió.

El orden de las reglas es prioridad de negocio, no una lista de
condiciones independientes: primero lo que anula todo lo demás (*no hay
vacante abierta que justifique el gasto* → pausar), después lo que
todavía no tiene muestra confiable (→ esperar), después las alertas
tempranas, y al final las señales de que conviene invertir más.

## Lo que el tablero se niega a hacer

Casi todo lo interesante de este proyecto está en los problemas de datos
que hubo que resolver, y la mayoría se resolvió **no** haciendo lo fácil:

**El alcance no se suma entre días.** Meta deduplica el alcance solo
dentro del rango que se le pide como tal; sumar el alcance diario cuenta
dos veces a quien vio el anuncio en dos días. Donde el tablero necesita
ese número lo etiqueta como *cota superior* y reporta aparte el día de
mayor alcance, que sí es una cota inferior firme. Por lo mismo, en grano
semanal o mensual la métrica de alcance se deshabilita en vez de mostrar
una suma inflada.

**«Resultados» no mide lo mismo en todas las campañas.** Según el
objetivo son conversaciones de Messenger iniciadas o clics al enlace, y
hay campañas que cambiaron de objetivo a media historia. Se suma porque
es un conteo aditivo, pero el tablero dice en todas partes que el total
mezcla dos cosas.

**Ningún cociente se guarda.** Frecuencia, CPM, costo por solicitud,
tasas de conversión: todos se derivan al momento de mostrarse, a partir
de los conteos crudos. Un cociente guardado es un cociente que algún día
va a estar desincronizado con sus propios ingredientes.

**Un hueco no es un cero.** Si Meta no sincronizó un día, ese día no
existe en la gráfica; no se dibuja como actividad cero. Si una campaña
tuvo menos de 1,000 impresiones en una semana, su tasa semanal se
descarta en vez de dejar que una sola solicitud sobre 224 impresiones se
vea como un pico de «31 por mil».

**Una solicitud no se le atribuye a la publicidad nada más por existir.**
Solo cuentan como atribuibles las que cayeron en una sucursal y puesto que
*ese día* tenía campaña corriendo. El resto llegó por otro lado
(referidos, la vacante pegada en la sucursal) y se reporta aparte: el
total es lo que la empresa recibió, lo atribuible es lo que la
publicidad puede reclamar.

**Lo que no se puede explicar se dice.** Las campañas que corrieron en
Meta sin sucursal ni puesto asignados en el diccionario no se pueden
atribuir a nada, así que quedan fuera de todos los números — y el pie de
la pestaña Resumen reporta cuántas son, cuántas impresiones y cuánto
gasto representan. Es dinero que sí se gastó y que el tablero no puede
explicar; callarlo haría que los totales se vieran más limpios de lo que
son.

**Un porcentaje con muestra de uno no es un porcentaje.** Los rankings de
tasa exigen al menos 3 solicitantes: sin ese piso, una campaña con 1
solicitante y 1 contratación «gana» con 100% y tapa a las campañas con
volumen real.

**Contratar a alguien que ya trabajaba aquí no es contratar.** Un folio
que se llena con una persona cuya fecha de ingreso a la empresa es
anterior a la apertura del folio es una *reasignación* interna: se
distingue, no cuenta como contratación nueva y no entra al tiempo
promedio de cobertura.

## La homologación, que es el 80% del trabajo real

Las tres fuentes nombran a las mismas cosas de formas distintas, y
ninguna se puede cambiar en su origen:

| Fuente | Cómo escribe la sucursal | Cómo escribe el puesto |
|---|---|---|
| Solicitud en línea | `Bahía Verde` (con acento, nombre de ciudad) | `Operador de montacargas`, `Montacarguista`, `Técnico en refrigeración`, `Tecnico en refrigeracion`, `soudeur`, vacío |
| Diccionario de campañas | `BAHIA VERDE`, `Almacen ALT` | `MONTACARGAS`, `SOLDADOR`, `REFRIGERACION` |
| Nómina | `MATRIZ ALTAMIRA`, `CD. FUENTES`, `ALMACEN ALTAMIRA` | `OPERADOR DE MONTACARGAS`, `TÉCNICO EN REFRIGERACIÓN` |

Más un detalle que no se ve en la tabla: **la solicitud nunca dice
«almacén»**. El formulario pregunta por ciudad. Que un aspirante a
montacarguista de la ciudad X trabaja en el almacén regional y no en la
tienda se deduce del *puesto*, no del texto de la sucursal — por eso la
corrección de sucursal tiene que correr después de la de vacante y no al
revés. Las dos correcciones se generan desde
[`backend/catalogo.py`](backend/catalogo.py): una variante nueva del
formulario se agrega en un solo lugar y aparece sola en las dos
consultas.

Todo eso se resuelve en un CTE de SQL que lleva las tres a un nombre
canónico, y los nombres viven en un solo archivo
([`backend/catalogo.py`](backend/catalogo.py)) en vez de regados por las
consultas.

## Estructura

```
backend/
  app.py          toda la API: 10 rutas, una por pregunta del tablero
  bd.py           acceso a SQLite; la única puerta a los datos
  catalogo.py     los nombres de sucursales, puestos y establecimientos
  config.py       rutas y umbrales de negocio
datos/
  demo.sqlite     la base, ya generada
  generar_datos_demo.py
frontend/
  src/vistas/     una por pestaña
  src/componentes/
  src/graficas/   SVG a mano: línea, barras, indexada, marcadores
  dist/           compilado; es lo que sirve Flask en el 8000
REGLAS_VISUALES.md  las reglas de color y contraste que cita el CSS
```

Las gráficas son SVG escrito a mano, sin librería de charting. Son cuatro
formas y necesitaban control exacto sobre los marcadores de contratación
y sobre el manejo de huecos; traer una librería habría significado pelear
con sus valores por omisión para esas dos cosas.

## Qué es sintético y qué no

**Generado (todo):** nombres de sucursales, campañas, puestos
específicos, personas, folios; y todas las cifras — impresiones, alcance,
resultados, clics, gasto, solicitudes, fechas de ingreso. El generador
usa una semilla fija, así que la misma semilla produce la misma base.

**Conservado:** la *forma* del problema. Los órdenes de magnitud entre un
escalón del embudo y el siguiente, que el alcance no sea aditivo, que
«resultados» mezcle dos objetivos, el cansancio de audiencia semana a
semana, y toda la suciedad de los datos de origen: la misma sucursal
escrita de tres maneras, el mismo puesto con acento y sin acento, en
blanco o en otro idioma, campañas activas en
Meta que nadie dio de alta en el diccionario, una persona que aplica dos
veces con la misma clave, un folio cubierto por alguien que ya trabajaba
en la empresa, un establecimiento (`CORPORATIVO`) que el tablero debe
ignorar, y una sucursal a la que nunca se le ha pagado publicidad.

Esa suciedad está a propósito: sin ella el código de homologación no
tendría nada que homologar y el tablero se vería más fácil de lo que fue.

**Diferencias contra la versión interna.** Esa versión lee de MySQL (las
solicitudes), de SQL Server (el almacén donde se materializan las métricas
de Meta y el catálogo de folios) y de la API de Meta Insights, con un ETL
de recarga completa. Aquí todo eso se sustituyó por un SQLite de solo
lectura. La lógica de negocio es la misma; lo único que cambió fue el
dialecto de SQL —las equivalencias están anotadas al principio de
[`backend/app.py`](backend/app.py)— y de dónde se lee.
