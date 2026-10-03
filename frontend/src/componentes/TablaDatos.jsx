import { useMemo, useState } from 'react'
import {
  formatoNumero, formatoDinero, formatoDineroPreciso, formatoPorcentaje,
  formatoDecimal, formatoFecha, formatoPeriodo,
} from '../graficas/escalas'
import { useTablaFiltroOrden } from './tabla/useTablaFiltroOrden'
import EncabezadoFiltrable from './tabla/EncabezadoFiltrable'
import SelectorColumnas from './tabla/SelectorColumnas'

// Catalogo completo de columnas disponibles. `fija` = no se puede ocultar
// (identifica la fila). `defecto` = visible la primera vez que se abre la
// tabla. Todas las demas empiezan ocultas y se agregan desde "Columnas".
const COLUMNAS_DISPONIBLES = [
  { clave: 'periodo', etiqueta: 'Periodo', alinear: 'izquierda', fija: true, defecto: true, obtenerValor: (p) => p.periodo },
  { clave: 'impresiones', etiqueta: 'Impresiones', defecto: true, formato: formatoNumero, obtenerValor: (p) => p.impresiones },
  { clave: 'gasto', etiqueta: 'Gasto', defecto: true, formato: formatoDinero, obtenerValor: (p) => p.gasto },
  { clave: 'solicitantes', etiqueta: 'Solicitantes', defecto: true, formato: formatoNumero, obtenerValor: (p) => p.solicitantes },
  { clave: 'costo_por_solicitud', etiqueta: 'Costo/solicitud', defecto: true, formato: formatoDineroPreciso, obtenerValor: (p) => p.costo_por_solicitud },
  { clave: 'contrataciones', etiqueta: 'Contrataciones', defecto: true, formato: (v) => formatoNumero(v), obtenerValor: (p) => p.contrataciones?.length ?? 0 },
  { clave: 'clics_enlace', etiqueta: 'Clics al enlace', formato: formatoNumero, obtenerValor: (p) => p.clics_enlace },
  { clave: 'clics_todos', etiqueta: 'Clics (todos)', formato: formatoNumero, obtenerValor: (p) => p.clics_todos },
  { clave: 'resultados', etiqueta: 'Resultados', formato: formatoNumero, obtenerValor: (p) => p.resultados },
  { clave: 'alcance', etiqueta: 'Alcance', formato: (v) => (v != null ? formatoNumero(v) : '—'), obtenerValor: (p) => p.alcance },
  { clave: 'frecuencia', etiqueta: 'Frecuencia', formato: (v) => formatoDecimal(v, 2), obtenerValor: (p) => p.frecuencia },
  { clave: 'cpm', etiqueta: 'CPM', formato: formatoDineroPreciso, obtenerValor: (p) => p.cpm },
  { clave: 'tasa_conversion', etiqueta: 'Conv. clic→solicitud', formato: formatoPorcentaje, obtenerValor: (p) => p.tasa_conversion },
]

const CLAVES_DEFECTO = new Set(COLUMNAS_DISPONIBLES.filter((c) => c.defecto).map((c) => c.clave))

function calcularTotales(filas) {
  const sum = (campo) => filas.reduce((s, p) => s + (p[campo] ?? 0), 0)
  const totalImpresiones = sum('impresiones')
  const totalClicsEnlace = sum('clics_enlace')
  const totalGasto = sum('gasto')
  const totalSolicitantes = sum('solicitantes')
  const totalContrataciones = filas.reduce((s, p) => s + (p.contrataciones?.length ?? 0), 0)

  return {
    impresiones: totalImpresiones,
    clics_enlace: totalClicsEnlace,
    clics_todos: sum('clics_todos'),
    gasto: totalGasto,
    resultados: sum('resultados'),
    // alcance y frecuencia no se suman entre periodos -- Meta deduplica el
    // alcance por rango, sumarlo entre dias infla el numero.
    alcance: null,
    frecuencia: null,
    cpm: totalImpresiones ? (totalGasto / totalImpresiones) * 1000 : null,
    solicitantes: totalSolicitantes,
    costo_por_solicitud: totalSolicitantes ? totalGasto / totalSolicitantes : null,
    tasa_conversion: totalClicsEnlace ? (totalSolicitantes / totalClicsEnlace) * 100 : null,
    contrataciones: totalContrataciones,
  }
}

function detalleContrataciones(p) {
  if (!p.contrataciones?.length) return undefined
  return p.contrataciones
    .map((c) => `${c.nombre} (${formatoDinero(c.costo_estimado)})${c.fecha_solicitud ? ` — solicitó ${formatoFecha(c.fecha_solicitud)}` : ''}`)
    .join('; ')
}

export default function TablaDatos({ puntos, granularidad }) {
  const [columnasVisibles, setColumnasVisibles] = useState(CLAVES_DEFECTO)
  const columnas = COLUMNAS_DISPONIBLES.filter((c) => columnasVisibles.has(c.clave))

  const {
    filas, orden, alternarOrden, filtros, establecerFiltro, valoresDistintos,
    totalFiltrado, totalOriginal,
  } = useTablaFiltroOrden(puntos, columnas)

  // El total del rango honra el filtro de columna activo -- igual que
  // SUBTOTAL() en Excel, que solo suma las filas visibles.
  const totales = useMemo(() => calcularTotales(filas), [filas])

  function alAlternarColumna(clave) {
    setColumnasVisibles((s) => {
      const copia = new Set(s)
      if (copia.has(clave)) copia.delete(clave)
      else copia.add(clave)
      return copia
    })
  }

  return (
    <details className="tabla-alterna">
      <summary>
        Ver como tabla ({totalFiltrado} periodo{totalFiltrado === 1 ? '' : 's'}
        {totalFiltrado !== totalOriginal ? ` de ${totalOriginal}` : ''})
      </summary>

      <div className="tabla-barra">
        <SelectorColumnas
          columnas={COLUMNAS_DISPONIBLES}
          visibles={columnasVisibles}
          alAlternar={alAlternarColumna}
        />
      </div>

      <div className="tabla-scroll">
        <table className="datos">
          <thead>
            <tr>
              {columnas.map((col) => (
                <EncabezadoFiltrable
                  key={col.clave}
                  clave={col.clave}
                  etiqueta={col.etiqueta}
                  alinear={col.alinear}
                  ordenActual={orden}
                  alOrdenar={alternarOrden}
                  valores={valoresDistintos[col.clave] ?? []}
                  filtroActivo={filtros[col.clave]}
                  alFiltrar={establecerFiltro}
                  formato={col.clave === 'periodo' ? (v) => formatoPeriodo(v, granularidad) : col.formato}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td className="alinear-izq" colSpan={columnas.length}>Ningún periodo coincide con los filtros de columna.</td>
              </tr>
            )}
            {filas.map((p) => {
              const tieneContratacion = p.contrataciones?.length > 0
              return (
                <tr key={p.periodo} className={tieneContratacion ? 'fila-contratacion' : undefined}>
                  {columnas.map((col) => {
                    if (col.clave === 'periodo') {
                      return (
                        <td key={col.clave} className="alinear-izq">
                          {tieneContratacion && <span className="marca-fila" title="Hubo contratación en este periodo">▼ </span>}
                          {formatoPeriodo(p.periodo, granularidad)}
                        </td>
                      )
                    }
                    if (col.clave === 'contrataciones') {
                      return (
                        <td key={col.clave} title={detalleContrataciones(p)}>
                          <span className="pastilla-cifra">{formatoNumero(p.contrataciones?.length ?? 0)}</span>
                        </td>
                      )
                    }
                    const valor = col.formato(p[col.clave])
                    return (
                      <td key={col.clave}>
                        {col.defecto ? <span className="pastilla-cifra">{valor}</span> : valor}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="fila-total">
              {columnas.map((col) => {
                if (col.clave === 'periodo') return <td key={col.clave} className="alinear-izq">Total del rango</td>
                const formato = col.clave === 'periodo' ? null : col.formato
                return <td key={col.clave}>{formato ? formato(totales[col.clave]) : (totales[col.clave] ?? '—')}</td>
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="tabla-nota">
        Pasa el mouse sobre un número de la columna Contrataciones para ver el detalle (nombre, costo y fecha de solicitud).
      </p>
    </details>
  )
}
