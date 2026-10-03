import {
  formatoNumero, formatoDinero, formatoDineroPreciso, formatoPorcentaje, formatoDecimal,
} from './graficas/escalas'

// Compartido entre la vista por sucursal y la vista por campaña: mismas
// metricas de Facebook, mismo chip selector, misma logica de derivarlas.
export const METRICAS_FB = [
  { campo: 'impresiones', etiqueta: 'Impresiones', formateador: formatoNumero },
  { campo: 'clics_enlace', etiqueta: 'Clics al enlace', formateador: formatoNumero },
  { campo: 'clics_todos', etiqueta: 'Clics (todos)', formateador: formatoNumero },
  { campo: 'gasto', etiqueta: 'Gasto', formateador: formatoDinero },
  // "Resultados" cuenta cosas distintas segun el objetivo de la campana
  // (conversaciones de Messenger iniciadas o clics al enlace, segun
  // tipo_resultado) -- dos campanas mezclan ambos tipos en su propia
  // historia (MONT_ALMACEN_GRANADOS, SOLDADOR_FUENTES_JUL29). Se suma igual que el
  // resto porque es un conteo aditivo, pero el numero puede estar
  // mezclando dos cosas ahi.
  { campo: 'resultados', etiqueta: 'Resultados', formateador: formatoNumero },
  { campo: 'alcance', etiqueta: 'Alcance', formateador: formatoNumero, soloDia: true },
  // Las siguientes cuatro no vienen de la API -- se derivan aqui mismo de
  // impresiones/alcance/gasto/clics_enlace/solicitantes, que la API ya
  // entrega crudos. Mismo principio que ya rige el resto del proyecto:
  // ningun cociente se guarda, se deriva al momento de mostrarse.
  { campo: 'frecuencia', etiqueta: 'Frecuencia', formateador: (v) => formatoDecimal(v, 2), soloDia: true },
  { campo: 'cpm', etiqueta: 'CPM', formateador: formatoDineroPreciso },
  { campo: 'costo_por_solicitud', etiqueta: 'Costo por solicitud', formateador: formatoDineroPreciso },
  { campo: 'tasa_conversion', etiqueta: 'Conv. clic→solicitud', formateador: formatoPorcentaje },
]

export function conMetricasDerivadas(puntos) {
  return puntos.map((p) => ({
    ...p,
    frecuencia: p.alcance ? p.impresiones / p.alcance : null,
    cpm: p.impresiones ? ((p.gasto ?? 0) / p.impresiones) * 1000 : null,
    costo_por_solicitud: p.gasto != null && p.solicitantes > 0 ? p.gasto / p.solicitantes : null,
    tasa_conversion: p.clics_enlace ? (p.solicitantes / p.clics_enlace) * 100 : null,
  }))
}

// NO usar toISOString(): convierte a UTC, y esta empresa vive en husos
// detras de UTC (UTC-7). Cualquier hora despues de las
// 5pm locales ya cae en el dia siguiente en UTC, asi que un default
// armado con toISOString() mostraria manana en vez de hoy. Se arma con
// los componentes de fecha LOCALES en vez de convertir.
export function hoyISO() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Mismo motivo que hoyISO(): construido con componentes LOCALES, nunca
// toISOString() (convierte a UTC y puede correr el dia en un huso UTC-7).
export function haceDiasISO(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
