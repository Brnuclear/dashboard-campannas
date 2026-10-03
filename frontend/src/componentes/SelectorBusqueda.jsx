import { useEffect, useRef, useState } from 'react'

// Reemplaza un <select> nativo cuando la lista de opciones es larga (o
// puede crecer, como la de campanas) -- un <select> nativo no ofrece mas
// busqueda que "saltar al primero que empiece con la tecla presionada".
// Aqui se abre un panel con un campo de texto que filtra la lista por
// coincidencia de subcadena, mas navegacion con flechas/Enter/Escape.
export default function SelectorBusqueda({
  id, valor, opciones, onCambio, placeholder = 'Buscar…', marcadorVacio = 'Sin opciones',
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const raizRef = useRef(null)
  const entradaRef = useRef(null)

  const filtradas = opciones.filter((o) => o.toLowerCase().includes(busqueda.toLowerCase()))

  useEffect(() => {
    if (!abierto) return
    setBusqueda('')
    const i = opciones.indexOf(valor)
    setResaltado(i >= 0 ? i : 0)
    // el campo de busqueda se enfoca al abrir -- es el punto de entrada
    // para teclear, no el boton que abrio el panel.
    const t = setTimeout(() => entradaRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!abierto) return
    function alClicFuera(e) {
      if (raizRef.current && !raizRef.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  function elegir(op) {
    onCambio(op)
    setAbierto(false)
  }

  function alTeclear(e) {
    if (e.key === 'Escape') {
      setAbierto(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setResaltado((r) => Math.min(filtradas.length - 1, r + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((r) => Math.max(0, r - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtradas[resaltado] != null) elegir(filtradas[resaltado])
    }
  }

  return (
    <div className="selector-busqueda" ref={raizRef}>
      <button
        id={id}
        type="button"
        className="selector-busqueda-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span>{valor || marcadorVacio}</span>
        <span className="selector-busqueda-flecha" aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div className="selector-busqueda-panel">
          <input
            ref={entradaRef}
            type="text"
            value={busqueda}
            placeholder={placeholder}
            onChange={(e) => { setBusqueda(e.target.value); setResaltado(0) }}
            onKeyDown={alTeclear}
          />
          <ul role="listbox">
            {filtradas.length === 0 && <li className="selector-busqueda-vacio">{marcadorVacio}</li>}
            {filtradas.map((op, i) => (
              <li key={op} role="option" aria-selected={op === valor}>
                <button
                  type="button"
                  className={i === resaltado ? 'resaltada' : undefined}
                  onMouseEnter={() => setResaltado(i)}
                  onClick={() => elegir(op)}
                >
                  {op}
                  {op === valor && <span className="selector-busqueda-check" aria-hidden="true">✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
