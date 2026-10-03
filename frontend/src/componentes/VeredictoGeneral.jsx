import { formatoFecha } from '../graficas/escalas'

// Lo primero que se lee al entrar: una frase que contesta "que tan bueno
// ha sido esto" en palabras, no en numeros. Los numeros vienen abajo.
//
// El color NUNCA viaja solo (REGLAS_VISUALES.md R8): la etiqueta dice
// "Bueno" / "Debil" con letras y el icono repite la direccion, asi que
// quien no distinga el verde del rojo lee exactamente lo mismo.
const ICONO = {
  bien: '▲',
  alerta: '▲',
  critico: '▼',
  neutra: '■',
}

export default function VeredictoGeneral({ veredicto, desde, hasta, dias, comparacion }) {
  return (
    <div className={`veredicto ${veredicto.color}`} role="status">
      <div className="veredicto-cabeza">
        <span className="veredicto-icono" aria-hidden="true">{ICONO[veredicto.color]}</span>
        <span className="veredicto-titulo">Rendimiento general: {veredicto.etiqueta}</span>
      </div>
      <p className="veredicto-resumen">{veredicto.resumen}</p>
      <p className="veredicto-rango">
        {dias} días · {formatoFecha(desde)} – {formatoFecha(hasta)}
        {' '}· comparado contra {formatoFecha(comparacion.desde)} – {formatoFecha(comparacion.hasta)}
      </p>
    </div>
  )
}
