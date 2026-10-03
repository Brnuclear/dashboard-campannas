import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// <th> con dos controles independientes, como el encabezado de una tabla
// de Excel: clic en la etiqueta ordena; el boton ▾ abre un checklist de
// los valores distintos de la columna (con su propio buscador) para
// incluir/excluir filas -- no reemplaza el ordenamiento, se combinan.
//
// El panel se monta en document.body via portal, no dentro del <th>: la
// tabla vive dentro de .tabla-scroll (overflow:auto, para el scroll
// vertical de filas), y un panel absoluto anidado ahi adentro se recorta
// en el borde de ese contenedor -- por eso antes se veia cortado o
// aparecia "detras" del resto de la pagina. Con portal + position:fixed
// se posiciona con coordenadas de pantalla (getBoundingClientRect) y ya
// no lo recorta ningun ancestro con overflow.
export default function EncabezadoFiltrable({
  etiqueta, clave, alinear = 'derecha',
  ordenActual, alOrdenar,
  valores, filtroActivo, alFiltrar, formato = (v) => (v == null ? '—' : String(v)),
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState(new Set(filtroActivo ?? valores))
  const [posicion, setPosicion] = useState(null)
  const botonRef = useRef(null)
  const panelRef = useRef(null)
  const ajustadoRef = useRef(false)

  // El panel mide 220px fijos (ver .panel-filtro-columna en estilos.css).
  // Por default se alinea con el borde DERECHO del boton -- pero en una
  // columna cercana al borde izquierdo de la pantalla (p.ej. "Periodo",
  // la primera columna) eso deja al panel con left negativo, fuera de la
  // pantalla. Se calcula siempre en `left` y se acota entre 8px y
  // (ancho de ventana - 220 - 8px) para que quepa completo sin importar
  // en que columna se abra.
  const ANCHO_PANEL = 220
  const MARGEN = 8

  function recalcularPosicion() {
    const r = botonRef.current?.getBoundingClientRect()
    if (!r) return
    const izquierdaIdeal = r.right - ANCHO_PANEL
    const izquierdaMaxima = window.innerWidth - ANCHO_PANEL - MARGEN
    const left = Math.max(MARGEN, Math.min(izquierdaIdeal, izquierdaMaxima))
    setPosicion({ top: r.bottom + 4, left })
  }

  useEffect(() => {
    if (abierto) {
      setBusqueda('')
      setSeleccion(new Set(filtroActivo ?? valores))
      ajustadoRef.current = false
      recalcularPosicion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // El panel puede quedar mas alto que el hueco libre entre el boton y el
  // fondo de la ventana (tabla muy abajo en la pagina, o checklist larga).
  // Una vez montado, si se sale del viewport se sube lo justo para que
  // quede completo -- solo una vez por apertura, si no se dispara en bucle.
  useLayoutEffect(() => {
    if (!abierto || !posicion || ajustadoRef.current || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const exceso = rect.bottom - (window.innerHeight - 8)
    if (exceso > 0) {
      setPosicion((p) => ({ ...p, top: Math.max(8, p.top - exceso) }))
    }
    ajustadoRef.current = true
  }, [abierto, posicion])

  useEffect(() => {
    if (!abierto) return
    function alClicFuera(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target)
        && botonRef.current && !botonRef.current.contains(e.target)
      ) setAbierto(false)
    }
    // capture:true en scroll: el scroll de .tabla-scroll no burbujea hasta
    // window por si solo, pero un listener en captura si lo intercepta.
    document.addEventListener('mousedown', alClicFuera)
    window.addEventListener('scroll', recalcularPosicion, true)
    window.addEventListener('resize', recalcularPosicion)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      window.removeEventListener('scroll', recalcularPosicion, true)
      window.removeEventListener('resize', recalcularPosicion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const filtroEnUso = filtroActivo != null && filtroActivo.size < valores.length
  const visibles = valores.filter((v) => formato(v).toLowerCase().includes(busqueda.toLowerCase()))

  function alternarValor(v) {
    setSeleccion((s) => {
      const copia = new Set(s)
      if (copia.has(v)) copia.delete(v)
      else copia.add(v)
      return copia
    })
  }

  function aplicar() {
    alFiltrar(clave, seleccion.size === valores.length ? null : seleccion)
    setAbierto(false)
  }

  function limpiar() {
    alFiltrar(clave, null)
    setAbierto(false)
  }

  return (
    <th
      className={`th-columna th-ordenable ${alinear === 'izquierda' ? 'alinear-izq' : ''}`}
      aria-sort={ordenActual?.clave === clave ? (ordenActual.direccion === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className="th-contenido">
        <span className="th-etiqueta" onClick={() => alOrdenar(clave)}>
          {etiqueta}
          <span className="flecha-orden">
            {ordenActual?.clave === clave ? (ordenActual.direccion === 'asc' ? ' ▲' : ' ▼') : ''}
          </span>
        </span>
        <span className="th-filtro">
          <button
            ref={botonRef}
            type="button"
            className={`boton-filtro-columna ${filtroEnUso ? 'activo' : ''}`}
            aria-haspopup="true"
            aria-expanded={abierto}
            title={`Filtrar ${etiqueta}`}
            onClick={(e) => { e.stopPropagation(); setAbierto((a) => !a) }}
          >
            ▾
          </button>
        </span>
      </span>

      {abierto && posicion && createPortal(
        <div
          className="panel-filtro-columna"
          ref={panelRef}
          style={{ top: posicion.top, left: posicion.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            placeholder="Buscar…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          <div className="panel-filtro-acciones">
            <button type="button" onClick={() => setSeleccion(new Set(valores))}>Todos</button>
            <button type="button" onClick={() => setSeleccion(new Set())}>Ninguno</button>
          </div>
          <ul>
            {visibles.length === 0 && <li className="panel-filtro-vacio">Sin coincidencias</li>}
            {visibles.map((v) => (
              <li key={String(v)}>
                <label>
                  <input
                    type="checkbox"
                    checked={seleccion.has(v)}
                    onChange={() => alternarValor(v)}
                  />
                  {formato(v)}
                </label>
              </li>
            ))}
          </ul>
          <div className="panel-filtro-footer">
            <button type="button" onClick={limpiar}>Limpiar</button>
            <button type="button" className="primario" onClick={aplicar}>Aplicar</button>
          </div>
        </div>,
        document.body,
      )}
    </th>
  )
}
