import { formatoDecimal } from '../graficas/escalas'

// Las señales que sostienen el veredicto, una por renglon. Es a la vez
// la explicacion y la "vista de tabla" del resumen: todo lo que dicen
// las graficas de arriba se puede leer aqui como texto y numero, sin
// depender de ver un color ni de pasar el mouse.
//
// El veredicto solo lo votan dos de estas (volumen de solicitudes y
// eficiencia por impresion); las demas explican. Se dice aqui en el pie
// para que nadie suponga que es un promedio de las seis.
const ETIQUETA_COLOR = {
  bien: 'A favor',
  alerta: 'Atención',
  critico: 'En contra',
  neutra: 'Sin cambio',
}

export default function SenalesGenerales({ senales }) {
  return (
    <div className="tarjeta">
      <h2>Señales del periodo</h2>
      <p className="subt">Cada una contra el periodo anterior de la misma longitud</p>

      <div className="tabla-scroll">
        <table className="datos">
          <thead>
            <tr>
              <th scope="col">Señal</th>
              <th scope="col">Cambio</th>
              <th scope="col">Lectura</th>
              <th scope="col">Qué significa</th>
            </tr>
          </thead>
          <tbody>
            {senales.map((s) => (
              <tr key={s.clave}>
                <th scope="row" className="alinear-izq">{s.etiqueta}</th>
                <td>
                  {s.cambio == null
                    ? '—'
                    : `${s.cambio > 0 ? '+' : ''}${formatoDecimal(s.cambio, 1)}%`}
                </td>
                <td>
                  <span className={`pastilla-decision ${s.color}`}>{ETIQUETA_COLOR[s.color]}</span>
                </td>
                <td className="col-motivo">{s.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pie">
        El veredicto de arriba lo deciden solo dos de estas señales: el volumen de
        solicitudes atribuibles a campaña (lo que la empresa necesita) y las
        solicitudes por cada 1,000 impresiones (si ese volumen vino de trabajar mejor
        o nada más de pagar más). Las otras explican el resultado pero no votan: un
        promedio de seis indicadores siempre sale «regular» y no sirve para decidir
        nada. Un cambio de menos de 10% se reporta como «sin cambio» — con este
        volumen, dos periodos consecutivos nunca salen idénticos ni haciendo
        exactamente lo mismo.
      </p>
    </div>
  )
}
