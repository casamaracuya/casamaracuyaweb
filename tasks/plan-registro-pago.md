# Plan: registro-pago (SPEC-registro-pago.md)

Rama: `registro-pago`. Todo va en un PR a Edwar; la migración `0017_registro_pago.sql` la corre él. Pruebas con reservas de ensayo (`canal = 'Prueba'`).

## Tareas

### ✅ T1 · Código único de reserva (M)
La reserva confirmada recibe `CM-XXXXXX` aleatorio; se ve grande en la reserva con «Copiar» y «Enviar por WhatsApp»; se busca por código en Reservas.
- Criterios: único (índice único); 6 caracteres del alfabeto sin 0/O/1/I/L; las reservas confirmadas que ya existen reciben el suyo al correr la migración; buscar el código abre la reserva.
- Archivos: `supabase/migrations/0017_registro_pago.sql`, `src/admin/sheets.jsx`, `src/admin/views.jsx`.
- Depende de: nada.

### ✅ T2 · Pago con prueba, en la base de datos (S)
Columnas nuevas en `pagos`: referencia, moneda, tasa, monto en USD, ruta del comprobante, quién lo recibió, quién tiene el efectivo. Bucket privado `comprobantes` (solo equipo). `registrar_pago` acepta Recepción, exige comprobante, rechaza referencia repetida con el mismo método y confirma (y da código) solo cuando lo pagado cubre el 100 % del total.
- Criterios: los 5 rechazos dan un mensaje claro en español; un pago parcial se guarda sin confirmar.
- Archivos: `0017_registro_pago.sql`.
- Depende de: T1.

### ✅ T3 · Pantalla de registrar pago (M)
El formulario de pago de una reserva existente: método (6 opciones), moneda y tasa si es Bs., referencia (oculta en efectivo), subir foto o PDF (en efectivo: «foto del recibo firmado»), y debajo «Total · Pagado · Falta».
- Criterios: no deja enviar sin comprobante; al llegar al 100 % muestra el código nuevo; funciona en el celular con la cámara.
- Archivos: `src/admin/sheets.jsx`, `src/admin/util.js`, `src/admin/admin.css`.
- Depende de: T2.

### Revisión A
- [ ] `npm run build` limpio
- [ ] Reserva de ensayo: pago parcial (no confirma) → pago final (confirma, código, calendario bloqueado)
- [ ] Referencia repetida rechazada; comprobante no visible sin sesión
- [ ] Daniel lo prueba en el celular

### ✅ T4 · «Reserva pagada» en un solo formulario (M)
Botón junto a «Nueva reserva». Cliente + estadía + total + pago en una pantalla; la función `confirmar_reserva` lo guarda todo en una transacción (reusa el huésped si el teléfono o correo ya existen).
- Criterios: o se guarda todo o nada; choque de fechas explicado; correo obligatorio; sale con código y estado Confirmada.
- Archivos: `0017_registro_pago.sql`, `src/admin/sheets.jsx`, `src/admin/AdminApp.jsx`.
- Depende de: T3.

### T5 · Pagos en Ingresos (S)
Lista de pagos con fecha, cliente, código, método, referencia, quién lo registró y botón «Ver comprobante» (enlace temporal).
- Criterios: Dirección y Administración lo ven; Cocina y Limpieza no.
- Archivos: `src/admin/views.jsx`.
- Depende de: T2.

### Revisión B
- [ ] Build limpio, prueba completa en celular y PC
- [ ] Borrar las reservas de ensayo
- [ ] PR a Edwar con el enlace a esta especificación

## Riesgos
| Riesgo | Impacto | Qué hacemos |
|---|---|---|
| El código choca con uno existente | Bajo | Índice único y reintento dentro de la función |
| Fotos pesadas desde el celular | Medio | Reducir la imagen en el navegador antes de subirla (máx. ~1600 px) |
| Migración corrida a medias | Medio | Todo con `if not exists`, se puede repetir |
| Tasa en Bs. mal escrita | Medio | Mostrar el equivalente en USD antes de guardar |
