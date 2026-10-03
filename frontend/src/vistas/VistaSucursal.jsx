import { useEffect, useMemo, useState } from 'react'
import Filtros from '../componentes/Filtros'
import TablaDatos from '../componentes/TablaDatos'
import TarjetasResumen, { resumenContrataciones } from '../componentes/TarjetasResumen'
import RankingSucursales from '../componentes/RankingSucursales'
import PanelLateralFijo from '../componentes/PanelLateralFijo'
import GraficaLinea from '../graficas/GraficaLinea'
import GraficaBarras from '../graficas/GraficaBarras'
import GraficaIndexada from '../graficas/GraficaIndexada'
import { obtenerSucursales, obtenerCampanas, obtenerMetricas, obtenerRankingSucursales } from '../api'
import { formatoFecha } from '../graficas/escalas'
import { METRICAS_FB, conMetricasDerivadas, hoyISO, haceDiasISO } from '../configMetricas'

export default function VistaSucursal() {
  const [sucursales, setSucursales] = useState([])
  const [sucursal, setSucursal] = useState('')
  const [granularidad, setGranularidad] = useState('dia')
  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [metrica, setMetrica] = useState('impresiones')
  const [datos, setDatos] = useState(null)
  const [ranking, setRanking] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    obtenerSucursales().then(setSucursales).catch((e) => setError(e.message))

    // La sucursal de arranque NO es la primera de la lista: esa es la
    // primera alfabeticamente, y puede ser una que lleve meses sin
    // campana -- se entraria a la pestana con las tres graficas vacias
    // sin saber por que. Se arranca en la sucursal de la campana activa
    // mas reciente, que es la que con mas seguridad tiene algo que
    // ensenar en el rango por omision (los ultimos 30 dias).
    //
    // obtenerCampanas() ya viene ordenada por fecha de inicio
    // descendente, asi que la primera sin fecha de fin es justo esa.
    obtenerCampanas()
      .then((lista) => {
        const reciente = lista.find((c) => !c.fecha_fin) ?? lista[0]
        if (reciente) setSucursal((s) => s || reciente.sucursal)
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!sucursal) return
    obtenerMetricas({ sucursal, granularidad, desde, hasta })
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [sucursal, granularidad, desde, hasta])

  // El ranking compara TODAS las sucursales entre si, no solo la elegida
  // -- no depende de la sucursal seleccionada, solo del rango de fechas.
  useEffect(() => {
    if (!desde || !hasta) return
    obtenerRankingSucursales({ desde, hasta })
      .then(setRanking)
      .catch((e) => setError(e.message))
  }, [desde, hasta])

  // Alcance no se puede sumar por semana/mes (Meta lo deduplica solo
  // dentro de un rango pedido como tal); si el usuario tenia esa metrica
  // seleccionada y cambia de granularidad, se regresa a Impresiones en
  // vez de mostrar un chip activo que ya no aplica.
  useEffect(() => {
    if (granularidad !== 'dia' && metrica === 'alcance') setMetrica('impresiones')
  }, [granularidad, metrica])

  const puntos = useMemo(() => conMetricasDerivadas(datos?.puntos ?? []), [datos])
  // datos === null es "la peticion sigue en el aire"; datos con puntos
  // vacios es "esta sucursal no tuvo nada en este rango". Son cosas
  // distintas y el usuario tiene que poder distinguirlas.
  const cargando = datos === null
  const metricaActual = METRICAS_FB.find((m) => m.campo === metrica)
  const resumen = useMemo(() => resumenContrataciones(puntos), [puntos])

  return (
    <>
      <Filtros
        sucursales={sucursales}
        sucursal={sucursal}
        onSucursal={setSucursal}
        granularidad={granularidad}
        onGranularidad={setGranularidad}
        desde={desde}
        hasta={hasta}
        onDesde={setDesde}
        onHasta={setHasta}
      />

      {error && <p style={{ color: 'var(--critico-texto, #b52121)' }}>{error}</p>}

      <div className="campana-layout">
        <div className="campana-principal">
          {puntos.length > 0 && <TarjetasResumen resumen={resumen} />}

          <div className="tarjeta">
            <h2>Meta — {metricaActual?.etiqueta}</h2>
            <p className="subt">Por {granularidad} · {sucursal || '—'}</p>
            {datos?.campanas_rango?.length > 0 && (
              <p className="campanas-resumen">
                Campaña{datos.campanas_rango.length > 1 ? 's' : ''} en este rango:{' '}
                {datos.campanas_rango.map((c, i) => (
                  <span key={c.nombre_campana}>
                    {i > 0 && ', '}
                    <strong>{c.nombre_campana}</strong> ({formatoFecha(c.fecha_inicio)}
                    {' – '}{c.fecha_fin ? formatoFecha(c.fecha_fin) : 'hoy'})
                  </span>
                ))}
              </p>
            )}
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
              : <div className="tarjeta-vacia">
                  {cargando ? 'Cargando…' : 'Esta sucursal no tuvo campañas ni solicitudes en el rango seleccionado'}
                </div>}
          </div>

          <div className="tarjeta">
            <h2>Solicitantes</h2>
            <p className="subt">Por {granularidad} · {sucursal || '—'}</p>
            {puntos.length > 0
              ? <GraficaBarras puntos={puntos} campo="solicitantes" granularidad={granularidad} />
              : <div className="tarjeta-vacia">
                  {cargando ? 'Cargando…' : 'Sin solicitudes en este periodo'}
                </div>}
          </div>

          <div className="tarjeta">
            <h2>Meta vs. solicitantes — % de su propio máximo</h2>
            <p className="subt">Por {granularidad} · {sucursal || '—'} · comparación en una sola escala, no en pesos ni conteos</p>
            {puntos.length > 0
              ? <GraficaIndexada puntos={puntos} campoMetrica={metrica} etiquetaMetrica={metricaActual?.etiqueta} granularidad={granularidad} />
              : <div className="tarjeta-vacia">
                  {cargando ? 'Cargando…' : 'Sin datos que comparar en este periodo'}
                </div>}
          </div>

          {puntos.length > 0 && <TablaDatos puntos={puntos} granularidad={granularidad} />}
        </div>

        <PanelLateralFijo>
          <RankingSucursales ranking={ranking} sucursalActual={sucursal} onSeleccionar={setSucursal} />
        </PanelLateralFijo>
      </div>
    </>
  )
}
