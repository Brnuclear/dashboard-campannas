import { formatoNumero, formatoDinero, formatoDineroPreciso, formatoDecimal } from '../graficas/escalas'

// Segunda fila del resumen: lo que cuesta y lo que se cubrio. Va con la
// cifra mas chica que el embudo de arriba a proposito -- es contexto del
// resultado, no el resultado.
export default function TarjetasEconomia({ totales, tasas, vacantes, campanasActivas }) {
  const tarjetas = [
    {
      etiqueta: 'Gasto del periodo',
      valor: formatoDinero(totales.gasto),
      pie: `${formatoDineroPreciso(tasas.cpm)} por cada 1,000 impresiones`,
    },
    {
      etiqueta: 'Costo por solicitud',
      valor: formatoDineroPreciso(tasas.costo_por_solicitud),
      pie: `${formatoDecimal(tasas.solicitudes_por_mil, 2)} solicitudes por cada 1,000 impresiones`,
    },
    {
      etiqueta: 'Vacantes cubiertas',
      valor: formatoNumero(vacantes.cubiertas),
      pie: vacantes.dias_cobertura_promedio != null
        ? `${formatoDecimal(vacantes.dias_cobertura_promedio, 1)} días del folio al ingreso · ${vacantes.activas} siguen abiertas`
        : `ninguna contratación nueva en el periodo · ${vacantes.activas} vacantes abiertas`,
    },
    {
      etiqueta: 'Campañas en el periodo',
      valor: formatoNumero(campanasActivas),
      pie: 'con ventana que toca el rango seleccionado',
    },
  ]

  return (
    <div className="tarjetas-resumen secundaria">
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
