// Marca el momento de una contratacion sobre cualquier grafica. No es una
// serie de datos -- es una referencia, como la linea de "Meta" de
// REGLAS_VISUALES.md: por eso va en --tinta (casi negro), nunca en el
// azul de marca, para no competir visualmente con lo que si es dato.
//
// Es siempre visible (no solo al pasar el mouse): "marcar el momento en
// que hubo contratacion" pide que se note sin tener que interactuar.
export default function MarcadorContratacion({ puntos, x, margenSuperior, altoUtil }) {
  const conContratacion = puntos
    .map((p, i) => (p.contrataciones?.length ? i : null))
    .filter((i) => i != null)

  return (
    <>
      {conContratacion.map((i) => (
        <g key={i}>
          <line
            x1={x(i)} x2={x(i)}
            y1={margenSuperior} y2={margenSuperior + altoUtil}
            stroke="var(--tinta)" strokeWidth="1" strokeDasharray="2 3" opacity="0.35"
          />
          <path
            d={`M ${x(i) - 5} ${margenSuperior - 9} L ${x(i) + 5} ${margenSuperior - 9} L ${x(i)} ${margenSuperior - 1} Z`}
            fill="var(--tinta)"
          />
        </g>
      ))}
    </>
  )
}

// Filas de tooltip para las contrataciones de un punto, listas para
// concatenar a las filas propias de cada grafica. Cada contratacion aporta
// dos renglones: quien/cuanto costo, y desde cuando aplico -- son datos
// distintos (ventana del folio vs. viaje real del candidato) y no hay que
// mezclarlos en una sola linea.
export function filasContratacion(punto, formatoDinero, formatoFecha) {
  if (!punto?.contrataciones?.length) return []
  return punto.contrataciones.flatMap((c) => {
    const filas = [{
      nombre: `Contratación (${c.puesto})`,
      valor: c.costo_estimado != null
        ? `${c.nombre} · ${formatoDinero(c.costo_estimado)} en ads`
        : `${c.nombre} · sin gasto de Meta en la ventana`,
      sinClave: true,
    }]
    if (c.fecha_solicitud) {
      const dias = c.dias_desde_solicitud
      filas.push({
        nombre: 'Solicitó',
        valor: `${formatoFecha(c.fecha_solicitud)} · ${dias} día${dias === 1 ? '' : 's'} hasta contratación`,
        sinClave: true,
      })
    }
    return filas
  })
}

// Segundo marcador, mismo espiritu: el dia en que se envio una solicitud
// que MAS ADELANTE termino en contratacion -- el otro extremo del mismo
// par que ya marca MarcadorContratacion. Triangulo hueco y hacia arriba,
// apilado justo encima del de contratacion (relleno, hacia abajo): mismo
// color --tinta porque sigue siendo referencia, no serie; la forma es la
// que distingue "aqui empezo" de "aqui termino", no un color nuevo.
export function MarcadorSolicitudContratada({ puntos, x, margenSuperior, altoUtil }) {
  const conSolicitud = puntos
    .map((p, i) => (p.solicitudes_contratadas?.length ? i : null))
    .filter((i) => i != null)

  return (
    <>
      {conSolicitud.map((i) => (
        <g key={i}>
          <line
            x1={x(i)} x2={x(i)}
            y1={margenSuperior} y2={margenSuperior + altoUtil}
            stroke="var(--tinta)" strokeWidth="1" strokeDasharray="2 3" opacity="0.35"
          />
          <path
            d={`M ${x(i) - 5} ${margenSuperior - 11} L ${x(i) + 5} ${margenSuperior - 11} L ${x(i)} ${margenSuperior - 19} Z`}
            fill="none" stroke="var(--tinta)" strokeWidth="1.5" strokeLinejoin="round"
          />
        </g>
      ))}
    </>
  )
}

export function filasSolicitudContratada(punto, formatoFecha) {
  if (!punto?.solicitudes_contratadas?.length) return []
  return punto.solicitudes_contratadas.map((c) => ({
    nombre: `Solicitud (${c.puesto})`,
    valor: `${c.nombre} · contratado ${formatoFecha(c.fecha_ingreso)}, ${c.dias_desde_solicitud} día${c.dias_desde_solicitud === 1 ? '' : 's'} después`,
    sinClave: true,
  }))
}
