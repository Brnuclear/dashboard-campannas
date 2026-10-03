// Mismo algoritmo de "marcas redondas" que ya usa REGLAS_VISUALES.md para
// la grafica de trayectoria (1, 2, 2.5, 5 x 10^n): evita que un valor justo
// arriba de una cifra redonda agregue una marca entera de mas.
function pasoRedondo(bruto) {
  if (bruto <= 0) return 1
  const exp = Math.floor(Math.log10(bruto))
  const base = bruto / 10 ** exp
  let paso
  if (base <= 1) paso = 1
  else if (base <= 2) paso = 2
  else if (base <= 2.5) paso = 2.5
  else if (base <= 5) paso = 5
  else paso = 10
  return paso * 10 ** exp
}

export function generarTicksY(maxValor, pasosObjetivo = 4) {
  if (!maxValor || maxValor <= 0) return [0]
  const paso = pasoRedondo(maxValor / pasosObjetivo)
  const ticks = []
  // tolerancia 2%: si el maximo ya cabe holgado en el ultimo escalon, no
  // agrega uno de mas
  for (let v = 0; v <= maxValor * 1.001; v += paso) ticks.push(v)
  if (ticks[ticks.length - 1] < maxValor) ticks.push(ticks[ticks.length - 1] + paso)
  return ticks
}

export function formatoNumero(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-MX').format(Math.round(v))
}

export function formatoDinero(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
}

// Version con decimales, para costos chicos (CPM, costo por solicitud)
// donde redondear al peso entero se come casi toda la variacion.
export function formatoDineroPreciso(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v)
}

export function formatoPorcentaje(v) {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

export function formatoDecimal(v, decimales = 2) {
  if (v == null) return '—'
  return v.toFixed(decimales)
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// new Date("2026-07-02") se interpreta como medianoche UTC. En cualquier
// huso detras de UTC (UTC-7, es el de esta empresa) eso
// cae el 1 de julio en hora local -- un dia atras, siempre. Se arma la
// fecha con year/month/day directo, que el constructor de Date SI toma en
// hora local.
function fechaLocal(fechaISO) {
  const [anio, mes, dia] = fechaISO.slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function formatoPeriodo(periodoISO, granularidad) {
  const d = fechaLocal(periodoISO)
  const dia = d.getDate()
  const mes = MESES[d.getMonth()]
  if (granularidad === 'mes') return `${mes} ${d.getFullYear()}`
  return `${dia} ${mes}`
}

// Indices de etiqueta a mostrar en el eje X, para que no se amontonen
// cuando hay muchos puntos (mismo espiritu que "rotulos cada 5 dias").
export function indicesEtiquetas(n, maximoEtiquetas = 8) {
  if (n <= maximoEtiquetas) return [...Array(n).keys()]
  const paso = Math.ceil(n / maximoEtiquetas)
  const idx = []
  for (let i = 0; i < n; i += paso) idx.push(i)
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1)
  return idx
}

// % del propio maximo de la serie, ignorando nulos (huecos sin dato de
// Facebook siguen siendo huecos, nunca se leen como "0% de actividad").
export function indexarSerie(valores) {
  const max = Math.max(0, ...valores.filter((v) => v != null))
  if (max <= 0) return valores.map((v) => (v == null ? null : 0))
  return valores.map((v) => (v == null ? null : (v / max) * 100))
}

export function formatoFecha(fechaISO) {
  const d = fechaLocal(fechaISO)
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// Dias enteros entre dos fechas ISO (YYYY-MM-DD), usando el mismo parseo
// local que evita el corrimiento de un dia por UTC.
export function diasEntreFechas(fechaIsoDesde, fechaIsoHasta) {
  const MS_POR_DIA = 24 * 60 * 60 * 1000
  return Math.round((fechaLocal(fechaIsoHasta) - fechaLocal(fechaIsoDesde)) / MS_POR_DIA)
}
