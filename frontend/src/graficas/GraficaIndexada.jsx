import { useState } from 'react'
import { indexarSerie, formatoNumero, formatoDinero, formatoFecha, formatoPeriodo, indicesEtiquetas } from './escalas'
import Tooltip from './Tooltip'
import MarcadorContratacion, { filasContratacion, MarcadorSolicitudContratada, filasSolicitudContratada } from './MarcadorContratacion'
import { useAnchoContenedor } from './useAnchoContenedor'

const M = { top: 20, right: 20, bottom: 30, left: 56 }
const ALTO = 220
const TICKS = [0, 25, 50, 75, 100]

// Dos series con dos senales a proposito: color Y trazo (solido vs.
// punteado), no solo una. --serie-solicitantes ya se valido junto con
// --marca-medio (validate_palette.js, ver estilos.css), asi que el color
// por si solo ya distingue -- el trazo punteado se deja ademas como
// respaldo redundante para quien no distinga los colores.
export default function GraficaIndexada({ puntos, campoMetrica, etiquetaMetrica, granularidad }) {
  const [hover, setHover] = useState(null)
  const [contenedorRef, ancho] = useAnchoContenedor()

  const crudoMetrica = puntos.map((p) => p[campoMetrica])
  const crudoSolicitantes = puntos.map((p) => p.solicitantes)
  const idxMetrica = indexarSerie(crudoMetrica)
  const idxSolicitantes = indexarSerie(crudoSolicitantes)

  const anchoUtil = ancho - M.left - M.right
  const altoUtil = ALTO - M.top - M.bottom
  const n = puntos.length
  const pasoX = n > 1 ? anchoUtil / (n - 1) : 0
  const x = (i) => M.left + i * pasoX
  const y = (pct) => M.top + altoUtil - (pct / 100) * altoUtil

  const trazo = (serie) =>
    serie
      .map((v, i) => (v == null ? null : `${i === 0 || serie[i - 1] == null ? 'M' : 'L'} ${x(i)} ${y(v)}`))
      .filter(Boolean)
      .join(' ')

  const ultimoIdx = (serie) => {
    for (let i = serie.length - 1; i >= 0; i--) if (serie[i] != null) return i
    return null
  }
  const finMetrica = ultimoIdx(idxMetrica)
  const finSolicitantes = ultimoIdx(idxSolicitantes)

  const etiquetasX = indicesEtiquetas(n)
  const hayContrataciones = puntos.some((p) => p.contrataciones?.length)
  const haySolicitudesContratadas = puntos.some((p) => p.solicitudes_contratadas?.length)

  function alMoverMouse(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ancho
    let i = pasoX > 0 ? Math.round((px - M.left) / pasoX) : 0
    i = Math.max(0, Math.min(n - 1, i))
    setHover(i)
  }

  if (!puntos.length) return <div ref={contenedorRef} className="tarjeta-vacia">Sin datos en este periodo</div>

  const filasTooltip = hover != null
    ? [
        idxMetrica[hover] != null && {
          nombre: etiquetaMetrica,
          valor: `${formatoNumero(idxMetrica[hover])}% (${formatoNumero(crudoMetrica[hover])})`,
          estilo: 'solido',
        },
        idxSolicitantes[hover] != null && {
          nombre: 'Solicitantes',
          valor: `${formatoNumero(idxSolicitantes[hover])}% (${formatoNumero(crudoSolicitantes[hover])})`,
          estilo: 'punteado',
          color: 'var(--serie-solicitantes)',
        },
        ...filasContratacion(puntos[hover], formatoDinero, formatoFecha),
        ...filasSolicitudContratada(puntos[hover], formatoFecha),
      ].filter(Boolean)
    : []

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        width="100%"
        height={ALTO}
        onMouseMove={alMoverMouse}
        onMouseLeave={() => setHover(null)}
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line className="rejilla-linea" x1={M.left} x2={ancho - M.right} y1={y(t)} y2={y(t)} />
            <text className="eje-texto" x={M.left - 10} y={y(t) + 4} textAnchor="end">{t}%</text>
          </g>
        ))}
        <line className="eje-linea" x1={M.left} x2={ancho - M.right} y1={y(0)} y2={y(0)} />

        {etiquetasX.map((i) => (
          <text key={i} className="eje-texto" x={x(i)} y={ALTO - 8} textAnchor="middle">
            {formatoPeriodo(puntos[i].periodo, granularidad)}
          </text>
        ))}

        <path d={trazo(idxMetrica)} fill="none" stroke="var(--marca-medio)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={trazo(idxSolicitantes)} fill="none" stroke="var(--serie-solicitantes)" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" strokeLinecap="round" />

        {finMetrica != null && (
          <>
            <circle cx={x(finMetrica)} cy={y(idxMetrica[finMetrica])} r="7" fill="var(--superficie)" />
            <circle cx={x(finMetrica)} cy={y(idxMetrica[finMetrica])} r="4.5" fill="var(--marca-medio)" />
          </>
        )}
        {finSolicitantes != null && (
          <>
            <circle cx={x(finSolicitantes)} cy={y(idxSolicitantes[finSolicitantes])} r="7" fill="var(--superficie)" />
            <circle cx={x(finSolicitantes)} cy={y(idxSolicitantes[finSolicitantes])} r="4.5" fill="var(--serie-solicitantes)" />
          </>
        )}

        <MarcadorContratacion puntos={puntos} x={x} margenSuperior={M.top} altoUtil={altoUtil} />
        <MarcadorSolicitudContratada puntos={puntos} x={x} margenSuperior={M.top} altoUtil={altoUtil} />

        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={ALTO - M.bottom} stroke="var(--eje)" strokeWidth="1" />
        )}
      </svg>

      {/* Los dos marcadores solo se anuncian si esta vista los dibuja: el
          resumen general agrega todas las sucursales y no marca folios
          individuales, y una leyenda que promete simbolos que nunca
          aparecen manda a buscar algo que no existe. */}
      <div className="leyenda-indexada">
        <span className="item"><span className="clave-linea" />{etiquetaMetrica}</span>
        <span className="item"><span className="clave-linea punteada naranja" />Solicitantes</span>
        {hayContrataciones && <span className="item"><span className="clave-marcador" />Contratación</span>}
        {haySolicitudesContratadas && (
          <span className="item">
            <svg width="10" height="8" viewBox="0 0 10 8" className="clave-marcador-svg">
              <path d="M 0.5 7 L 5 0.7 L 9.5 7 Z" fill="none" stroke="var(--tinta)" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Solicitud contratada
          </span>
        )}
      </div>

      {hover != null && filasTooltip.length > 0 && (
        <Tooltip
          xPorcentaje={(x(hover) / ancho) * 100}
          y={y(Math.max(idxMetrica[hover] ?? 0, idxSolicitantes[hover] ?? 0))}
          fecha={formatoPeriodo(puntos[hover].periodo, granularidad)}
          filas={filasTooltip}
        />
      )}
    </div>
  )
}
