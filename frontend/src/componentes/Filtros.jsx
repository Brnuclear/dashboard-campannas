import SelectorBusqueda from './SelectorBusqueda'

const GRANULARIDADES = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
]

export default function Filtros({
  sucursales, sucursal, onSucursal,
  granularidad, onGranularidad,
  desde, hasta, onDesde, onHasta,
}) {
  return (
    <div className="filtros">
      <div className="filtro-grupo">
        <label htmlFor="f-sucursal">Sucursal</label>
        <SelectorBusqueda
          id="f-sucursal"
          valor={sucursal}
          opciones={sucursales}
          onCambio={onSucursal}
          placeholder="Buscar sucursal…"
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
        <label htmlFor="f-desde">Desde</label>
        <input id="f-desde" type="date" value={desde} onChange={(e) => onDesde(e.target.value)} />
      </div>

      <div className="filtro-grupo">
        <label htmlFor="f-hasta">Hasta</label>
        <input id="f-hasta" type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} />
      </div>
    </div>
  )
}
