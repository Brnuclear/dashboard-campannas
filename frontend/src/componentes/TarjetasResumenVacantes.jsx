import { formatoDecimal } from '../graficas/escalas'

export default function TarjetasResumenVacantes({ resumen }) {
  const antigua = resumen.vacante_mas_antigua

  const tarjetas = [
    {
      etiqueta: 'Vacantes activas',
      valor: resumen.activas,
      pie: 'sin cubrir al día de hoy',
    },
    {
      etiqueta: 'Vacantes cubiertas',
      valor: resumen.cubiertas,
      pie: resumen.reasignaciones > 0
        ? `+ ${resumen.reasignaciones} por reasignación, no contadas aquí`
        : 'en el histórico de folios',
    },
    {
      etiqueta: 'Tiempo promedio de cobertura',
      valor: resumen.tiempo_cobertura_promedio != null
        ? `${formatoDecimal(resumen.tiempo_cobertura_promedio, 1)} días`
        : '—',
      pie: 'apertura del folio → fecha de ingreso, todas las sucursales',
    },
    {
      etiqueta: 'Vacante más antigua sin cubrir',
      valor: antigua ? `${antigua.dias} días` : '—',
      pie: antigua ? `${antigua.puesto} · ${antigua.sucursal}` : 'no hay vacantes activas',
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
