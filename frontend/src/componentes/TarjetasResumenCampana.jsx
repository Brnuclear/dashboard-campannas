import { formatoDinero, formatoPorcentaje, formatoDecimal, diasEntreFechas } from '../graficas/escalas'

// Agregados de UNA campana especifica -- distinto de resumenContrataciones
// (esa es por sucursal, agrega varias campanas a la vez). El costo por
// contratacion aqui tambien es distinto: cada contratacion ya trae SOLO
// el gasto de ESTA campana (ver _contrataciones_campana en el backend),
// no el de toda la sucursal+puesto.
//
// desde/hasta son el filtro de fechas que ya esta aplicando el resto de
// las tarjetas (via los puntos que ya llegaron filtrados) -- se
// necesitan aparte, crudos, porque "dias de campana activa" no es una
// suma de los puntos (esos son por dia/semana/mes, no un conteo de
// dias calendario), asi que se calcula directo de las fechas.
export function resumenCampana(puntos, campana, desde, hasta) {
  const todas = puntos.flatMap((p) => p.contrataciones ?? [])
  const totalContrataciones = todas.length
  const totalSolicitantes = puntos.reduce((s, p) => s + (p.solicitantes ?? 0), 0)
  const totalImpresiones = puntos.reduce((s, p) => s + (p.impresiones ?? 0), 0)
  const totalGasto = puntos.reduce((s, p) => s + (p.gasto ?? 0), 0)

  // Interseccion de la ventana real de la campana con el filtro de
  // fechas que se este viendo -- la misma ventana que ya usa el backend
  // para contar solicitantes/contrataciones de esta campana, para que el
  // cociente sea consistente con el resto de las tarjetas.
  let diasActivos = null
  if (campana?.fecha_inicio && desde && hasta) {
    const ini = campana.fecha_inicio > desde ? campana.fecha_inicio : desde
    const finCampana = campana.fecha_fin ?? hasta
    const fin = finCampana < hasta ? finCampana : hasta
    if (ini <= fin) diasActivos = diasEntreFechas(ini, fin) + 1
  }

  return {
    totalContrataciones,
    cpaAgregado: totalContrataciones > 0 ? totalGasto / totalContrataciones : null,
    costoPorSolicitud: totalSolicitantes > 0 ? totalGasto / totalSolicitantes : null,
    tasaContratacion: totalSolicitantes > 0 ? (totalContrataciones / totalSolicitantes) * 100 : null,
    diasActivos,
    diasPorContratacion: diasActivos != null && totalContrataciones > 0 ? diasActivos / totalContrataciones : null,
    tasaConversionImpresiones: totalImpresiones > 0 ? (totalSolicitantes / totalImpresiones) * 100 : null,
  }
}

export default function TarjetasResumenCampana({ resumen }) {
  const tarjetas = [
    {
      etiqueta: 'Costo por contratación',
      valor: formatoDinero(resumen.cpaAgregado),
      pie: `${formatoDinero(resumen.costoPorSolicitud)} por solicitud · ${resumen.totalContrataciones} contratación${resumen.totalContrataciones === 1 ? '' : 'es'}`,
    },
    {
      etiqueta: 'Tasa de contratación',
      valor: formatoPorcentaje(resumen.tasaContratacion),
      pie: 'contrataciones ÷ solicitantes de la campaña',
    },
    {
      etiqueta: 'Días activos por contratación',
      valor: resumen.diasPorContratacion != null ? `${formatoDecimal(resumen.diasPorContratacion, 1)} días` : '—',
      pie: `${resumen.diasActivos ?? '—'} días de campaña activa ÷ ${resumen.totalContrataciones} contratación${resumen.totalContrataciones === 1 ? '' : 'es'}`,
    },
    {
      etiqueta: 'Conversión impresión→solicitud',
      valor: formatoPorcentaje(resumen.tasaConversionImpresiones),
      pie: 'solicitantes ÷ impresiones de la campaña',
    },
  ]

  return (
    <div className="tarjetas-resumen">
      {tarjetas.map((t) => (
        <div className="stat-tile" key={t.etiqueta}>
          <div className="stat-etiqueta">{t.etiqueta}</div>
          <div className="stat-valor">{t.valor}</div>
          <div className="stat-pie">{t.pie}</div>
        </div>
      ))}
    </div>
  )
}
