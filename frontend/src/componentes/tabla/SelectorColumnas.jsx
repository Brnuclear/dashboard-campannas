import { useEffect, useRef, useState } from 'react'

// Boton "Columnas (N/M)" que abre un checklist para mostrar/ocultar
// columnas de una tabla. `fija` marca las que no se pueden ocultar
// (tipicamente la primera columna, la que identifica cada fila).
export default function SelectorColumnas({ columnas, visibles, alAlternar }) {
  const [abierto, setAbierto] = useState(false)
  const raizRef = useRef(null)

  useEffect(() => {
    if (!abierto) return
    function alClicFuera(e) {
      if (raizRef.current && !raizRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  return (
    <div className="selector-columnas" ref={raizRef}>
      <button
        type="button"
        className="selector-columnas-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        Columnas ({visibles.size}/{columnas.length}) <span aria-hidden="true">▾</span>
      </button>
      {abierto && (
        <div className="selector-columnas-panel">
          <ul>
            {columnas.map((c) => (
              <li key={c.clave}>
                <label className={c.fija ? 'fija' : undefined}>
                  <input
                    type="checkbox"
                    checked={visibles.has(c.clave)}
                    disabled={c.fija}
                    onChange={() => alAlternar(c.clave)}
                  />
                  {c.etiqueta}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
