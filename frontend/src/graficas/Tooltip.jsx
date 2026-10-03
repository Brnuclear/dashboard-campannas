// Tooltip compartido por las dos graficas. Los nombres de serie pueden
// venir de datos externos (API), asi que van por textContent via JSX
// normal -- nunca dangerouslySetInnerHTML.
//
// xPorcentaje va en % (no px): el SVG que lo contiene mide su ancho real
// via useAnchoContenedor (ver graficas/useAnchoContenedor.js) y usa ESE
// mismo ancho como viewBox, asi que % del viewBox == % del contenedor en
// pantalla. Y puede ir en px tal cual porque el alto del SVG es fijo.
export default function Tooltip({ xPorcentaje, y, fecha, filas }) {
  if (fecha == null) return null
  return (
    <div className="tooltip" style={{ left: `calc(${xPorcentaje}% + 14px)`, top: y - 10 }}>
      <span className="fecha">{fecha}</span>
      {filas.map((f) => (
        <div className="fila" key={f.nombre}>
          {!f.sinClave && (
            <span
              className={`clave ${f.estilo === 'punteado' ? 'punteada' : ''}`}
              style={f.color ? { '--clave-color': f.color } : undefined}
            />
          )}
          <span className="nombre">{f.nombre}:</span>
          <span className="valor">{f.valor}</span>
        </div>
      ))}
    </div>
  )
}
