import { useMemo, useState } from 'react'
import { generarTicksY, formatoNumero, formatoDinero, formatoFecha, formatoPeriodo, indicesEtiquetas } from './escalas'
import Tooltip from './Tooltip'
import MarcadorContratacion, { filasContratacion, MarcadorSolicitudContratada, filasSolicitudContratada } from './MarcadorContratacion'
import { useAnchoContenedor } from './useAnchoContenedor'

const M = { top: 20, right: 20, bottom: 30, left: 56 }
const ALTO = 220
const ANCHO_MAX_BARRA = 24
const HUECO = 2 // gap en color de superficie entre barras contiguas

// rect con rx redondea las 4 esquinas; el spec pide solo arriba (el
// "extremo del dato"), cuadrado abajo donde toca la linea base.
function trazoBarra(x, yTop, ancho, alto, radio) {
  const r = Math.min(radio, alto, ancho / 2)
  if (alto <= 0) return ''
  return `M ${x} ${yTop + alto}
          L ${x} ${yTop + r}
          Q ${x} ${yTop} ${x + r} ${yTop}
          L ${x + ancho - r} ${yTop}
          Q ${x + ancho} ${yTop} ${x + ancho} ${yTop + r}
          L ${x + ancho} ${yTop + alto} Z`
}

export default function GraficaBarras({ puntos, campo, granularidad }) {
  const [hover, setHover] = useState(null)
  const [contenedorRef, ancho] = useAnchoContenedor()

  const valores = puntos.map((p) => p[campo] ?? 0)
  const maxValor = Math.max(1, ...valores)
  const ticksY = useMemo(() => generarTicksY(maxValor), [maxValor])
  const techoY = ticksY[ticksY.length - 1]

  const anchoUtil = ancho - M.left - M.right
  const altoUtil = ALTO - M.top - M.bottom
  const n = puntos.length
  const anchoBanda = n > 0 ? anchoUtil / n : anchoUtil
  const anchoBarra = Math.max(2, Math.min(ANCHO_MAX_BARRA, anchoBanda - HUECO))
  const xBanda = (i) => M.left + i * anchoBanda
  const xBarra = (i) => xBanda(i) + (anchoBanda - anchoBarra) / 2
  const y = (v) => M.top + altoUtil - (v / techoY) * altoUtil
  const alturaBarra = (v) => (v / techoY) * altoUtil

  const etiquetasX = indicesEtiquetas(n)

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${ancho} ${ALTO}`} width="100%" height={ALTO}>
        {ticksY.map((t) => (
          <g key={t}>
            <line className="rejilla-linea" x1={M.left} x2={ancho - M.right} y1={y(t)} y2={y(t)} />
            <text className="eje-texto" x={M.left - 10} y={y(t) + 4} textAnchor="end">
              {formatoNumero(t)}
            </text>
          </g>
        ))}
        <line className="eje-linea" x1={M.left} x2={ancho - M.right} y1={y(0)} y2={y(0)} />

        {etiquetasX.map((i) => (
          <text key={i} className="eje-texto" x={xBanda(i) + anchoBanda / 2} y={ALTO - 8} textAnchor="middle">
            {formatoPeriodo(puntos[i].periodo, granularidad)}
          </text>
        ))}

        {valores.map((v, i) => (
          <path
            key={i}
            d={trazoBarra(xBarra(i), y(v), anchoBarra, Math.max(0, alturaBarra(v)), 4)}
            fill="var(--serie-solicitantes)"
            opacity={hover === i ? 1 : 0.88}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        <MarcadorContratacion
          puntos={puntos}
          x={(i) => xBanda(i) + anchoBanda / 2}
          margenSuperior={M.top}
          altoUtil={altoUtil}
        />
        <MarcadorSolicitudContratada
          puntos={puntos}
          x={(i) => xBanda(i) + anchoBanda / 2}
          margenSuperior={M.top}
          altoUtil={altoUtil}
        />
      </svg>

      {hover != null && (
        <Tooltip
          xPorcentaje={((xBarra(hover) + anchoBarra / 2) / ancho) * 100}
          y={y(valores[hover])}
          fecha={formatoPeriodo(puntos[hover].periodo, granularidad)}
          filas={[
            { nombre: 'solicitantes', valor: formatoNumero(valores[hover]), color: 'var(--serie-solicitantes)' },
            ...filasContratacion(puntos[hover], formatoDinero, formatoFecha),
            ...filasSolicitudContratada(puntos[hover], formatoFecha),
          ]}
        />
      )}
    </div>
  )
}
