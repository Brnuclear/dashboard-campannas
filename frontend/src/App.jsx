import { useState } from 'react'
import VistaResumen from './vistas/VistaResumen'
import VistaSucursal from './vistas/VistaSucursal'
import VistaCampana from './vistas/VistaCampana'
import VistaVacantes from './vistas/VistaVacantes'

// 'resumen' va primero y es la pestana por omision: es la unica que
// contesta "como va esto" sin pedirle al que entra que elija una
// sucursal o una campana antes de ver nada. Las otras tres son para
// bajar al detalle una vez que el resumen dio la razon para bajar.
const PESTANAS = [
  { valor: 'resumen', etiqueta: 'Resumen' },
  { valor: 'sucursal', etiqueta: 'Por sucursal' },
  { valor: 'campana', etiqueta: 'Por campaña' },
  { valor: 'vacantes', etiqueta: 'Vacantes' },
]

export default function App() {
  const [vista, setVista] = useState('resumen')

  return (
    <div className="app">
      <header className="cabecera">
        {/* Marca generica: esta es la version de demostracion del
            tablero, sin identidad de la empresa. */}
        <svg className="cabecera-marca" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <rect x="3" y="17" width="5" height="10" rx="1.5" fill="var(--marca-medio)" />
          <rect x="11" y="10" width="5" height="17" rx="1.5" fill="var(--marca-fuerte)" />
          <rect x="19" y="4" width="5" height="23" rx="1.5" fill="var(--serie-solicitantes)" />
        </svg>
        <div>
          <h1>Campañas de Meta vs. solicitantes</h1>
          <p>Reclutamiento · tablero de demostración con datos generados</p>
        </div>
      </header>

      <div className="pestanas" role="tablist" aria-label="Vista del tablero">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={vista === p.valor}
            className={vista === p.valor ? 'activa' : undefined}
            onClick={() => setVista(p.valor)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {vista === 'resumen' && <VistaResumen />}
      {vista === 'sucursal' && <VistaSucursal />}
      {vista === 'campana' && <VistaCampana />}
      {vista === 'vacantes' && <VistaVacantes />}
    </div>
  )
}
