import { formatoNumero, formatoDecimal } from '../graficas/escalas'
import { useAnchoContenedor } from '../graficas/useAnchoContenedor'

// El embudo del periodo: cuatro etapas encadenadas, de izquierda a
// derecha, cada una con su cambio contra el periodo anterior y con el
// cociente que la liga con la etapa anterior.
//
// --- Por que la altura va en escala logaritmica ---
//
// Las cuatro etapas abarcan tres ordenes de magnitud (cientos de miles
// de personas alcanzadas contra ~1,200 solicitudes). En escala lineal la
// ultima etapa mediria menos de un pixel: la forma seria un rectangulo
// con una raya al final, y justo la etapa que paga la nomina seria la
// invisible. En escala logaritmica cada etapa se sigue viendo, el orden
// se respeta (mas alto = mas grande, siempre) y los escalones entre
// etapas siguen siendo comparables entre si.
//
// Lo que se gana en legibilidad se pierde en proporcion: en esta grafica
// NO se puede medir "cuanto mas chica" es una etapa que otra a ojo. Por
// eso cada etapa trae su numero escrito y cada paso su cociente escrito
// -- el dato exacto nunca depende de medir el dibujo -- y el pie de la
// tarjeta lo dice con todas sus letras.
//
// El embudo se ensancha de la primera a la segunda etapa, y eso es
// correcto: a la misma persona se le muestra el anuncio varias veces.
// Una grafica que lo escondiera estaria mintiendo sobre la frecuencia.

const ALTO = 150
const MARGEN_V = 14
const HUECO = 2            // separacion en color de superficie entre bloques
const PISO = 0.22          // altura minima de un bloque, como fraccion de la banda
const ANCHO_MINIMO_COCIENTES = 700 // abajo de esto no caben las etiquetas de paso

const CAMPO_ANTERIOR = {
  'Usuarios alcanzados': 'alcance',
  Impresiones: 'impresiones',
  Resultados: 'resultados',
  Solicitudes: 'solicitudes_atribuibles',
}

function Delta({ cambio }) {
  if (cambio == null) {
    return <span className="delta neutra" title="No hay periodo anterior con dato para comparar">— sin base</span>
  }
  const color = Math.abs(cambio) < 10 ? 'neutra' : cambio > 0 ? 'bien' : 'critico'
  const flecha = cambio > 0 ? '▲' : cambio < 0 ? '▼' : '■'
  return (
    <span className={`delta ${color}`}>
      <span aria-hidden="true">{flecha}</span> {cambio > 0 ? '+' : ''}{formatoDecimal(cambio, 1)}%
      <span className="delta-nota"> vs. periodo anterior</span>
    </span>
  )
}

function textoCociente(etapa) {
  if (etapa.conversion == null) return null
  const valor = etapa.unidad === 'razon'
    ? `${formatoDecimal(etapa.conversion, 2)}×`
    : `${formatoDecimal(etapa.conversion, 2)}%`
  return `${valor} ${etapa.conversion_corta ?? ''}`.trim()
}

export default function EmbudoGeneral({ embudo, totales, anterior }) {
  const [contenedorRef, ancho] = useAnchoContenedor()

  function cambioDe(etapa) {
    const campo = CAMPO_ANTERIOR[etapa.etapa]
    const antes = anterior?.[campo]
    const ahora = totales?.[campo]
    if (antes == null || ahora == null || antes === 0) return null
    return ((ahora - antes) / antes) * 100
  }

  const n = embudo.length
  const valores = embudo.map((e) => Math.max(1, e.valor ?? 1))
  const logs = valores.map((v) => Math.log10(v))
  const minLog = Math.min(...logs)
  const maxLog = Math.max(...logs)
  const bandaUtil = ALTO - MARGEN_V * 2
  // Todas iguales (o una sola etapa): no hay escala que construir, se
  // dibujan a altura completa en vez de dividir entre cero.
  const alturas = logs.map((l) => (
    maxLog === minLog ? bandaUtil : (PISO + ((l - minLog) / (maxLog - minLog)) * (1 - PISO)) * bandaUtil
  ))

  const anchoBloque = n > 0 ? ancho / n : ancho
  const centro = ALTO / 2
  const x = (i) => i * anchoBloque
  const arriba = (i) => centro - alturas[i] / 2
  const abajo = (i) => centro + alturas[i] / 2

  // Cada bloque es un trapecio que baja de su propia altura a la de la
  // etapa siguiente; el ultimo no tiene siguiente, asi que es un
  // rectangulo -- es la salida del embudo, no un escalon mas.
  const trazo = (i) => {
    const x0 = x(i) + (i === 0 ? 0 : HUECO / 2)
    const x1 = x(i + 1) - (i === n - 1 ? 0 : HUECO / 2)
    const [aDer, bDer] = i === n - 1 ? [arriba(i), abajo(i)] : [arriba(i + 1), abajo(i + 1)]
    return `M ${x0} ${arriba(i)} L ${x1} ${aDer} L ${x1} ${bDer} L ${x0} ${abajo(i)} Z`
  }

  const resumenLectura = embudo
    .map((e) => `${e.etapa}: ${formatoNumero(e.valor)}`)
    .join('; ')

  return (
    <div className="tarjeta">
      <h2>Embudo del periodo</h2>
      <p className="subt">
        Alcance → impresiones → resultados son lo que reporta Meta; la solicitud es lo
        que cuenta la empresa, y es el resultado esperado de estas campañas
      </p>

      <div className="embudo" ref={contenedorRef} style={{ '--embudo-columnas': n }}>
        <div className="embudo-fila embudo-encabezados">
          {embudo.map((etapa) => (
            <div key={etapa.etapa} className={etapa.fuente === 'Empresa' ? 'empresa' : 'meta'}>
              <div className="embudo-encabezado">
                <span className="embudo-nombre">{etapa.etapa}</span>
                <span className="embudo-fuente">{etapa.fuente}</span>
              </div>
              <div className="embudo-valor">{formatoNumero(etapa.valor)}</div>
              <Delta cambio={cambioDe(etapa)} />
            </div>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${ancho} ${ALTO}`}
          width="100%"
          height={ALTO}
          role="img"
          aria-label={`Embudo del periodo, altura en escala logarítmica. ${resumenLectura}`}
        >
          {embudo.map((etapa, i) => (
            <path
              key={etapa.etapa}
              d={trazo(i)}
              fill={etapa.fuente === 'Empresa' ? 'var(--serie-solicitantes)' : 'var(--marca-medio)'}
            />
          ))}

          {/* Cociente de cada paso, justo en la union de los dos bloques
              que relaciona. Se omite en pantallas angostas: ahi los
              textos se encimarian, y el mismo dato esta escrito completo
              en las notas de abajo. */}
          {ancho >= ANCHO_MINIMO_COCIENTES && embudo.map((etapa, i) => {
            const texto = textoCociente(etapa)
            if (i === 0 || !texto) return null
            return (
              <g key={`c${etapa.etapa}`}>
                <line
                  x1={x(i)} x2={x(i)} y1={abajo(i) + 4} y2={ALTO - 12}
                  stroke="var(--eje)" strokeWidth="1" strokeDasharray="2 3"
                />
                <text className="embudo-cociente-svg" x={x(i)} y={ALTO - 1} textAnchor="middle">
                  {texto}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="embudo-fila embudo-notas">
          {embudo.map((etapa) => (
            <p key={etapa.etapa}>
              {etapa.conversion != null && (
                <strong className="embudo-cociente-nota">{textoCociente(etapa)} · </strong>
              )}
              {etapa.nota}
            </p>
          ))}
        </div>
      </div>

      <p className="pie">
        La <strong>altura va en escala logarítmica</strong>: entre la primera etapa y la
        última hay tres órdenes de magnitud, y en escala lineal las solicitudes medirían
        menos de un pixel — justo la etapa que importa. Sirve para ver el orden y los
        escalones, no para medir proporciones a ojo: para eso están los números, que son
        el dato. Que el embudo se ensanche de alcance a impresiones —poco, porque la escala
        logarítmica comprime ese salto— es correcto y no un error: a la misma persona se
        le muestra el anuncio varias veces, y esa razón es la frecuencia.
      </p>
    </div>
  )
}
