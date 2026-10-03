import { useEffect, useMemo, useState } from 'react'
import Filtros from '../componentes/Filtros'
import TablaDatos from '../componentes/TablaDatos'
import TarjetasResumen, { resumenContrataciones } from '../componentes/TarjetasResumen'
import RankingSucursales from '../componentes/RankingSucursales'
import PanelLateralFijo from '../componentes/PanelLateralFijo'
import GraficaLinea from '../graficas/GraficaLinea'
import GraficaBarras from '../graficas/GraficaBarras'
import GraficaIndexada from '../graficas/GraficaIndexada'
import { obtenerSucursales, obtenerMetricas, obtenerRankingSucursales } from '../api'
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
    obtenerSucursales()
      .then((lista) => {
        setSucursales(lista)
        if (lista.length) setSucursal((s) => s || lista[0])
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
              : <div className="tarjeta-vacia">Cargando…</div>}
          </div>

          <div className="tarjeta">
            <h2>Solicitantes</h2>
            <p className="subt">Por {granularidad} · {sucursal || '—'}</p>
            {puntos.length > 0
              ? <GraficaBarras puntos={puntos} campo="solicitantes" granularidad={granularidad} />
              : <div className="tarjeta-vacia">Cargando…</div>}
          </div>

          <div className="tarjeta">
            <h2>Meta vs. solicitantes — % de su propio máximo</h2>
            <p className="subt">Por {granularidad} · {sucursal || '—'} · comparación en una sola escala, no en pesos ni conteos</p>
            {puntos.length > 0
              ? <GraficaIndexada puntos={puntos} campoMetrica={metrica} etiquetaMetrica={metricaActual?.etiqueta} granularidad={granularidad} />
              : <div className="tarjeta-vacia">Cargando…</div>}
          </div>

          {puntos.length > 0 && <TablaDatos puntos={puntos} granularidad={granularidad} />}

          <p className="pie">
            ▼ marca el día en que se llenó una vacante (registro de nómina, no de la
            solicitud); △ marca el día en que esa misma persona había enviado su
            solicitud — el otro extremo del mismo viaje, casi siempre semanas antes.
            El costo mostrado en ▼ es el gasto de Meta durante la ventana que
            ese folio estuvo abierto — puede salir en $0 si se cubrió sin
            publicidad corriendo, o repetirse entre dos contrataciones si sus
            ventanas se traslapan. La tarjeta «Costo por contratación» de arriba
            usa la versión agregada (gasto total del rango ÷ contrataciones del
            rango) para evitar ese traslape. Ninguno de los dos marcadores incluye
            Corporativo ni reasignaciones internas.
            <br />
            «Tasa de contratación» compara contrataciones y solicitantes del
            mismo rango, no si esos solicitantes en particular fueron quienes se
            contrataron — una contratación suele tardar días o semanas después
            de la solicitud, así que es una relación del periodo, no de cohorte.
            <br />
            El alcance y la frecuencia solo se muestran a nivel día: Meta
            deduplica el alcance por rango, sumarlo entre días infla el número.
            Dos campañas que corrieron en Meta no tienen sucursal asignada en el
            diccionario, así que no se pueden atribuir y quedan fuera de este
            cruce. Cerro Azul todavía no tiene ninguna campaña registrada: su
            sucursal existe y recibe solicitudes, pero nunca se le ha pagado
            publicidad.
          </p>
        </div>

        <PanelLateralFijo>
          <RankingSucursales ranking={ranking} sucursalActual={sucursal} onSeleccionar={setSucursal} />
        </PanelLateralFijo>
      </div>
    </>
  )
}
