# Spec: solicitudes (módulo 2 del MAPA-reservas.md)

## Objetivo
Separar lo que es una **solicitud** (alguien pregunta, se conversa, se cotiza) de lo que es una **reserva** (ya pagó el 100 % y tiene código CM-XXXXXX).

- **Solicitudes** (pantalla nueva): todo lo que llega por la web, Instagram, WhatsApp, Google o recomendación. Aquí vive la conversación de Recepción con el cliente, la cotización y la revisión de cupo.
- **Reservas**: solo las pagadas con código. Confirmadas, en casa y las que ya salieron.
- **Nueva reserva** (botón principal): registra cliente + estadía + pago del 100 % y entrega el código. Reemplaza el botón «Reserva pagada».

## Recorrido
```
Llega una solicitud ─► Solicitudes
   (web sola, o Recepción la anota desde WhatsApp con «Nueva solicitud»)
        │  Recepción conversa y anota lo que se habla
        │  El panel dice si hay cupo; si no, propone las fechas libres más cercanas
        │  Se hace la cotización (COT-XXXX)
        │  Opcional: apartar 24 h
        ▼
   «Registrar el pago y crear la reserva» (datos ya puestos desde la solicitud)
        │  100 % pagado y coincide con la cotización
        ▼
   Reservas ─► código CM-XXXXXX, correo al cliente, avisos al equipo
```
Una solicitud que no se cierra: «Sin cupo», «No siguió», o **Vencida** sola cuando pasa la fecha de llegada.

## Pantalla Solicitudes
- Arriba: buscador (nombre, teléfono, código) y botón **Nueva solicitud**.
- Grupos: **Por responder** (nuevas, la llegada más cercana primero) · **En conversación** · **Apartadas** (con cuenta regresiva) · **Archivo** (sin cupo, no siguió, vencidas).
- Cada fila: fecha de llegada, nombre, noches · plan · personas, **por dónde llegó** (ícono del canal), cuándo escribió, y una etiqueta de cupo: **Hay cupo** / **Sin cupo · libre del 12 al 14**.
- Duplicados (mismo teléfono y fechas que se cruzan) se muestran como una sola fila con «2 solicitudes» y se pueden unir.

## Ficha de una solicitud
- Datos del cliente y de la estadía, editables.
- **Cupo**: «Hay cupo» o «Esas fechas están ocupadas. Lo más cerca libre: 12–14 dic, 19–21 dic» (busca hacia adelante y hacia atrás, mismas noches).
- **Conversación**: notas que escribe Recepción con hora y autor («le mandé la tarifa», «pide cama extra»). Se ven en orden, como un chat interno. Botones de WhatsApp y respuestas preparadas (ya existen).
- **Cotización**: botón «Hacer cotización» con los datos puestos; muestra la COT vigente.
- Acciones: **Registrar el pago y crear la reserva** · Apartar 24 h · Sin cupo · No siguió.

## Nueva reserva
El formulario que hoy se llama «Reserva pagada», con el nombre «Nueva reserva». Si se abre desde una solicitud, trae cliente, fechas, plan, personas y la cotización ya puestos.

## Datos
- Se reutiliza la tabla `reservas`: una solicitud es una fila en estado nueva, conversación, apartada, sin cupo, no siguió o vencida. Así el historial y el código no cambian.
- Tabla nueva `conversaciones` (reserva_id, texto, autor, fecha): las notas de Recepción. Solo la leen Dirección, Administración y Recepción. Entra en la bitácora.
- Estado nuevo `no_siguio` («el cliente no siguió»), aparte de `rechazada` («sin cupo»).
- Las solicitudes cuya llegada ya pasó pasan solas a `vencida`.

## Quién ve qué
- Solicitudes: Dirección, Administración, Recepción.
- Reservas: como hoy (cada área ve lo suyo).

## Fuera de este módulo
El tablero de solicitudes (gráficas por canal, por mes, conversión) va después, con estos datos.

## Criterios de éxito
1. Reservas solo muestra reservas con código CM-.
2. Una solicitud de la web aparece sola en Solicitudes con su canal y fecha.
3. Recepción anota una solicitud de WhatsApp en menos de 30 segundos.
4. El cupo se calcula solo y, si no hay, propone al menos 2 fechas libres cercanas con las mismas noches.
5. Desde una solicitud, «Registrar el pago y crear la reserva» abre Nueva reserva con todo puesto; al 100 % la solicitud desaparece de Solicitudes y aparece en Reservas con su código.
6. Las solicitudes con fecha pasada se archivan solas.
7. Las notas de la conversación quedan con autor y hora, y en el historial de Dirección.

## Decisiones (Daniel, 24 nov 2026)
1. Se mantiene **Apartar 24 h** antes del pago.
2. Sin cupo: el panel muestra a Recepción las fechas libres más cercanas (hasta 4, con las mismas noches, buscando 4 meses hacia adelante y hacia atrás) y un botón para ofrecerlas por WhatsApp.
3. Las notas de la conversación quedan **fijas**: no se editan ni se borran.

## Ajustes (Daniel, 24 nov 2026, mañana): que ninguna solicitud quede sin respuesta
- Recepción no crea solicitudes: llegan solas. «Nueva solicitud» sale del menú; queda un botón pequeño al final de Solicitudes para anotar a mano.
- Meta: responder en **12 horas**. Cada solicitud muestra cuánto lleva esperando (verde < 6 h, amarillo < 12 h, rojo después) y Hoy avisa.
- **Responder en un toque**: «Responder: hay cupo» o «Responder: sin cupo y fechas libres» abren WhatsApp con el mensaje listo, anotan la respuesta en la conversación y pasan la solicitud a «En conversación».
- **Seguimiento**: una conversación con **2 días** sin nada nuevo pasa al grupo «Hacer seguimiento», con un botón para escribirle. A los **5 días** el panel sugiere cerrarla como «No siguió» (no se cierra sola).
- Toda solicitud termina en: reserva, sin cupo, no siguió o vencida.
- **Cruce al crear una reserva**: en «Nueva reserva», si el teléfono, el correo o el nombre coinciden con una solicitud activa, el panel la muestra y ofrece «Usar esta solicitud» (se registra el pago ahí y pasa a Reservas).
- Pendiente: quién responde cuando Recepción no está.
