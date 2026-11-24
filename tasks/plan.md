# Plan de trabajo: Maracuyá Control · mejoras por etapa

## Resumen
Cuatro mejoras al panel (/admin), una etapa a la vez. Cada etapa deja el panel funcionando y se prueba con una reserva de ensayo antes de usarla con huéspedes reales. Los cambios de panel y base de datos van a Edwar en un PR; nunca push directo ni `--force`.

Hallazgo al revisar el código: la ficha de registro **ya existe** en el panel (migración 0009, función `guardar_ficha`), pero hoy la pasa el equipo desde el papel. La Etapa 2 solo tiene que dejar que el huésped la llene él mismo, así que es más corta de lo que parecía.

## Decisiones de arquitectura
- Etapa 1 sin costo: botones `wa.me` con el texto listo (como `taskWa` y el botón de gracias en `sheets.jsx`), nada de API de WhatsApp todavía.
- Los textos viven en el código (ES y EN) en la primera versión; editarlos desde el panel queda para después.
- La página del huésped usa un enlace secreto por reserva y funciones `security definer` que devuelven solo lo necesario; el público no lee tablas directamente.
- Fotos de la Etapa 3 reutilizan la subida de fotos que ya tienen las tareas (`tareas.foto_url`, bucket `danos`).

## Lista de tareas

### Etapa 0 · Antes de programar (Daniel y Dirección)
- [ ] T0. Escribir los 7 mensajes en ES y EN y que Dirección los apruebe.

### Etapa 1 · Mensajes con un toque
- [ ] T1. Un mensaje completo de punta a punta: «Bienvenidos a casa» aparece en «Hoy» el día de llegada, botón abre WhatsApp con el texto, y queda marcado como enviado.
  - Criterios: aparece solo el día que toca; al tocar se marca enviado y desaparece de «Hoy»; muestra quién lo envió.
  - Archivos: `supabase/migrations/0017_mensajes.sql` (tabla `mensajes_enviados`), `src/admin/util.js`, `src/admin/views.jsx`. Tamaño: M.
- [ ] T2. Sumar los otros 6 mensajes al mismo mecanismo (confirmación, 7 días antes, 1 día antes, mitad de estadía si son 3+ noches, salida, gracias).
  - Criterios: cada uno aparece en su fecha; el de gracias reemplaza al botón actual; nada se duplica. Archivos: `util.js`, `views.jsx`, `sheets.jsx`. Tamaño: S.
- [ ] T3. En la ficha de cada reserva, bloque «Mensajes» con los 7 y su estado (pendiente / enviado / no aplica), con opción de enviarlo antes.
  - Archivos: `sheets.jsx`. Tamaño: S.
- [ ] **Revisión 1:** build limpio, reserva de ensayo recorre los 7 mensajes, Edwar revisa el PR.

### Etapa 2 · Página del huésped
- [ ] T4. Enlace secreto por reserva y página pública `casa-maracuya.com/estadia/<enlace>` con fechas, cómo llegar, horarios y normas (solo lectura).
  - Criterios: un enlace inventado no muestra nada; no aparecen datos de otros huéspedes ni precios. Archivos: migración 0018, `src/routes.jsx`, `src/site/Estadia.jsx`, `i18n.js`. Tamaño: M.
- [ ] T5. La ficha de registro en línea dentro de esa página, guardando en los mismos campos que usa hoy el equipo.
  - Criterios: mismas validaciones que `guardar_ficha`; el panel muestra «llenada por el huésped · falta firma al llegar»; se puede corregir hasta el día de llegada. Tamaño: M.
- [ ] T6. El enlace va dentro del mensaje 1 y 2; aviso en «Hoy» si a 2 días de la llegada la ficha sigue vacía. Tamaño: S.
- [ ] **Revisión 2:** revisión de seguridad (cédulas y datos personales), prueba en celular, Edwar revisa el PR.

### Etapa 3 · Listas de revisión con foto
- [ ] T7. Listas por espacio (4 habitaciones + exteriores) con sus puntos, guardadas en la base. Migración 0019 + datos iniciales. Tamaño: S.
- [ ] T8. La tarea de limpieza abre su lista; se marcan los puntos; foto obligatoria al terminar; la habitación pasa a «lista».
  - Archivos: `sheets.jsx`, `views.jsx`, `admin.css`. Tamaño: M.
- [ ] T9. Calidad ve lista y foto, y la pasa a «revisada» o la devuelve con nota. Tamaño: S.
- [ ] **Revisión 3:** limpieza real de una habitación con el celular, Edwar revisa el PR.

### Etapa 4 · Airbnb y Booking (solo si publican allí)
- [ ] T10. Calendario de salida `.ics` con noches ocupadas (sin nombres) para pegar en Airbnb/Booking. Edge function. Tamaño: S.
- [ ] T11. Importar los calendarios de Airbnb/Booking cada cierto tiempo y convertirlos en bloqueos. Edge function programada + ajustes. Tamaño: M.
- [ ] **Revisión 4:** una reserva de prueba en cada lado bloquea el otro.

## Riesgos
| Riesgo | Impacto | Qué hacemos |
|---|---|---|
| Se olvida tocar el botón del mensaje | Medio | Queda en «Hoy» hasta que se marque; contador visible |
| Enlace del huésped compartido con otros | Alto | Enlace largo e imposible de adivinar; caduca días después de la salida; sin precios ni datos de terceros |
| iCal tarda en sincronizar → doble venta | Alto | Solo si publican; avisar en el panel la última sincronización |
| Migraciones corridas a mano en Supabase | Medio | Edwar las corre; cada una se puede repetir sin romper |

## Preguntas abiertas
- ¿Dirección aprueba los 7 textos tal como están en la propuesta?
- ¿La firma de la ficha sigue en papel al llegar, o basta la aceptación en línea?
- ¿Publicarán en Airbnb o Booking?
