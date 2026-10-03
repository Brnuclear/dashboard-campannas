import { formatoDinero, formatoPorcentaje } from '../graficas/escalas'

const TABLAS = [
  { clave: 'costo_por_contratacion', titulo: 'Menor costo por contratación', formato: formatoDinero },
  { clave: 'tasa_contratacion', titulo: 'Mejor tasa de contratación', formato: formatoPorcentaje },
  { clave: 'tasa_conversion_impresiones', titulo: 'Mejor conversión impresión→solicitud', formato: formatoPorcentaje },
]

// Solo devuelve el CONTENIDO del panel; quien lo llama lo envuelve con
// <PanelLateralFijo> (position:sticky, ver componentes/PanelLateralFijo.jsx).
export default function RankingCampanas({ ranking, campanaActual, onSeleccionar }) {
  if (!ranking) return null

  return (
    <>
      {TABLAS.map((t) => {
        const filas = ranking[t.clave] ?? []
        return (
          <div className="ranking-tabla" key={t.clave}>
            <h3>{t.titulo}</h3>
            {filas.length === 0 ? (
              <p className="ranking-vacio">Sin suficiente muestra en este rango.</p>
            ) : (
              <ol>
                {filas.map((f, i) => (
                  <li
                    key={f.nombre_campana}
                    className={f.nombre_campana === campanaActual ? 'activa' : undefined}
                  >
                    <button type="button" onClick={() => onSeleccionar(f.nombre_campana)}>
                      <span className="ranking-num">{i + 1}</span>
                      <span className="ranking-nombre" title={f.nombre_campana}>
                        {f.nombre_campana}
                        <span className="ranking-sucursal">{f.sucursal}</span>
                      </span>
                      <span className="ranking-valor">{t.formato(f.valor)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
      <p className="ranking-nota">
        Tasa de contratación y conversión impresión→solicitud solo cuentan campañas con
        3 o más solicitantes en el rango — con menos, un caso ya mueve el porcentaje
        entero.
      </p>
    </>
  )
}
