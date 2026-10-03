import { formatoDinero, formatoDineroPreciso, formatoNumero, formatoPorcentaje } from '../graficas/escalas'
import { useTablaFiltroOrden } from './tabla/useTablaFiltroOrden'
import EncabezadoFiltrable from './tabla/EncabezadoFiltrable'

const formatoDineroOGuion = (v) => (v != null ? formatoDineroPreciso(v) : '—')
const formatoPorcentajeOGuion = (v) => (v != null ? formatoPorcentaje(v) : '—')

const COLUMNAS = [
  { clave: 'decision_etiqueta', etiqueta: 'Decisión', alinear: 'izquierda', obtenerValor: (f) => f.decision_etiqueta },
  { clave: 'nombre_campana', etiqueta: 'Campaña', alinear: 'izquierda', obtenerValor: (f) => f.nombre_campana },
  { clave: 'sucursal', etiqueta: 'Sucursal', alinear: 'izquierda', obtenerValor: (f) => f.sucursal },
  { clave: 'puesto', etiqueta: 'Puesto', alinear: 'izquierda', obtenerValor: (f) => f.puesto },
  { clave: 'cpa', etiqueta: 'CPA', obtenerValor: (f) => f.cpa, formato: formatoDineroOGuion },
  { clave: 'solicitantes', etiqueta: 'Solicitantes', obtenerValor: (f) => f.solicitantes, formato: formatoNumero },
  { clave: 'contrataciones', etiqueta: 'Contrataciones', obtenerValor: (f) => f.contrataciones, formato: formatoNumero },
  { clave: 'conv_clic_solicitud', etiqueta: 'Conv. clic→solicitud', obtenerValor: (f) => f.conv_clic_solicitud, formato: formatoPorcentajeOGuion },
  { clave: 'tasa_contratacion', etiqueta: 'Tasa de contratación', obtenerValor: (f) => f.tasa_contratacion, formato: formatoPorcentajeOGuion },
  { clave: 'dias_activa', etiqueta: 'Días activa', obtenerValor: (f) => f.dias_activa, formato: formatoNumero },
  {
    clave: 'tiene_vacante_activa', etiqueta: 'Vacante activa', alinear: 'izquierda',
    obtenerValor: (f) => f.tiene_vacante_activa, formato: (v) => (v ? 'Sí' : 'No'),
  },
]

export default function TablaDecisionCampanas({ filas: filasEntrada, medianas }) {
  const {
    filas, orden, alternarOrden, filtros, establecerFiltro, valoresDistintos,
    totalFiltrado, totalOriginal,
  } = useTablaFiltroOrden(filasEntrada, COLUMNAS)

  return (
    <div className="tarjeta">
      <h2>Decisión recomendada por campaña</h2>
      <p className="subt">
        Solo campañas actualmente activas (sin fecha de fin, o que termina hoy o después) — una campaña
        ya terminada no tiene ninguna decisión pendiente. {totalFiltrado} campaña{totalFiltrado === 1 ? '' : 's'}
        {totalFiltrado !== totalOriginal ? ` de ${totalOriginal}` : ''}.
      </p>

      {medianas && (
        <p className="campanas-resumen">
          Medianas del cohorte usadas como umbral: CPA <strong>{formatoDineroOGuion(medianas.cpa)}</strong> ·
          {' '}conversión clic→solicitud <strong>{formatoPorcentajeOGuion(medianas.conv_clic_solicitud)}</strong> ·
          {' '}solicitantes <strong>{medianas.solicitantes ?? '—'}</strong> ·
          {' '}tasa de contratación <strong>{formatoPorcentajeOGuion(medianas.tasa_contratacion)}</strong>
        </p>
      )}

      {filasEntrada.length === 0 ? (
        <p className="tarjeta-vacia" style={{ height: 'auto', padding: '20px 0' }}>
          No hay campañas activas hoy para evaluar.
        </p>
      ) : (
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
                <th className="alinear-izq">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td className="alinear-izq" colSpan={COLUMNAS.length + 1}>Ninguna campaña coincide con los filtros de columna.</td>
                </tr>
              )}
              {filas.map((f) => (
                <tr key={f.nombre_campana}>
                  <td className="alinear-izq">
                    <span className={`pastilla-decision ${f.decision_color}`}>{f.decision_etiqueta}</span>
                  </td>
                  <td className="alinear-izq">{f.nombre_campana}</td>
                  <td className="alinear-izq">{f.sucursal}</td>
                  <td className="alinear-izq">{f.puesto}</td>
                  <td>{formatoDineroOGuion(f.cpa)}</td>
                  <td>{formatoNumero(f.solicitantes)}</td>
                  <td>{formatoNumero(f.contrataciones)}</td>
                  <td>{formatoPorcentajeOGuion(f.conv_clic_solicitud)}</td>
                  <td>{formatoPorcentajeOGuion(f.tasa_contratacion)}</td>
                  <td>{formatoNumero(f.dias_activa)}</td>
                  <td className="alinear-izq">{f.tiene_vacante_activa ? 'Sí' : 'No'}</td>
                  <td className="alinear-izq col-motivo">{f.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
