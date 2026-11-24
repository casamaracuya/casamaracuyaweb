# Mapa de módulos: el recorrido de una reserva con código

Idea de Daniel (23 nov 2026): el código de reserva es la llave de todo. Se genera al registrar el pago, avisa a todos, abre el portal del huésped, se usa en la llegada y en la salida, y al cerrar deja al huésped en la despedida y la reseña.

## Lo que ya existe en el panel
- Código de reserva: `R-1012`, consecutivo (fácil de adivinar: no sirve como llave del portal).
- Registrar pago: monto y método. No guarda referencia ni comprobante adjunto.
- Correo de confirmación al huésped con comprobante (edge function `enviar-comprobante`, Resend).
- Ficha de registro: el equipo la pasa desde el papel (migración 0009, `guardar_ficha`).
- Tareas automáticas por área al confirmar y al finalizar (migración 0011).

## Módulos

| Id | Qué hace | Depende de |
|---|---|---|
| `solicitudes` | Pantalla aparte para las solicitudes que llegan (web, Instagram, WhatsApp), con fecha de solicitud. El sistema revisa solo si hay cupo en el rango pedido y, si no, propone las fechas libres más cercanas. «Reservas» queda solo para las pagadas con código. | — |
| `registro-pago` | La persona del WhatsApp registra la reserva con los datos del cliente, el pago (método, referencia, comprobante adjunto; efectivo con recibo) y se genera el código único tipo vuelo (ej. `CM-7K4Q9X`). Bloquea el calendario. | — |
| `avisos` | Cada evento de la reserva dispara avisos: correo a Dirección con el recibo, aviso a cocina, limpieza y operaciones, y al cliente por correo y WhatsApp. | `registro-pago` |
| `portal-huesped` | El cliente entra con correo + código. Primero llena la ficha; al terminarla ve wifi, menús, actividades, cómo llegar y normas. | `registro-pago`, `avisos` |
| `contenido-estadia` | Pantalla del panel donde recepción carga wifi, menús, actividades e información que ve el huésped. | — |
| `llegada-salida` | Recepción abre la reserva con el código al llegar (hora real, quiénes llegaron, vehículos, novedades) y al salir (revisión de la casa, daños, saldo, cierre a las 11:00). | `registro-pago`, `portal-huesped` |
| `despedida` | Al cerrar la reserva, el portal cambia a: gracias, reseña, comentario y «vuelve cuando quieras». | `llegada-salida` |

Orden: `registro-pago` (en curso) → `solicitudes` → `avisos` → `contenido-estadia` y `portal-huesped` → `llegada-salida` → `despedida`.

Cada módulo tendrá su propia especificación (`SPEC-<id>.md`) cuando se apruebe este mapa.

## Decisiones de Daniel (23 nov 2026)
- `solicitudes` guarda por dónde llegó cada solicitud (web, Instagram, WhatsApp, Google, recomendación, Airbnb…) y su fecha.
- Después de `solicitudes`: un tablero (`tablero-solicitudes`) con gráficas de solicitudes por canal, por mes, cuántas se vuelven reservas y fechas más pedidas.
