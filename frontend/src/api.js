export async function obtenerSucursales() {
  const r = await fetch('/api/sucursales')
  if (!r.ok) throw new Error('no se pudo cargar la lista de sucursales')
  return r.json()
}

export async function obtenerMetricas({ sucursal, granularidad, desde, hasta }) {
  const params = new URLSearchParams({ sucursal, granularidad, desde, hasta })
  const r = await fetch(`/api/metricas?${params}`)
  if (!r.ok) throw new Error('no se pudieron cargar las metricas')
  return r.json()
}

export async function obtenerRangoCampanas() {
  const r = await fetch('/api/rango_campanas')
  if (!r.ok) throw new Error('no se pudo cargar el rango de campañas')
  return r.json()
}

export async function obtenerCampanas(sucursal) {
  const params = new URLSearchParams(sucursal && sucursal !== 'Todas' ? { sucursal } : {})
  const r = await fetch(`/api/campanas?${params}`)
  if (!r.ok) throw new Error('no se pudo cargar la lista de campañas')
  return r.json()
}

export async function obtenerMetricasCampana({ campana, granularidad, desde, hasta }) {
  const params = new URLSearchParams({ campana, granularidad, desde, hasta })
  const r = await fetch(`/api/metricas_campana?${params}`)
  if (!r.ok) throw new Error('no se pudieron cargar las métricas de la campaña')
  return r.json()
}

export async function obtenerRankingCampanas({ desde, hasta }) {
  const params = new URLSearchParams({ desde, hasta })
  const r = await fetch(`/api/ranking_campanas?${params}`)
  if (!r.ok) throw new Error('no se pudo cargar el ranking de campañas')
  return r.json()
}

export async function obtenerRankingSucursales({ desde, hasta }) {
  const params = new URLSearchParams({ desde, hasta })
  const r = await fetch(`/api/ranking_sucursales?${params}`)
  if (!r.ok) throw new Error('no se pudo cargar el ranking de sucursales')
  return r.json()
}

export async function obtenerDecisionCampanas({ desde, hasta }) {
  const params = new URLSearchParams({ desde, hasta })
  const r = await fetch(`/api/decision_campanas?${params}`)
  if (!r.ok) throw new Error('no se pudo cargar el marco de decisión de campañas')
  return r.json()
}

export async function obtenerVacantes() {
  const r = await fetch('/api/vacantes')
  if (!r.ok) throw new Error('no se pudo cargar la lista de vacantes')
  return r.json()
}

// El resumen general no recibe sucursal ni campana: es el agregado de
// todas. Solo el rango de fechas, y el backend decide la granularidad
// (dia hasta ~10 semanas, semana de ahi en adelante) para que la grafica
// no se vuelva ilegible con un rango largo.
export async function obtenerResumen({ desde, hasta }) {
  const params = new URLSearchParams({ desde, hasta })
  const r = await fetch(`/api/resumen?${params}`)
  if (!r.ok) throw new Error('no se pudo cargar el resumen general')
  return r.json()
}
