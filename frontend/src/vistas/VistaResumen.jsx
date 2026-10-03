import { useEffect, useMemo, useState } from 'react'
import VeredictoGeneral from '../componentes/VeredictoGeneral'
import EmbudoGeneral from '../componentes/EmbudoGeneral'
import TarjetasEconomia from '../componentes/TarjetasEconomia'
import SenalesGenerales from '../componentes/SenalesGenerales'
import GraficaLinea from '../graficas/GraficaLinea'
import GraficaBarras from '../graficas/GraficaBarras'
import GraficaIndexada from '../graficas/GraficaIndexada'
import { obtenerResumen } from '../api'
import { formatoNumero } from '../graficas/escalas'
import { METRICAS_FB, conMetricasDerivadas, hoyISO, haceDiasISO } from '../configMetricas'

// Atajos de rango. "Últimos 30 días" es el que trae la pestaña al abrir:
// un mes es el periodo mas corto en el que una campana de reclutamiento
// alcanza a producir solicitudes Y contrataciones, asi que es el rango
// mas corto en el que el embudo completo dice algo.
//
// haceDiasISO(29), no 30: el rango incluye hoy, asi que hoy menos 29 dias
// son 30 dias contando ambos extremos. Con 30 saldrian 31 y la
// comparacion contra "el periodo anterior de la misma longitud" se
// desalinearia con el mes calendario que la gente tiene en la cabeza.
const RANGOS = [
  { dias: 30, etiqueta: '30 días' },
  { dias: 60, etiqueta: '60 días' },
  { dias: 90, etiqueta: '90 días' },
]

export default function VistaResumen() {
  const [desde, setDesde] = useState(haceDiasISO(29))
  const [hasta, setHasta] = useState(hoyISO())
  const [metrica, setMetrica] = useState('impresiones')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!desde || !hasta) return
    setError(null)
    obtenerResumen({ desde, hasta })
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [desde, hasta])

  function aplicarRango(dias) {
    setDesde(haceDiasISO(dias - 1))
    setHasta(hoyISO())
  }

  // Mismo motivo que en las otras pestañas: alcance y frecuencia solo
  // son exactos por día, porque Meta deduplica el alcance por rango.
  // Con un rango largo el backend agrupa por semana y esas dos métricas
  // dejan de estar disponibles.
  const granularidad = datos?.granularidad ?? 'dia'
  useEffect(() => {
    if (granularidad !== 'dia' && (metrica === 'alcance' || metrica === 'frecuencia')) {
      setMetrica('impresiones')
    }
  }, [granularidad, metrica])

  const puntos = useMemo(() => conMetricasDerivadas(datos?.puntos ?? []), [datos])
  const metricaActual = METRICAS_FB.find((m) => m.campo === metrica)
  const diasSeleccionados = datos?.dias

  // Cuántos de los rangos rápidos corresponde al que está puesto: sirve
  // para marcar el botón activo sin guardar estado duplicado.
  const rangoActivo = RANGOS.find((r) => r.dias === diasSeleccionados && hasta === hoyISO())

  return (
    <>
      <div className="filtros">
        <div className="filtro-grupo">
          <label>Periodo</label>
          <div className="segmentado" role="group" aria-label="Rango rápido">
            {RANGOS.map((r) => (
              <button
                key={r.dias}
                type="button"
                aria-pressed={rangoActivo?.dias === r.dias}
                onClick={() => aplicarRango(r.dias)}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="filtro-grupo">
          <label htmlFor="r-desde">Desde</label>
          <input id="r-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>

        <div className="filtro-grupo">
          <label htmlFor="r-hasta">Hasta</label>
          <input id="r-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--critico-texto, #b52121)' }}>{error}</p>}

      {!datos && !error && (
        <div className="tarjeta-vacia" style={{ height: 'auto', padding: '20px 0' }}>Cargando…</div>
      )}

      {datos && (
        <>
          <VeredictoGeneral
            veredicto={datos.veredicto}
            desde={datos.desde}
            hasta={datos.hasta}
            dias={datos.dias}
            comparacion={datos.comparacion}
          />

          <EmbudoGeneral embudo={datos.embudo} totales={datos.totales} anterior={datos.anterior} />

          <TarjetasEconomia
            totales={datos.totales}
            tasas={datos.tasas}
            vacantes={datos.vacantes}
            campanasActivas={datos.campanas_activas}
          />

          <div className="tarjeta">
            <h2>Meta — {metricaActual?.etiqueta}</h2>
            <p className="subt">Por {granularidad} · todas las campañas del diccionario, sumadas</p>
            <div className="chips">
              {METRICAS_FB.map((m) => (
                <button
                  key={m.campo}
                  type="button"
                  className="chip"
                  aria-pressed={metrica === m.campo}
                  disabled={m.soloDia && granularidad !== 'dia'}
                  title={m.soloDia && granularidad !== 'dia'
                    ? 'Depende del alcance, que solo es exacto por día: Meta lo deduplica por rango, no se puede sumar entre días.'
                    : undefined}
                  onClick={() => setMetrica(m.campo)}
                >
                  {m.etiqueta}
                </button>
              ))}
            </div>
            {puntos.length > 0
              ? <GraficaLinea puntos={puntos} campo={metrica} etiqueta={metricaActual?.etiqueta} formateador={metricaActual?.formateador} granularidad={granularidad} />
              : <div className="tarjeta-vacia">Sin datos de Meta en este periodo</div>}
          </div>

          <div className="tarjeta">
            <h2>Solicitudes</h2>
            <p className="subt">
              Por {granularidad} · todas las sucursales ·{' '}
              {formatoNumero(datos.totales.solicitudes_atribuibles)} de{' '}
              {formatoNumero(datos.totales.solicitudes)} cayeron en una sucursal y puesto
              con campaña corriendo ese día
            </p>
            {puntos.length > 0
              ? <GraficaBarras puntos={puntos} campo="solicitantes" granularidad={granularidad} />
              : <div className="tarjeta-vacia">Sin solicitudes en este periodo</div>}
          </div>

          <div className="tarjeta">
            <h2>Meta vs. solicitudes — % de su propio máximo</h2>
            <p className="subt">
              Por {granularidad} · dos escalas distintas puestas en una sola: cada serie
              contra su propio máximo del periodo, nunca dos ejes en la misma gráfica
            </p>
            {puntos.length > 0
              ? <GraficaIndexada puntos={puntos} campoMetrica={metrica} etiquetaMetrica={metricaActual?.etiqueta} granularidad={granularidad} />
              : <div className="tarjeta-vacia">Sin datos en este periodo</div>}
          </div>

          <SenalesGenerales senales={datos.senales} />
        </>
      )}
    </>
  )
}
