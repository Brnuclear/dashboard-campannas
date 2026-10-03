import { useEffect, useMemo, useState } from 'react'
import FiltrosCampana from '../componentes/FiltrosCampana'
import TarjetasResumenCampana, { resumenCampana } from '../componentes/TarjetasResumenCampana'
import RankingCampanas from '../componentes/RankingCampanas'
import PanelLateralFijo from '../componentes/PanelLateralFijo'
import MatrizDecision from '../componentes/MatrizDecision'
import TablaDecisionCampanas from '../componentes/TablaDecisionCampanas'
import GraficaLinea from '../graficas/GraficaLinea'
import GraficaBarras from '../graficas/GraficaBarras'
import GraficaIndexada from '../graficas/GraficaIndexada'
import {
  obtenerSucursales, obtenerRangoCampanas, obtenerCampanas,
  obtenerMetricasCampana, obtenerRankingCampanas, obtenerDecisionCampanas,
} from '../api'
import { formatoFecha } from '../graficas/escalas'
import { METRICAS_FB, conMetricasDerivadas } from '../configMetricas'

export default function VistaCampana() {
  const [sucursales, setSucursales] = useState([])
  const [sucursalFiltro, setSucursalFiltro] = useState('Todas')
  const [campanas, setCampanas] = useState([])
  const [campana, setCampana] = useState('')
  const [granularidad, setGranularidad] = useState('dia')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [metrica, setMetrica] = useState('impresiones')
  const [datos, setDatos] = useState(null)
  const [ranking, setRanking] = useState(null)
  const [decision, setDecision] = useState(null)
  const [error, setError] = useState(null)

  // Rango por omision de esta pestana: la fecha de inicio mas antigua de
  // TODO el diccionario de campanas, hasta el ultimo dia con dato real de
  // Facebook -- no depende de cual campana se elija despues.
  useEffect(() => {
    obtenerRangoCampanas()
      .then(({ desde: d, hasta: h }) => {
        if (d) setDesde(d)
        if (h) setHasta(h)
      })
      .catch((e) => setError(e.message))
    obtenerSucursales().then(setSucursales).catch((e) => setError(e.message))
  }, [])

  // La lista de campanas depende del filtro de sucursal. Si la campana
  // que estaba elegida ya no aparece en la lista nueva (cambiaste de
  // sucursal), se pasa a la primera disponible en vez de dejar elegida
  // una campana que ya no calza con el filtro.
  useEffect(() => {
    obtenerCampanas(sucursalFiltro)
      .then((lista) => {
        setCampanas(lista)
        setCampana((actual) => (lista.some((c) => c.nombre_campana === actual) ? actual : (lista[0]?.nombre_campana ?? '')))
      })
      .catch((e) => setError(e.message))
  }, [sucursalFiltro])

  useEffect(() => {
    if (!campana || !desde || !hasta) return
    obtenerMetricasCampana({ campana, granularidad, desde, hasta })
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [campana, granularidad, desde, hasta])

  // El ranking compara TODAS las campanas entre si, no solo la elegida --
  // no depende de sucursalFiltro/campana, solo del rango de fechas.
  useEffect(() => {
    if (!desde || !hasta) return
    obtenerRankingCampanas({ desde, hasta })
      .then(setRanking)
      .catch((e) => setError(e.message))
  }, [desde, hasta])

  // El marco de decision tambien evalua TODAS las campanas activas hoy,
  // no solo la elegida en el filtro.
  useEffect(() => {
    if (!desde || !hasta) return
    obtenerDecisionCampanas({ desde, hasta })
      .then(setDecision)
      .catch((e) => setError(e.message))
  }, [desde, hasta])

  // Mismo motivo que en la vista por sucursal: alcance/frecuencia solo
  // son exactos por dia.
  useEffect(() => {
    if (granularidad !== 'dia' && (metrica === 'alcance' || metrica === 'frecuencia')) setMetrica('impresiones')
  }, [granularidad, metrica])

  const puntos = useMemo(() => conMetricasDerivadas(datos?.puntos ?? []), [datos])
  const metricaActual = METRICAS_FB.find((m) => m.campo === metrica)
  const info = datos?.campana
  const resumen = useMemo(() => resumenCampana(puntos, info, desde, hasta), [puntos, info, desde, hasta])

  // Saltar a una campana desde el ranking: se pone el filtro de sucursal
  // en "Todas" para garantizar que la campana elegida siempre aparezca en
  // el selector, sin importar en que sucursal estuviera filtrado antes.
  function irACampana(nombreCampana) {
    setSucursalFiltro('Todas')
    setCampana(nombreCampana)
  }

  return (
    <>
      <FiltrosCampana
        sucursales={sucursales}
        sucursalFiltro={sucursalFiltro}
        onSucursalFiltro={setSucursalFiltro}
        campanas={campanas}
        campana={campana}
        onCampana={setCampana}
        granularidad={granularidad}
        onGranularidad={setGranularidad}
        desde={desde}
        hasta={hasta}
        onDesde={setDesde}
        onHasta={setHasta}
      />

      {error && <p style={{ color: 'var(--critico-texto, #b52121)' }}>{error}</p>}

      {!campana && !error && (
        <p className="tarjeta-vacia" style={{ height: 'auto', padding: '20px 0' }}>
          Esta sucursal no tiene campañas registradas en el diccionario.
        </p>
      )}

      <div className="campana-layout">
        <div className="campana-principal">
          {campana && (
            <>
              {info && (
                <p className="campanas-resumen">
                  <strong>{info.nombre_campana}</strong> · {info.sucursal} · {info.puesto} · {formatoFecha(info.fecha_inicio)}
                  {' – '}{info.fecha_fin ? formatoFecha(info.fecha_fin) : 'hoy'}
                </p>
              )}

              {puntos.length > 0 && <TarjetasResumenCampana resumen={resumen} />}

              <div className="tarjeta">
                <h2>Meta — {metricaActual?.etiqueta}</h2>
                <p className="subt">Por {granularidad}</p>
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
                  : <div className="tarjeta-vacia">Cargando…</div>}
              </div>

              <div className="tarjeta">
                <h2>Solicitantes</h2>
                <p className="subt">Por {granularidad}</p>
                {puntos.length > 0
                  ? <GraficaBarras puntos={puntos} campo="solicitantes" granularidad={granularidad} />
                  : <div className="tarjeta-vacia">Cargando…</div>}
              </div>

              <div className="tarjeta">
                <h2>Meta vs. solicitantes — % de su propio máximo</h2>
                <p className="subt">Por {granularidad} · comparación en una sola escala, no en pesos ni conteos</p>
                {puntos.length > 0
                  ? <GraficaIndexada puntos={puntos} campoMetrica={metrica} etiquetaMetrica={metricaActual?.etiqueta} granularidad={granularidad} />
                  : <div className="tarjeta-vacia">Cargando…</div>}
              </div>

              <p className="pie">
                Solicitantes y contrataciones se cuentan solo dentro de la ventana real
                de esta campaña (fecha de inicio hasta fecha de fin, o hoy si sigue
                corriendo) — aunque el filtro de fechas de arriba sea más amplio. El
                costo por contratación usa únicamente el gasto de <strong>esta</strong>{' '}
                campaña, no el de toda la sucursal — distinto de la vista por sucursal,
                donde una contratación puede sumar el gasto de varias campañas que
                coincidieron en el tiempo. ▼ marca contratación, △ marca la solicitud
                de quien después se contrató. No incluye Corporativo ni reasignaciones
                internas.
              </p>
            </>
          )}

          <TablaDecisionCampanas filas={decision?.filas ?? []} medianas={decision?.medianas} />
          <MatrizDecision />
        </div>

        <PanelLateralFijo>
          <RankingCampanas ranking={ranking} campanaActual={campana} onSeleccionar={irACampana} />
        </PanelLateralFijo>
      </div>
    </>
  )
}
