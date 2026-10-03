import { useEffect, useMemo, useState } from 'react'
import TarjetasResumenVacantes from '../componentes/TarjetasResumenVacantes'
import TablaVacantes from '../componentes/TablaVacantes'
import SelectorBusqueda from '../componentes/SelectorBusqueda'
import { obtenerVacantes } from '../api'

const ESTATUS_FILTROS = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'activa', etiqueta: 'Activas' },
  { valor: 'cubierta', etiqueta: 'Cubiertas' },
  { valor: 'reasignacion', etiqueta: 'Reasignaciones' },
]

export default function VistaVacantes() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [sucursalFiltro, setSucursalFiltro] = useState('Todas')
  const [estatusFiltro, setEstatusFiltro] = useState('todas')

  useEffect(() => {
    obtenerVacantes().then(setDatos).catch((e) => setError(e.message))
  }, [])

  const sucursales = useMemo(
    () => [...new Set((datos?.filas ?? []).map((f) => f.sucursal))].sort(),
    [datos],
  )

  const filasFiltradas = useMemo(() => {
    if (!datos) return []
    return datos.filas.filter((f) => {
      if (sucursalFiltro !== 'Todas' && f.sucursal !== sucursalFiltro) return false
      if (estatusFiltro !== 'todas' && f.estatus !== estatusFiltro) return false
      return true
    })
  }, [datos, sucursalFiltro, estatusFiltro])

  return (
    <>
      <div className="filtros">
        <div className="filtro-grupo">
          <label htmlFor="v-sucursal">Sucursal</label>
          <SelectorBusqueda
            id="v-sucursal"
            valor={sucursalFiltro}
            opciones={['Todas', ...sucursales]}
            onCambio={setSucursalFiltro}
            placeholder="Buscar sucursal…"
          />
        </div>

        <div className="filtro-grupo">
          <label>Estatus</label>
          <div className="segmentado" role="group" aria-label="Estatus de la vacante">
            {ESTATUS_FILTROS.map((o) => (
              <button
                key={o.valor}
                type="button"
                aria-pressed={estatusFiltro === o.valor}
                onClick={() => setEstatusFiltro(o.valor)}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'var(--critico-texto, #b52121)' }}>{error}</p>}

      {!datos && !error && (
        <div className="tarjeta-vacia" style={{ height: 'auto', padding: '20px 0' }}>Cargando…</div>
      )}

      {datos && (
        <>
          <TarjetasResumenVacantes resumen={datos.resumen} />
          <TablaVacantes filas={filasFiltradas} />
        </>
      )}
    </>
  )
}
