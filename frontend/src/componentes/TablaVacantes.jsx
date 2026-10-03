import { formatoFecha } from '../graficas/escalas'
import { useTablaFiltroOrden } from './tabla/useTablaFiltroOrden'
import EncabezadoFiltrable from './tabla/EncabezadoFiltrable'

const ESTATUS_ETIQUETA = {
  activa: 'Activa',
  cubierta: 'Cubierta',
  reasignacion: 'Reasignación',
}

const formatoFechaOGuion = (v) => (v ? formatoFecha(v) : '—')

const COLUMNAS = [
  { clave: 'folio', etiqueta: 'Folio', alinear: 'izquierda', obtenerValor: (f) => f.folio },
  { clave: 'sucursal', etiqueta: 'Sucursal', alinear: 'izquierda', obtenerValor: (f) => f.sucursal },
  { clave: 'puesto', etiqueta: 'Puesto', alinear: 'izquierda', obtenerValor: (f) => f.puesto },
  {
    clave: 'estatus', etiqueta: 'Estatus', alinear: 'izquierda',
    obtenerValor: (f) => f.estatus, formato: (v) => ESTATUS_ETIQUETA[v] ?? v,
  },
  { clave: 'dias_abierta', etiqueta: 'Días abierta', alinear: 'derecha', obtenerValor: (f) => f.dias_abierta },
  { clave: 'fecha_apertura', etiqueta: 'Apertura', alinear: 'izquierda', obtenerValor: (f) => f.fecha_apertura, formato: formatoFechaOGuion },
  { clave: 'fecha_solicitud', etiqueta: 'Solicitud', alinear: 'izquierda', obtenerValor: (f) => f.fecha_solicitud, formato: formatoFechaOGuion },
  { clave: 'fecha_ingreso', etiqueta: 'Ingreso', alinear: 'izquierda', obtenerValor: (f) => f.fecha_ingreso, formato: formatoFechaOGuion },
  { clave: 'nombre_alta', etiqueta: 'Contratado/a', alinear: 'izquierda', obtenerValor: (f) => f.nombre_alta },
  { clave: 'baja', etiqueta: 'Vacante por baja de', alinear: 'izquierda', obtenerValor: (f) => f.baja?.texto ?? null },
]

export default function TablaVacantes({ filas: filasEntrada }) {
  const {
    filas, orden, alternarOrden, filtros, establecerFiltro, valoresDistintos,
    totalFiltrado, totalOriginal,
  } = useTablaFiltroOrden(filasEntrada, COLUMNAS)

  if (filasEntrada.length === 0) {
    return (
      <p className="tarjeta-vacia" style={{ height: 'auto', padding: '20px 0' }}>
        No hay vacantes con este filtro.
      </p>
    )
  }

  return (
    <div className="tarjeta">
      <h2>Vacantes</h2>
      <p className="subt">
        {totalFiltrado} folio{totalFiltrado === 1 ? '' : 's'}
        {totalFiltrado !== totalOriginal ? ` de ${totalOriginal} (con filtro de columna activo)` : ''}
      </p>
      <div className="tabla-scroll">
        <table className="datos">
          <thead>
            <tr>
              {COLUMNAS.map((col) => (
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
                  formato={col.formato}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td className="alinear-izq" colSpan={COLUMNAS.length}>Ningún folio coincide con los filtros de columna.</td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.folio}>
                <td className="alinear-izq">{f.folio}</td>
                <td className="alinear-izq">{f.sucursal}</td>
                <td className="alinear-izq">{f.puesto}</td>
                <td className="alinear-izq">
                  <span className={`pastilla-estatus ${f.estatus}`}>{ESTATUS_ETIQUETA[f.estatus]}</span>
                </td>
                <td>{f.dias_abierta != null ? <span className="pastilla-cifra">{f.dias_abierta}</span> : '—'}</td>
                <td className="alinear-izq">{formatoFechaOGuion(f.fecha_apertura)}</td>
                <td className="alinear-izq">{formatoFechaOGuion(f.fecha_solicitud)}</td>
                <td className="alinear-izq">{formatoFechaOGuion(f.fecha_ingreso)}</td>
                <td className="alinear-izq">{f.nombre_alta ?? '—'}</td>
                <td className="alinear-izq">
                  {f.baja
                    ? (f.baja.es_persona
                        ? f.baja.texto
                        : <span className="etiqueta-baja-especial">{f.baja.texto}</span>)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
