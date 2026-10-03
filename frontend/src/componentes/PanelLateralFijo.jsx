// Envuelve cualquier panel lateral (ranking por campana, ranking por
// sucursal, el que siga). Usa position:sticky (ver .ranking-panel en
// estilos.css) dentro del grid de dos columnas .campana-layout: empieza
// en su posicion normal del documento -- justo debajo de la barra de
// filtros, no pegado al borde del navegador -- y solo se "pega" cerca del
// tope de la pantalla una vez que el scroll lo sacaria de vista. A
// diferencia de position:fixed (lo que se probo antes), sticky no se
// queda congelado en un punto arbitrario mientras el resto de la pagina
// se sigue moviendo: acompana el scroll hasta que hace falta fijarlo, y
// se libera otra vez cuando el contenido de esta columna se termina.
export default function PanelLateralFijo({ children }) {
  return <aside className="ranking-panel">{children}</aside>
}
