import { useMemo, useState } from 'react'
import { generarTicksY, formatoNumero, formatoDinero, formatoFecha, formatoPeriodo, indicesEtiquetas } from './escalas'
import Tooltip from './Tooltip'
import MarcadorContratacion, { filasContratacion, MarcadorSolicitudContratada, filasSolicitudContratada } from './MarcadorContratacion'
import { useAnchoContenedor } from './useAnchoContenedor'

const M = { top: 20, right: 20, bottom: 30, left: 56 }
const ALTO = 220

export default function GraficaLinea({ puntos, campo, etiqueta = 'valor', formateador = formatoNumero, granularidad }) {
  const [hover, setHover] = useState(null)
  const [contenedorRef, ancho] = useAnchoContenedor()

  const valores = puntos.map((p) => p[campo])
  const hayDatos = valores.some((v) => v != null)
  const maxValor = Math.max(1, ...valores.map((v) => v ?? 0))
  const ticksY = useMemo(() => generarTicksY(maxValor), [maxValor])
  const techoY = ticksY[ticksY.length - 1]

  const anchoUtil = ancho - M.left - M.right
  const altoUtil = ALTO - M.top - M.bottom
  const n = puntos.length
  const pasoX = n > 1 ? anchoUtil / (n - 1) : 0
  const x = (i) => M.left + i * pasoX
  const y = (v) => M.top + altoUtil - (v / techoY) * altoUtil

  const linea = valores
    .map((v, i) => (v == null ? null : `${i === 0 || valores[i - 1] == null ? 'M' : 'L'} ${x(i)} ${y(v)}`))
    .filter(Boolean)
    .join(' ')
  const area = hayDatos
    ? `${linea} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`
    : ''

  const etiquetasX = indicesEtiquetas(n)
  const ultimoConDato = [...valores].map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).pop()

  function alMoverMouse(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ancho
    let i = pasoX > 0 ? Math.round((px - M.left) / pasoX) : 0
    i = Math.max(0, Math.min(n - 1, i))
    setHover(i)
  }

  if (!hayDatos) {
    return <div ref={contenedorRef} className="tarjeta-vacia">Sin datos de Meta en este periodo</div>
  }

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        width="100%"
        height={ALTO}
        onMouseMove={alMoverMouse}
        onMouseLeave={() => setHover(null)}
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line className="rejilla-linea" x1={M.left} x2={ancho - M.right} y1={y(t)} y2={y(t)} />
            <text className="eje-texto" x={M.left - 10} y={y(t) + 4} textAnchor="end">
              {formateador(t)}
            </text>
          </g>
        ))}
        <line className="eje-linea" x1={M.left} x2={ancho - M.right} y1={y(0)} y2={y(0)} />

        {etiquetasX.map((i) => (
          <text key={i} className="eje-texto" x={x(i)} y={ALTO - 8} textAnchor="middle">
            {formatoPeriodo(puntos[i].periodo, granularidad)}
          </text>
        ))}

        <path d={area} fill="var(--marca-medio)" fillOpacity="0.10" stroke="none" />
        <path d={linea} fill="none" stroke="var(--marca-medio)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {ultimoConDato != null && (
          <>
            <circle cx={x(ultimoConDato)} cy={y(valores[ultimoConDato])} r="7" fill="var(--superficie)" />
            <circle cx={x(ultimoConDato)} cy={y(valores[ultimoConDato])} r="4.5" fill="var(--marca-medio)" />
            <text
              className="eje-texto"
              x={x(ultimoConDato)}
              y={y(valores[ultimoConDato]) - 12}
              textAnchor="end"
              fontWeight="700"
              fill="var(--tinta)"
            >
              {formateador(valores[ultimoConDato])}
            </text>
          </>
        )}

        <MarcadorContratacion puntos={puntos} x={x} margenSuperior={M.top} altoUtil={altoUtil} />
        <MarcadorSolicitudContratada puntos={puntos} x={x} margenSuperior={M.top} altoUtil={altoUtil} />

        {hover != null && (
          <line
            x1={x(hover)} x2={x(hover)} y1={M.top} y2={ALTO - M.bottom}
            stroke="var(--eje)" strokeWidth="1"
          />
        )}
        {hover != null && valores[hover] != null && (
          <circle cx={x(hover)} cy={y(valores[hover])} r="5" fill="var(--marca-medio)" stroke="var(--superficie)" strokeWidth="2" />
        )}
      </svg>

      {hover != null && (
        <Tooltip
          xPorcentaje={(x(hover) / ancho) * 100}
          y={valores[hover] != null ? y(valores[hover]) : ALTO / 2}
          fecha={formatoPeriodo(puntos[hover].periodo, granularidad)}
          filas={[
            { nombre: etiqueta, valor: formateador(valores[hover]) },
            ...(puntos[hover].campanas?.length
              ? [{ nombre: 'Campaña', valor: puntos[hover].campanas.join(', '), sinClave: true }]
              : []),
            ...filasContratacion(puntos[hover], formatoDinero, formatoFecha),
            ...filasSolicitudContratada(puntos[hover], formatoFecha),
          ]}
        />
      )}
    </div>
  )
}
