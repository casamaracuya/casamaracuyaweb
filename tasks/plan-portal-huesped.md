# Plan: Portal del huésped («Mi reserva»)

Spec: `SPEC-portal-huesped.md`. Rama: `portal-huesped`. Migración nueva: `0020_portal_huesped.sql`.
Se entrega en **2 PR** para que Edwar corra la base de datos una sola vez por parte.

## Decisiones de arquitectura
- Todo lo que hace el cliente pasa por funciones de la base que reciben código + apellido en cada
  llamada (sin cuentas ni sesiones). El cliente anónimo no lee ninguna tabla directo.
- La ficha del portal escribe en los mismos campos que la ficha del panel (0009); se suma
  `ficha_origen` (cliente / recepción) y el contacto de emergencia.
- Firma: `signature_pad` → imagen PNG en el depósito privado `firmas`; la base guarda la ruta, nombre,
  C.I., fecha y la huella SHA-256 de la ficha + versión de normas.
- La página `/mi-reserva` usa el estilo de la web (site.css), no el del panel.

## PR 1 · El cliente entra y llena la ficha

- [x] **T1. Base: entrar con código + apellido** (M)
  - Migración 0020: columnas (contacto de emergencia, `ficha_origen`, `acceso_enviado`), tabla de
    intentos fallidos, `portal_entrar(codigo, apellido)` que devuelve solo lo de esa reserva.
  - Acepta: apellido sin mayúsculas ni tildes; bloqueo a los 5 fallos por 15 min; error igual para
    código o apellido malo; canceladas y salidas de hace más de 7 días no entran; C.I. enmascarado.
  - Verifica: `supabase/tests/portal_huesped.sql` en Postgres local.
- [x] **T2. Página «Mi reserva»: entrar y ver la estadía** (M)
  - `/mi-reserva` y `/en/my-booking`: pantalla de entrada (código del enlace + apellido) y el paso 2
    básico: fechas, plan, comprobante, horarios, normas, cómo llegar y WhatsApp.
  - Verifica: navegador con datos de prueba, en celular y PC; ES/EN.
- [x] **T3. La ficha en el portal (partes 1 a 5)** (M)
  - Titular + contacto de emergencia, estadía y vehículos, acompañantes con C.I. (máx. 12, cuadra con
    adultos y niños), comida, mascota y celebración. Se guarda parte por parte
    (`portal_guardar_ficha`) y se puede seguir otro día.
  - Verifica: pruebas SQL (solo guarda en su reserva, límites) + navegador.
- [x] **T4. Firma con el dedo (parte 6)** (M)
  - Normas + «Acepto» + nombre y C.I. + firma con `signature_pad`; depósito `firmas`; `portal_firmar`
    guarda la huella; si se cambia la ficha después, pide firmar de nuevo.
  - Verifica: firmar en celular (dedo) y PC (mouse); la imagen no es pública; pruebas SQL.

### Revisión 1
- [x] Compila; pruebas SQL pasan (86); recorrido completo en el celular contra la base de prueba.

- [x] **T5. Panel: ficha del cliente y enviar acceso por WhatsApp** (S)
  - En la reserva: «Ficha llena por el cliente el …», firma visible, contacto de emergencia;
    botón «Enviar acceso» por WhatsApp con el enlace; queda registrado quién y cuándo.
  - Verifica: navegador con datos de prueba.

### Revisión 2 → PR 1
- [x] Revisión de seguridad (security-and-hardening) y de código; preview a Daniel.
- [ ] PR a Edwar con la 0020 (va después de la 0019).

## PR 2 · Correo y recordatorios

- [x] **T6. Correo de acceso** (M)
  - Función `enviar-acceso` (Resend, como `enviar-comprobante`), ES/EN; textos aprobados por Daniel.
  - Verifica: envío de prueba a un correo de Daniel.
- [x] **T7. Recordatorios que no se olvidan** (S)
  - «Falta enviar el acceso», «no ha llenado la ficha» (desde 3 días antes), «llenó la ficha»: en
    «Hoy», en el número del menú y en la reserva.
  - Verifica: navegador con reservas de prueba en cada caso.
- [x] **T8. Ficha en papel y del panel al día** (S)
  - Contacto de emergencia en el PDF y en la ficha del panel. (La firma digital ya se ve en la reserva; el panel
    no tiene ficha impresa, así que «firma en la ficha impresa» queda para cuando se haga esa impresión.)
  - Los PDF se regeneraron en este entorno con las mismas letras (Manrope y Cormorant de @fontsource).

### Revisión 3 → PR 2
- [ ] Compila; pruebas; preview; PR a Edwar.

## Riesgos
| Riesgo | Impacto | Qué hacemos |
|---|---|---|
| Alguien prueba códigos al azar | Alto | Código de 6 al azar + apellido + bloqueo por intentos |
| Edwar no corre la 0020 | Medio | El panel no se rompe sin ella (como en 0019) |
| El correo cae en spam | Medio | Mismo remitente que el comprobante; siempre queda el WhatsApp |
| Firma que no se ve bien en celulares viejos | Bajo | Probar en pantalla chica; botón «Borrar y firmar de nuevo» |
