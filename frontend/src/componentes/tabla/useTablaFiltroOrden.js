import { useMemo, useState } from 'react'

// Ordenamiento + filtro "tipo Excel" (checklist de valores distintos por
// columna) sobre un arreglo de filas ya cargado en el cliente -- no toca
// la API, todo pasa en memoria porque las tablas de este tablero son
// chicas (decenas/cientos de filas, no miles).
//
// columnas: [{ clave, obtenerValor: (fila) => valorCrudoComparable }]
// El mismo obtenerValor sirve para ordenar y para construir el checklist
// de cada columna (los valores distintos que existen HOY en `filas`).
export function useTablaFiltroOrden(filas, columnas) {
  const [orden, setOrden] = useState({ clave: null, direccion: 'asc' })
  const [filtros, setFiltros] = useState({}) // { [clave]: Set(valoresPermitidos) }

  function alternarOrden(clave) {
    setOrden((o) => (o.clave === clave
      ? { clave, direccion: o.direccion === 'asc' ? 'desc' : 'asc' }
      : { clave, direccion: 'asc' }))
  }

  function establecerFiltro(clave, valoresSeleccionados) {
    setFiltros((f) => {
      if (valoresSeleccionados == null) {
        const { [clave]: _quitado, ...resto } = f
        return resto
      }
      return { ...f, [clave]: valoresSeleccionados }
    })
  }

  const valoresDistintos = useMemo(() => {
    const mapa = {}
    for (const col of columnas) {
      const set = new Set()
      for (const fila of filas) set.add(col.obtenerValor(fila))
      mapa[col.clave] = [...set].sort((a, b) => {
        if (a == null) return 1
        if (b == null) return -1
        return a > b ? 1 : a < b ? -1 : 0
      })
    }
    return mapa
  }, [filas, columnas])

  const filasFiltradas = useMemo(() => (
    filas.filter((fila) => columnas.every((col) => {
      const permitidos = filtros[col.clave]
      if (!permitidos) return true
      return permitidos.has(col.obtenerValor(fila))
    }))
  ), [filas, columnas, filtros])

  const filasOrdenadas = useMemo(() => {
    if (!orden.clave) return filasFiltradas
    const col = columnas.find((c) => c.clave === orden.clave)
    if (!col) return filasFiltradas
    const factor = orden.direccion === 'asc' ? 1 : -1
    return [...filasFiltradas].sort((a, b) => {
      const va = col.obtenerValor(a)
      const vb = col.obtenerValor(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (va < vb) return -1 * factor
      if (va > vb) return 1 * factor
      return 0
    })
  }, [filasFiltradas, orden, columnas])

  return {
    filas: filasOrdenadas,
    orden,
    alternarOrden,
    filtros,
    establecerFiltro,
    valoresDistintos,
    totalFiltrado: filasFiltradas.length,
    totalOriginal: filas.length,
  }
}
