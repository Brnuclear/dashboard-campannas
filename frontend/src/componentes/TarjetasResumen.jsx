import { formatoDinero, formatoPorcentaje, formatoDecimal } from '../graficas/escalas'

// Agregados del periodo/sucursal filtrados -- no por folio (esa version ya
// vive en el marcador de cada grafica). Esta es la version "libro de
// texto": gasto total / contrataciones totales, sin depender de la
// ventana de cada folio individual, para dar seguimiento de tendencia mes
// a mes sin el riesgo de doble conteo cuando dos folios se traslapan.
export function resumenContrataciones(puntos) {
  const todas = puntos.flatMap((p) => p.contrataciones ?? [])
  const totalContrataciones = todas.length
  const totalSolicitantes = puntos.reduce((s, p) => s + (p.solicitantes ?? 0), 0)
  const totalGasto = puntos.reduce((s, p) => s + (p.gasto ?? 0), 0)

  // dias_desde_solicitud puede faltar (folio sin clave de candidato en rh_solicitantes),
  // asi que su promedio se calcula solo sobre las que si lo tienen -- no
  // sobre "todas", que mezclaria contrataciones sin ese dato como si
  // fueran 0 dias.
  const conSolicitud = todas.filter((c) => c.dias_desde_solicitud != null)

  return {
    totalContrataciones,
    cpaAgregado: totalContrataciones > 0 ? totalGasto / totalContrataciones : null,
    tasaContratacion: totalSolicitantes > 0 ? (totalContrataciones / totalSolicitantes) * 100 : null,
    tiempoPromedio: todas.length
      ? todas.reduce((s, c) => s + c.dias_contratacion, 0) / todas.length
      : null,
    tiempoDesdeSolicitud: conSolicitud.length
      ? conSolicitud.reduce((s, c) => s + c.dias_desde_solicitud, 0) / conSolicitud.length
      : null,
    conSolicitudCount: conSolicitud.length,
  }
}

export default function TarjetasResumen({ resumen }) {
  const tarjetas = [
    { etiqueta: 'Costo por contratación', valor: formatoDinero(resumen.cpaAgregado), pie: `${resumen.totalContrataciones} contratación${resumen.totalContrataciones === 1 ? '' : 'es'} en el rango` },
    { etiqueta: 'Tasa de contratación', valor: formatoPorcentaje(resumen.tasaContratacion), pie: 'contrataciones ÷ solicitantes del rango' },
    { etiqueta: 'Tiempo de contratación', valor: resumen.tiempoPromedio != null ? `${formatoDecimal(resumen.tiempoPromedio, 1)} días` : '—', pie: 'folio abierto → fecha de ingreso' },
    { etiqueta: 'Tiempo desde solicitud', valor: resumen.tiempoDesdeSolicitud != null ? `${formatoDecimal(resumen.tiempoDesdeSolicitud, 1)} días` : '—', pie: `solicitud → fecha de ingreso · ${resumen.conSolicitudCount} folio${resumen.conSolicitudCount === 1 ? '' : 's'} con clave de candidato encontrada` },
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
