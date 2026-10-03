import { useEffect, useRef, useState } from 'react'

// Los SVG de las graficas llevan viewBox="0 0 ANCHO ALTO" con width="100%":
// si ANCHO no coincide con el ancho real en pantalla, el navegador letterboxea
// el contenido (lo centra a escala 1:1 en vez de estirarlo -- comportamiento
// por omision de preserveAspectRatio), y TODA la aritmetica de mouse/tooltip
// que asume "ancho del viewBox == ancho en pantalla" queda desfasada del
// cursor real. Este hook mide el ancho real del contenedor para que el
// viewBox siempre coincida con el, sin depender de un valor fijo adivinado.
export function useAnchoContenedor(inicial = 900) {
  const ref = useRef(null)
  const [ancho, setAncho] = useState(inicial)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observador = new ResizeObserver((entradas) => {
      const medido = entradas[0]?.contentRect.width
      if (medido) setAncho(Math.round(medido))
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return [ref, ancho]
}
