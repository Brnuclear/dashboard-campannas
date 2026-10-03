import SelectorBusqueda from './SelectorBusqueda'

const GRANULARIDADES = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
]

export default function FiltrosCampana({
  sucursales, sucursalFiltro, onSucursalFiltro,
  campanas, campana, onCampana,
  granularidad, onGranularidad,
  desde, hasta, onDesde, onHasta,
}) {
  return (
    <div className="filtros">
      <div className="filtro-grupo">
        <label htmlFor="fc-sucursal">Sucursal</label>
        <SelectorBusqueda
          id="fc-sucursal"
          valor={sucursalFiltro}
          opciones={['Todas', ...sucursales]}
          onCambio={onSucursalFiltro}
          placeholder="Buscar sucursal…"
        />
      </div>

      <div className="filtro-grupo filtro-campana">
        <label htmlFor="fc-campana">Campaña</label>
        <SelectorBusqueda
          id="fc-campana"
          valor={campana}
          opciones={campanas.map((c) => c.nombre_campana)}
          onCambio={onCampana}
          placeholder="Buscar campaña…"
          marcadorVacio="Sin campañas en esta sucursal"
        />
      </div>

      <div className="filtro-grupo">
        <label>Agrupar por</label>
        <div className="segmentado" role="group" aria-label="Granularidad">
          {GRANULARIDADES.map((g) => (
            <button
              key={g.valor}
              type="button"
              aria-pressed={granularidad === g.valor}
              onClick={() => onGranularidad(g.valor)}
            >
              {g.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="filtro-grupo">
        <label htmlFor="fc-desde">Desde</label>
        <input id="fc-desde" type="date" value={desde} onChange={(e) => onDesde(e.target.value)} />
      </div>

      <div className="filtro-grupo">
        <label htmlFor="fc-hasta">Hasta</label>
        <input id="fc-hasta" type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} />
      </div>
    </div>
  )
}
