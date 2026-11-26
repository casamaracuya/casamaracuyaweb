# Spec: Portal del huésped («Mi reserva»)

Módulo `portal-huesped` de `MAPA-reservas.md`, con la parte del módulo `avisos` que manda el enlace.
Idea de Daniel (24 nov 2026): cuando la reserva está pagada, al cliente le llega un correo con un enlace
a su apartado. Entra con su **apellido** y su **código de reserva**, y sigue unos pasos: primero la ficha
de registro, después lo de la estadía.

## Objetivo

Que el cliente llene la ficha de registro **antes de llegar**, desde su celular, sin papel ni fotos por
WhatsApp, y que la casa la tenga lista en el panel. Después de la ficha, el portal es el lugar donde el
cliente encuentra todo lo de su estadía.

**Para quién:** el titular de una reserva pagada (estado confirmada o en casa).

**Éxito:**
- La mayoría de las fichas llegan llenas por el cliente antes del check-in; Recepción ya no las transcribe.
- El cliente nunca ve datos de otra reserva, aunque pruebe códigos al azar.
- La ficha que llena el cliente aparece en el panel igual que si la hubiera pasado Recepción.

## Cómo funciona (paso a paso del cliente)

1. **Recepción toca «Enviar acceso»** en la reserva pagada. Al cliente le llega el correo «Tu reserva en
   Casa Maracuyá · CM-7K4Q9X» con el botón **«Entrar a mi reserva»**
   (`casa-maracuya.com/mi-reserva?c=CM-7K4Q9X`), y Recepción tiene el mismo enlace listo para WhatsApp.
2. **Entra:** el código ya viene escrito por el enlace; solo pone su **apellido** (el del titular).
3. **Paso 1 · Ficha de registro**, la misma de papel (`src/site/ficha-data.js`), en partes cortas:
   1. Titular: nombre, C.I./pasaporte, teléfono, correo, ciudad, y **contacto de emergencia** (nombre,
      parentesco y teléfono de alguien que no viaje con el grupo).
   2. Estadía: hora estimada de llegada, adultos, niños, vehículos.
   3. Acompañantes (máximo 12 en total, con el titular).
   4. Comida: alergias, bebidas, requerimientos.
   5. Mascota y celebración.
   6. Normas: las lee, marca «Acepto», escribe su nombre y C.I. y **firma con el dedo** en la pantalla.
   Se guarda al terminar cada parte, así puede seguir después.
4. **Paso 2 · Su estadía:** comprobante de pago, cómo llegar, horarios (check-in 3:00 PM, check-out
   11:00 AM), normas, y contacto por WhatsApp. Esto se ve apenas termina la ficha.
5. **Más adelante** (módulo `contenido-estadia`, aparte): wifi, menús, actividades. En este módulo el
   paso 2 deja el espacio listo.

## Lo que ve el equipo en el panel

- En la reserva: «Ficha llena por el cliente el 26/11, 8:40 p. m.» y la ficha completa, igual que hoy.
- **El sistema recuerda siempre** (en «Hoy», en el número del menú y en la reserva) hasta que se resuelva:
  - «Falta enviar el acceso a …»: desde que la reserva queda pagada hasta que Recepción lo envía.
  - «… no ha llenado la ficha»: desde 3 días antes de la llegada (o enseguida, si llega antes), con el
    botón para reenviar el acceso por correo o WhatsApp. Se quita cuando el cliente la firma.
  - «… llenó la ficha»: aviso a Recepción y Dirección cuando el cliente la termina.
- En la reserva: botón «Enviar acceso» (correo y WhatsApp), cuándo y quién lo mandó, y cuántas veces.

## Decisiones (supuestos — corrígelos ahora)

1. **La llave es el código CM- (6 caracteres al azar), no el R-1021.** El R- es consecutivo y se adivina.
2. **Apellido:** se compara sin mayúsculas ni tildes contra el nombre del titular. Sirve cualquier
   palabra del nombre que no sea la primera (si el nombre es «María José Pérez Rojas», sirve «Pérez»,
   «Rojas» o «Pérez Rojas»). Si el nombre tiene una sola palabra, sirve esa.
3. **Contra intentos al azar:** después de 5 intentos fallidos con un mismo código, ese código queda
   bloqueado 15 minutos. El mensaje de error nunca dice si lo que falló fue el código o el apellido.
4. **El portal abre** cuando la reserva tiene código (pagada) y **cierra** 7 días después de la salida
   (luego viene el módulo `despedida`). Reservas canceladas no entran.
5. **El correo lo manda Recepción** con «Enviar acceso», al correo del titular, con el mismo sistema de
   correo que el comprobante (Resend). Si no hay correo, el panel lo dice y queda el botón de WhatsApp.
6. **Idioma:** español o inglés según el idioma de la reserva; el cliente puede cambiarlo en el portal.
7. **La ficha del cliente va a los mismos campos** que la ficha que pasa Recepción (migración 0009).
   Si Recepción ya la había pasado, el cliente la ve llena y puede corregirla; queda en la bitácora.
8. **Datos sensibles:** el C.I./pasaporte se puede escribir, pero el portal nunca lo vuelve a mostrar
   completo (solo los últimos 3 dígitos). El portal no muestra pagos de nadie más, ni notas internas,
   ni la cotización.
9. **Sin cuenta ni contraseña** para el cliente. En el celular se queda abierto mientras no cierre la
   pestaña; si vuelve otro día, pone el apellido otra vez.

10. **Firma con el dedo:** se usa `signature_pad` (librería abierta, liviana y la más usada para esto;
    trazo suave con dedo, lápiz o mouse). La firma se guarda como imagen PNG en la tabla privada
    `fichas_firmas` (nadie la lee directo; el equipo la ve con `ver_firma`), junto con: nombre y C.I. escritos, fecha y hora, y una «huella» (SHA-256) de la ficha
    tal como estaba al firmar y de la versión de las normas. Si después se cambia la ficha, la firma
    anterior queda en el historial y se pide firmar de nuevo. En el panel la firma se ve en la reserva
    y sale en la ficha impresa.
11. **Datos de cada persona:** titular y cada acompañante con nombre y apellido, C.I./pasaporte y edad si
    es menor, como en el papel. El total no pasa de 12 y tiene que cuadrar con adultos y niños.

## Cómo se construye

- Página pública `/mi-reserva` (y `/en/my-booking`), con el estilo de la web.
- Base de datos (migración nueva, va por PR a Edwar): funciones públicas que siempre reciben código +
  apellido y solo devuelven o guardan lo de esa reserva: `portal_entrar`, `portal_guardar_ficha`.
  Tabla de intentos fallidos. Campos `acceso_enviado` y `ficha_origen` (cliente / recepción).
- Correo: función de Supabase `enviar-acceso` (como `enviar-comprobante`).
- Panel: botón «Enviar acceso», estado de la ficha, avisos en «Hoy».

## Pruebas

- SQL (como `registro_pago.sql`): código malo, apellido malo, bloqueo a los 5 intentos, reserva
  cancelada o vieja no entra, la ficha guarda solo en su reserva, el documento no se devuelve completo,
  nadie anónimo lee tablas directo.
- Navegador: entrar desde el enlace, llenar la ficha en el celular, volver otro día y seguir.
- Revisión de seguridad (security-and-hardening) antes del PR, porque es una página pública con datos
  personales.

## Límites

- **Siempre:** pruebas antes de entregar; preview antes de subir; «Dirección», nunca el nombre propio.
- **Preguntar primero:** el texto del correo; cambios en la base de datos (van por PR a Edwar).
- **Nunca:** mostrar datos de otra reserva; precios en la web pública; las palabras «hotel» o
  «posada» en textos al cliente.

12. **El número de personas no se cambia en el portal** (Daniel, 25 nov; migración 0021). Lo anotó
    Recepción al registrar el pago. En la parte 2 se muestra fijo, con un enlace a WhatsApp si cambió;
    en la parte 3 van exactamente las personas de la reserva, más hasta 2 bebés menores de 3 años
    (no pagan). Adultos y niños se cuentan solos con las edades.

## Respuestas de Daniel (24 nov)

- Firma con el dedo en la pantalla, con el mejor sistema → decisión 10.
- El acceso lo envía Recepción con un botón, y el sistema lo recuerda siempre → decisión 5 y avisos.
- C.I. de cada persona y todos los datos de la ficha → decisión 11.
- El formato compartido (Ficha_del_Huesped_Casa_Maracuya.pdf) es el mismo de `ficha-data.js`; se suma
  el C.I. del titular debajo de la firma.

## Preguntas abiertas

- Ninguna que frene el inicio. Se agrega el contacto de emergencia (Daniel, 24 nov); también va a la
  ficha en papel (PDF) y a la ficha del panel para que las tres digan lo mismo.
