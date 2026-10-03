// Referencia estatica del marco de decision (mismo que el documento
// "Marco de decisión para campañas de reclutamiento"). "Mantener" es el
// unico casillero que el documento no tenia explicito -- lo agrega la
// automatizacion como salida por defecto cuando ninguna de las otras 6
// condiciones se dispara, para que cada campaña siempre reciba una
// decision, no una casilla vacia.
const CASILLEROS = [
  {
    clave: 'invertir_mas', color: 'bien',
    condicion: 'CPA bajo + solicitantes altos + vacante abierta',
    titulo: 'Invertir más',
    texto: 'El anuncio funciona y todavía hay demanda que cubrir. Subir presupuesto es la decisión de menor riesgo.',
  },
  {
    clave: 'optimizar_anuncio', color: 'alerta',
    condicion: 'Conversión clic→solicitud por debajo de la mediana del cohorte',
    titulo: 'Optimizar el anuncio',
    texto: 'El problema está arriba del embudo (creativo, landing, oferta) — más presupuesto solo escala el mismo problema.',
  },
  {
    clave: 'revisar_proceso', color: 'alerta',
    condicion: 'Solicitantes altos + tasa de contratación baja',
    titulo: 'Revisar el proceso',
    texto: 'La gente sí está llegando; el cuello de botella es la revisión/selección en la sucursal, no la campaña.',
  },
  {
    clave: 'pausar', color: 'critico',
    condicion: 'Sin vacante activa para esa sucursal + puesto',
    titulo: 'Pausar',
    texto: 'Independientemente de qué tan bien se vea el CPA histórico, no hay necesidad vigente que justifique seguir pagando.',
  },
  {
    clave: 'refrescar', color: 'critico',
    condicion: 'Solicitantes por 1,000 impresiones cayendo 25%+ desde el pico, 4+ semanas de historia',
    titulo: 'Refrescar o pausar',
    texto: 'Señal de cansancio de audiencia — actuar aquí cuesta menos que esperar a que el promedio acumulado se vea mal.',
  },
  {
    clave: 'esperar', color: 'neutra',
    condicion: 'Menos de 3 semanas activa + 0-2 contrataciones',
    titulo: 'Esperar antes de juzgar',
    texto: 'Todavía no hay suficiente muestra. Mirar solicitantes y conversión de clic, no CPA, mientras se acumula historia.',
  },
  {
    clave: 'mantener', color: 'neutra',
    condicion: 'Ninguna de las condiciones anteriores se cumple',
    titulo: 'Mantener',
    texto: 'Sin señal fuerte en ninguna dirección con los umbrales actuales — dejar el presupuesto tal como está.',
  },
]

export default function MatrizDecision() {
  return (
    <div className="tarjeta">
      <h2>Marco de decisión</h2>
      <p className="subt">
        Las 7 salidas posibles de la decisión automática de abajo, y qué condición dispara cada una.
      </p>
      <div className="matriz-decision">
        {CASILLEROS.map((c) => (
          <div className={`matriz-celda ${c.color}`} key={c.clave}>
            <span className="matriz-condicion">{c.condicion}</span>
            <h4>{c.titulo}</h4>
            <p>{c.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
