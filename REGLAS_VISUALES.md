# Reglas visuales del tablero

Las reglas que los comentarios de `frontend/src/estilos.css` y de las
gráficas citan por número. No son preferencias: cada una salió de medir
contraste WCAG y de correr un validador de paletas para daltonismo sobre
los colores que ya existían. Si algo se «arregla» sin leer esto, se rompe
la accesibilidad.

## 1. Reglas duras — no revertir

**R1 · `#001689` (azul fuerte) no puede ser fondo de una banda con texto
o íconos del mismo azul.** Contraste 1.00:1 contra sí mismo: literalmente
invisible. Las bandas van en tinte claro (`#c8e4f1`), donde ese azul
rinde 10.7:1.

**R2 · `#098bcb` (azul medio) no puede ser color de texto sobre fondo
claro.** Da 3.67:1 y WCAG pide 4.5:1. Solo sirve para filetes, bordes,
anillo de foco y trazos de gráfica.

**R3 · `#7fc4e3` (azul claro) no puede ser color de serie ni de texto.**
Croma 0.082 contra un piso de 0.1: el validador lo reporta como «lee como
gris». Solo tintes de fondo.

**R4 · `#001689` no puede ser color de serie en una gráfica.** Luminosidad
OKLCH 0.305, fuera de la banda válida 0.43–0.77.

**R5 · Los colores de estado existen en dos versiones y no son
intercambiables.** Relleno (`--bien`, `--alerta`, `--critico`) para
barras, puntos y fondos de pastilla; texto (`--bien-texto`,
`--alerta-texto`, `--critico-texto`) para cualquier letra teñida de
estado. Los de relleno usados como texto dan 2.7 / 1.5 / 3.9 — el ámbar a
1.5 es ilegible. Los de texto dan 6.1 / 5.7 / 5.3.

**R6 · Los colores de estado nunca se usan como color de serie**, ni se
tiñen de azul de marca. Significan algo (a favor / atención / en contra);
teñirlos borra el semáforo.

**R7 · Las pastillas se mezclan contra la superficie (`#fcfcfb`), no
contra transparente.** Si fueran translúcidas, el mismo valor cambiaría
de tono según el renglón de atrás (blanco, alterno o total).

**R8 · El color nunca viaja solo.** Toda señal de estado trae además
palabra y forma: el veredicto dice «Bueno» o «Débil» con letras, el delta
trae flecha y porcentaje con signo, la decisión por campaña trae su
etiqueta. Quien no distinga el verde del rojo lee exactamente lo mismo.

### Sobre emitir juicios

La versión original de estas reglas incluía una que decía: *la ficha no
emite juicios («van bien», «van mal»), porque se le muestra al equipo de
la sucursal y calificarlo desmotiva.* Esa regla sigue valiendo **para la
ficha por sucursal**, que es un documento que se le entrega a la gente de
la sucursal.

La pestaña **Resumen** sí emite un juicio, a propósito y con otro
destinatario: no califica a ninguna persona ni a ninguna sucursal, sino al
gasto publicitario del periodo, y se la lee quien decide ese gasto. La
regla era sobre a quién se le pone una calificación enfrente, no sobre
prohibir conclusiones.

## 2. Series de datos

Dos series, dos señales redundantes a propósito — color **y** trazo:

| Serie | Token | Trazo |
|---|---|---|
| Métrica de Meta | `--marca-medio` `#098bcb` | sólido |
| Solicitantes / empresa | `--serie-solicitantes` `#c9622a` | punteado |

`--serie-solicitantes` es la única adición propia de este tablero. Antes
de usarla se corrió el validador de paletas sobre el par
`#098bcb,#c9622a`: pasa banda de luminosidad, piso de croma, separación
para daltonismo y contraste. El trazo punteado se deja además como
respaldo para quien no distinga los colores.

Las referencias (marcador de contratación, marcador de solicitud) van en
`--tinta`, nunca en color de serie: no son datos, son anotaciones sobre
los datos, y competir con la serie sería mentir sobre su jerarquía.

## 3. Nunca dos ejes en la misma gráfica

Comparar impresiones (cientos de miles) contra solicitudes (decenas) en
una sola gráfica con dos escalas verticales deja dibujar cualquier
conclusión: basta mover una de las dos escalas. Cuando hay que
compararlas, cada serie se indexa contra **su propio máximo del periodo**
y las dos quedan en una escala común de 0–100% (`GraficaIndexada`). Se
pierde la magnitud absoluta — que ya está en las tarjetas de arriba — y se
gana una comparación que no se puede amañar.

Por lo mismo, el embudo del Resumen no son barras proporcionales: sus
cuatro etapas no están en las mismas unidades y la segunda es mayor que la
primera. Lo que se dibuja es el cociente entre una etapa y la siguiente.

## 4. Marcas del eje Y

Mismo algoritmo de «marcas redondas» en todas las gráficas: el paso se
escoge entre 1, 2, 2.5 y 5 × 10ⁿ, el más chico que cubra el máximo en
aproximadamente cuatro pasos. Evita que un valor apenas arriba de una
cifra redonda agregue una marca entera de más. Está en
`frontend/src/graficas/escalas.js`.

## 5. Tipografía y geometría

| Elemento | Tamaño | Peso | Color |
|---|---|---|---|
| Título de tarjeta | 15px | 700 | `--marca-fuerte` |
| Subtítulo | 12.5px | 400 | `--tinta-muda` |
| Etiqueta de tarjeta de cifra | 13px, versalitas, `letter-spacing: .06em` | 700 | `--marca-fuerte` |
| Cifra de tarjeta | 32px (24px en la fila secundaria) | 700 | `--tinta` |
| Pie de tarjeta | 12.5px | 400 | `--tinta-2` |
| Tabla | 13px, `tabular-nums` | — | `--tinta` |

Radio de las tarjetas 10–12px; barras de gráfica con las dos esquinas
superiores redondeadas a 4px y las de abajo cuadradas, porque abajo tocan
la línea base; 2px de hueco en color de superficie entre barras contiguas.
