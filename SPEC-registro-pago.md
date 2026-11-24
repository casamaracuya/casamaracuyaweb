# Spec: registro-pago (módulo 1 del MAPA-reservas.md)

## Objetivo
Cuando el cliente ya acordó por WhatsApp y pagó, la persona que atiende el WhatsApp registra en el panel, en un solo formulario, la reserva completa: datos del cliente, fechas, plan, personas, total y el pago con su prueba. Al guardar:
1. Se genera un **código de reserva único y aleatorio** (tipo vuelo, ej. `CM-7K4Q9X`).
2. La reserva queda **confirmada** y las fechas **bloqueadas** en el calendario.
3. Queda listo el evento «reserva confirmada» que usará el módulo `avisos`.

Éxito = de «el cliente me mandó el comprobante» a «reserva confirmada con código» en menos de 2 minutos, sin pasar por los estados Nueva → Conversación → Apartada.

### Historias
- Como persona del WhatsApp, registro una reserva pagada de un cliente nuevo o que ya vino antes, adjunto el comprobante y recibo su código para enviárselo.
- Como persona del WhatsApp, si la reserva ya existía (vino de la web), la confirmo desde su ficha con el mismo formulario de pago.
- Como Dirección o Administración, veo cada pago con método, referencia, quién lo registró y la foto del comprobante.
- Como cualquiera del equipo, busco una reserva por su código.

## Qué se guarda

**Cliente:** nombre, teléfono (WhatsApp), correo (obligatorio: lo necesita el portal), idioma ES/EN. Si el teléfono o el correo ya existen, se usa ese huésped (no duplicar).

**Estadía:** llegada, salida, plan (Esencial/Plena), personas (1–12), mascota, notas.

**Dinero:** total de la estadía, monto pagado, saldo calculado.

**Pago (uno o varios):**
| Campo | Regla |
|---|---|
| Método | Transferencia, Pago móvil, Zelle, Binance (USDT), Efectivo USD, Efectivo Bs. (lista editable después) |
| Moneda | USD o Bs.; si es Bs., la tasa del día y el equivalente en USD |
| Referencia | Obligatoria salvo efectivo; no puede repetirse con el mismo método (evita registrar dos veces el mismo pago) |
| Comprobante | Foto o PDF, obligatorio. En efectivo: foto del recibo firmado por el cliente |
| Recibido por | Automático: quien registra. En efectivo, además quién tiene el dinero |
| Fecha y hora | Automáticas |

## Código de reserva
- Formato `CM-` + 6 caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sin 0/O, 1/I/L para que se pueda dictar). ~600 millones de combinaciones.
- Se genera en la base de datos, único, nunca cambia.
- Las reservas viejas conservan su `R-1012` como número interno y reciben un código nuevo solo al confirmarse.
- Se muestra grande en la reserva, con botones «Copiar» y «Enviar por WhatsApp».

## Fuera de este módulo
Los avisos (correo a Dirección, cocina, cliente), el portal, la ficha en línea, la llegada y la salida. Aquí solo se deja la reserva confirmada con todo lo que ellos necesitan.

## Tech stack
React 18 + Vite (panel en `src/admin`), Supabase (Postgres, RLS, Storage, Edge Functions en Deno), Cloudflare Pages.

## Comandos
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Migración: Supabase › SQL Editor › pegar `supabase/migrations/0017_registro_pago.sql` › Run (la corre Edwar; repetible sin romper nada).

## Estructura
- `supabase/migrations/0017_registro_pago.sql`: columnas nuevas, bucket `comprobantes`, función `confirmar_reserva`.
- `src/admin/sheets.jsx`: formulario «Reserva pagada» (nuevo) y registro de pago ampliado.
- `src/admin/views.jsx`: buscar por código.
- `src/admin/util.js`: formato y validación.

## Estilo
Seguir el del panel: funciones SQL `security definer` con chequeo de rol y mensajes en español que el usuario entiende:
```sql
if not tiene_algun_rol('{direccion,admin,recepcion}') then
  raise exception 'Tu rol no puede registrar pagos';
end if;
```

## Pruebas
El repo no tiene framework de pruebas. Propuesta: Vitest para `util.js` (validaciones, formato del código) y un guion SQL de prueba con reservas de ensayo (`canal = 'Prueba'`) que se borra al final. Prueba manual en celular antes del PR.

## Límites
- **Siempre:** validar en la base de datos, no solo en la pantalla. Comprobantes en bucket privado. Una sola transacción: o queda todo (huésped, reserva, pago, código) o nada.
- **Preguntar antes:** cambiar quién puede registrar pagos; borrar o cambiar pagos ya registrados.
- **Nunca:** comprobantes públicos; código consecutivo o adivinable; push directo a main; claves `service_role` en el navegador.

## Criterios de éxito
1. Una reserva pagada se registra en un solo formulario y sale con estado Confirmada y código `CM-XXXXXX`.
2. Dos reservas nunca tienen el mismo código; el código no se puede deducir de otro.
3. Si las fechas chocan con otra reserva activa o un bloqueo, no se guarda nada y el mensaje lo dice.
4. Sin comprobante (o recibo en efectivo) no se puede guardar.
5. La misma referencia con el mismo método no se acepta dos veces.
6. El calendario muestra las noches ocupadas en cuanto se guarda.
7. Buscar `CM-7K4Q9X` en Reservas abre esa reserva.
8. Dirección ve en Ingresos cada pago con método, referencia, quién lo registró y el comprobante.

## Decisiones (Daniel, 23 nov 2026)
1. Recepción también registra pagos (es quien habla con el cliente por WhatsApp), además de Dirección y Administración.
2. Métodos aceptados: Transferencia, Pago móvil, Zelle, Binance (USDT), Efectivo USD, Efectivo Bs.
3. Se confirma solo con el **100 %** pagado. Con menos, el pago se guarda pero la reserva no se confirma ni recibe código.
4. Efectivo: recibo firmado por el cliente + foto del recibo.

Criterio de éxito añadido: 9. Si lo pagado es menor que el total, la reserva no pasa a Confirmada y el formulario muestra cuánto falta.

---

# Ampliación (23 nov 2026, noche): roles, cotización con código y control de Dirección

## Roles
| Rol | Persona | Ve | Hace |
|---|---|---|---|
| Dirección | La directora | Todo, más la pantalla **Control** y el **historial** de cada cliente | Decide, aprueba diferencias de cobro, revisa la caja |
| Administración y Finanzas | Faby | Todo: reservas, solicitudes, pagos con comprobante, ingresos, reportes | Revisa y cuadra pagos, contabilidad |
| Recepción y reservas (se reactiva) | La persona del WhatsApp (de confianza) | Solicitudes, cotizaciones, reservas, calendario, huéspedes, los pagos de sus reservas | Responde, cotiza, cobra, registra reservas pagadas, llegada y salida |
| Operaciones, Cocina, Servicio, Calidad, Housekeeping, Áreas verdes | Sin cambios | | |

## Cotización con código
1. Recepción arma el presupuesto (ya existe el PDF). Al descargarlo se guarda con un código (ej. `COT-48K2`) impreso en el PDF, con cliente, fechas, plan, personas, total y vigencia.
2. Al registrar el pago se escribe el código: el panel trae cliente, fechas y «Se cobra: $540» con el botón **Confirmar lo que se cobra**.
3. Si todo coincide, se registra normal.
4. Si no coincide (otro monto, sin cotización, cotización vencida, otras fechas): queda como **movimiento fuera de lo normal**, con motivo obligatorio.

## Historial y Control (solo Dirección)
- Bitácora automática en la base de datos de cada cotización, pago, cambio de estado, cambio de total y movimiento fuera de lo normal: quién, cuándo, antes y después. Nadie la puede editar ni borrar.
- En la ficha de cada cliente: pestaña **Historial**.
- Pantalla **Control**: alertas de movimientos fuera de lo normal, pagos que no cuadran con su cotización y efectivo por persona.

## Decisiones (23 nov 2026, 22:15)
1. Cobro distinto a la cotización: **se bloquea** hasta que Administración (o Dirección) apruebe la diferencia.
2. El **historial** de cada cliente y la pantalla **Control** son solo de Dirección. Administración ve todo lo demás y aprueba diferencias.
3. Una cotización vale **7 días**.
4. **Confidencial:** el nombre de la directora no aparece en ningún texto, código, documento ni mensaje. Siempre «Dirección».

## Tareas de la ampliación
- ✅ R1 · Roles: Recepción y reservas activa; Administración ve todo (util.js + 0017 parte 4).
- ✅ R2 · Cotización con código `COT-XXXX`: se guarda al descargar el presupuesto, va impresa en el PDF, vale 7 días.
- ✅ R3 · En el pago: escribir el código trae lo que se cobra y el botón «Confirmar lo que se cobra». Si no coincide: motivo + solicitud de aprobación; el pago queda en espera.
- ✅ R4 · Aprobaciones: Administración y Dirección aprueban o rechazan; al aprobar se registra el pago.
- ✅ R5 · Bitácora inborrable (triggers) + Historial por cliente (solo Dirección).
- ✅ R6 · Pantalla Control (solo Dirección): alertas, pagos que no cuadran, efectivo por persona.
