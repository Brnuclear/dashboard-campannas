# Nomenclatura de las secciones de la UI

Cómo llamaría un desarrollador sr. de frontend a cada parte de la página, con
su componente/archivo real y la clase CSS que lo implementa. Útil como
referencia común cuando se discuta "la tarjeta de arriba" o "la tabla de la
derecha" — para que todos usen el mismo nombre.

## Estructura global (`App.jsx`)

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| Todo el contenedor de la página | **App shell** | `App.jsx` → `.app` |
| Logo + título + subtítulo de arriba | **Header** / **Topbar** (aquí es estático, no tiene navegación propia) | `.cabecera` |
| Los dos botones "Por sucursal" / "Por campaña" | **Tab navigation** (`role="tablist"`, cada botón es un `role="tab"`) | `.pestanas` |
| El contenido que cambia según la pestaña | **Tab panel** / **View** — en este proyecto cada uno vive en su propio componente de "vista" | `VistaSucursal.jsx`, `VistaCampana.jsx` |

Este patrón (tabs controlando qué "vista" se renderiza, sin router) se
conoce como **client-side view switching** — no hay rutas de verdad, solo
estado local (`useState('campana')`) decidiendo qué árbol de componentes
montar.

## Barra de filtros

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| Toda la fila de controles arriba de las gráficas | **Filter bar** / **Toolbar** | `Filtros.jsx` (vista sucursal), `FiltrosCampana.jsx` (vista campaña) → `.filtros` |
| Cada `label` + control individual (Sucursal, Desde, Hasta...) | **Filter group** / **Form field** | `.filtro-grupo` |
| El selector Sucursal / Campaña | **Select input** (nativo, no un "dropdown" custom) | `<select>` |
| Día / Semana / Mes | **Segmented control** (grupo de botones mutuamente excluyentes, `role="group"` + `aria-pressed`) | `.segmentado` |
| Desde / Hasta | **Date range inputs** (dos `<input type="date">` independientes, no un date-range picker unificado) | `#f-desde` / `#f-hasta` |

## Tarjetas de indicadores (arriba de las gráficas)

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| La fila completa de 4 recuadros | **KPI row** / **Stat card row** | `TarjetasResumen.jsx` / `TarjetasResumenCampana.jsx` → `.tarjetas-resumen` |
| Cada recuadro individual | **Stat tile** / **KPI card** (a veces "metric card") | `.stat-tile` |
| El número grande | **Stat value** (a veces "headline number") | `.stat-valor` |
| El texto chico arriba del número | **Stat label** / **eyebrow label** | `.stat-etiqueta` |
| El texto chico de abajo ("contrataciones ÷ solicitantes...") | **Stat caption** / **footnote** | `.stat-pie` |

Esto es lo que en dashboards se llama un **KPI strip**: valores agregados,
sin interacción, que dan la respuesta antes de que el usuario tenga que leer
una gráfica.

## Las tres gráficas

Cada una vive en su propio **chart card** (contenedor con título, subtítulo
y la gráfica adentro) — clase `.tarjeta`, reutilizada para las tres:

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| El contenedor con título + subtítulo + gráfica | **Chart card** / **Chart panel** | `.tarjeta` |
| El `<h2>` de cada tarjeta | **Chart title** | dentro de `.tarjeta` |
| El texto chico bajo el título ("Por día · comparación...") | **Chart subtitle** / **chart description** | `.subt` |
| Gráfica de Impresiones vs. Solicitantes normalizada 0–100% | **Indexed line chart** / **normalized comparison chart** (evita el anti-patrón de eje dual) | `GraficaIndexada.jsx` |
| Gráfica de una sola métrica de Facebook (Impresiones, Gasto, CPM...) | **Line/area chart** con **metric switcher** | `GraficaLinea.jsx` |
| Gráfica de barras de Solicitantes | **Bar chart** | `GraficaBarras.jsx` |
| Los botones Impresiones / Clics / Gasto / Resultados... | **Chip group** / **filter chips** (selección única, tipo "pill buttons") | `.chips` → `.chip` |
| El texto flotante al pasar el mouse sobre un punto | **Tooltip** (con **crosshair** en las de línea) | `Tooltip.jsx` |
| Impresiones / Solicitantes al pie de la gráfica indexada | **Legend** | `.leyenda-indexada` |
| Los triángulos ▼ / △ sobre la gráfica | **Event markers** / **annotations** (marcan un evento puntual, no un valor de la serie) | `MarcadorContratacion.jsx` |
| Las líneas verticales punteadas bajo cada marcador | **Reference lines** (anclan el marker al eje X) | dentro de `MarcadorContratacion.jsx` |
| "9,448" junto al último punto de la línea | **End-of-line label** / **terminus label** | dentro de `GraficaLinea.jsx` |

## Tabla de datos (solo vista "Por sucursal")

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| Toda la tabla | **Data table** / **data grid** (no es un grid interactivo tipo Excel, es solo lectura) | `TablaDatos.jsx` |
| El enlace "Ver como tabla (111 periodos)" que la despliega | **Disclosure toggle** / **expandable section** | dentro de `TablaDatos.jsx` |
| Encabezado con "Facebook" cubriendo varias columnas | **Grouped header** / **column group header** (usa `colSpan`) | `gruposEncabezado()` |
| El encabezado que se queda fijo al hacer scroll | **Sticky header** | CSS `position: sticky` sobre `<thead>` |
| Clic en un encabezado para reordenar | **Sortable column header** | lógica de `ordenarPor` en `COLUMNAS` |
| La fila de suma al final | **Totals row** / **footer row** (`<tfoot>`) | `calcularTotales()` |
| Columna de texto largo con detalle de cada contratación | **Detail column** (contenido no tabular dentro de una celda) | `.col-contrataciones` |

## Panel lateral de ranking (solo vista "Por campaña")

| Sección | Cómo se le llama | Archivo / clase |
|---|---|---|
| La columna derecha completa | **Sidebar** / **aside panel** (se queda fijo con `position: sticky` al hacer scroll) | `RankingCampanas.jsx` → `.ranking-panel` |
| El layout de dos columnas (contenido + sidebar) | **Two-column layout** / **content + rail layout** | `.campana-layout` |
| Cada una de las 3 mini-tablas | **Leaderboard widget** / **ranked list** (no es una "tabla" en el sentido de `TablaDatos`, es una lista ordenada top-N) | `.ranking-tabla` |
| Cada fila clickeable dentro de una leaderboard | **List item button** / **row action** (clic navega, cambia el estado de la vista) | `<li><button>` dentro de `.ranking-tabla` |
| El "1", "2", "3"... a la izquierda de cada fila | **Rank badge** | `.ranking-num` |
| El resaltado del primer lugar y de la campaña activa | **Row highlight state** (dos variantes: "top rank" y "selected/active") | `--banda-cabecera` (top 1) / `.activa` con `box-shadow` (seleccionada) |
| El texto de abajo sobre la muestra mínima | **Helper text** / **methodology note** | `.ranking-nota` |

## Texto explicativo al final de cada vista

| Sección | Cómo se le llama |
|---|---|
| El párrafo largo bajo las gráficas explicando ▼/△, costo por contratación, etc. | **Footnote** / **disclaimer text** / **methodology note** — texto que documenta cómo interpretar los datos, no un dato en sí mismo |

Archivo/clase: `.pie`, al final de `VistaSucursal.jsx` y `VistaCampana.jsx`.

## Estados especiales

| Sección | Cómo se le llama |
|---|---|
| "Cargando…" mientras llegan los datos | **Loading state** |
| "Esta sucursal no tiene campañas registradas..." | **Empty state** |
| Mensaje en rojo si falla un `fetch` | **Error state** / **inline error message** |
| "Sin suficiente muestra en este rango" en una leaderboard | **Empty state** a nivel de widget (no de la página completa) |

## Resumen rápido (glosario)

- **Shell** → el armazón fijo (header + tabs) que envuelve todo
- **View / tab panel** → el contenido que cambia según la pestaña activa
- **Toolbar / filter bar** → la fila de controles de filtrado
- **KPI row / stat tiles** → los recuadros de números grandes
- **Chart card** → cada contenedor de gráfica (título + subtítulo + chart + leyenda)
- **Chip group** → los botones tipo pastilla para elegir métrica
- **Data table** → la tabla completa con encabezado agrupado, sticky header y totals row
- **Sidebar / rail** → la columna derecha fija de la vista "Por campaña"
- **Leaderboard widget** → cada una de las 3 mini-tablas de ranking
- **Footnote** → el texto explicativo largo al final
