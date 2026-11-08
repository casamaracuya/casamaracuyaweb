# Casa Maracuyá

Web pública de Casa Maracuyá y su panel privado **Maracuyá Control**, en un solo proyecto.

| Dirección | Qué es |
|---|---|
| `casa-maracuya.com/` | La web que ve el huésped (español e inglés, día y noche, solicitud por WhatsApp) |
| `casa-maracuya.com/admin` | El panel del equipo: reservas, calendario, huéspedes, tareas, cocina, limpieza, mantenimiento, pagos |

Hecho con **React + Vite**, datos en **Supabase**, publicado en **Cloudflare Pages** desde **GitHub**.

> El panel necesita Supabase conectado (paso 2). Sin las llaves, `/admin` muestra el aviso «Falta conectar Supabase». La web pública sí funciona sin ellas: las solicitudes se envían solo por WhatsApp.

---

## 1. Probarlo en tu computadora

Necesitas [Node.js 20](https://nodejs.org).

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` (web) y `http://localhost:5173/admin` (panel).

---

## 2. Supabase (base de datos y usuarios)

1. Crea un proyecto en [supabase.com](https://supabase.com). Región sugerida: la más cercana a Venezuela (por ejemplo, *East US*).
2. Ve a **SQL Editor › New query** y corre, en este orden, el contenido de:
   1. `supabase/migrations/0001_esquema.sql` — tablas, roles, permisos y reglas del negocio.
   2. `supabase/migrations/0002_tiempo_real.sql` — para que el panel se actualice solo.
   3. `supabase/migrations/0004_huespedes_tareas_ingresos.sql` — ficha de huéspedes con familia y cumpleaños, tareas que se toman, solo ingresos y liberación automática de pre-reservas. Si ya corriste las anteriores, corre solo esta.
3. **Invita a la dueña:** *Authentication › Users › Invite user* con su correo.
4. Abre `supabase/migrations/0003_primer_usuario.sql`, cambia el correo y el nombre, y córrelo. Eso le da el rol de Dirección.
5. Desde el panel, ella asigna los roles del resto del equipo en **Más › Equipo**. A cada persona nueva primero la invitas en Supabase (paso 3) y luego le das su rol.
6. En *Authentication › URL Configuration* pon:
   - **Site URL:** `https://casa-maracuya.com`
   - **Redirect URLs:** `https://casa-maracuya.com/admin` y `http://localhost:5173/admin`
7. Copia la URL y la llave publishable de *Project Settings › API Keys* a un archivo `.env.local` (usa `.env.example` como guía):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_WHATSAPP=584121234567
```

La llave **publishable** (o la antigua **anon**) es pública por diseño: la seguridad la ponen los permisos por rol (Row Level Security) del archivo SQL. **Nunca** pongas la llave `service_role` en este proyecto.

### Lo que hace la base de datos sola

- **Nunca hay doble reserva.** Dos reservas pre-reservadas, confirmadas o en casa no pueden compartir noches. Lo impide la base de datos, no solo la pantalla.
- **La web pública solo puede crear solicitudes** (estado *Nueva*). No puede leer reservas ni datos de huéspedes.
- **Pre-reservas que vencen:** se liberan solas cada 15 minutos (pg_cron, lo activa `0004`). Si esa parte da error, activa *pg_cron* en *Database › Extensions* y vuelve a correr las dos últimas líneas de `0004`.
- **Huéspedes que vuelven:** si una solicitud llega con un teléfono que ya existe, se guarda en la ficha de esa persona en vez de crear otra.
- **Tareas automáticas:** al confirmar una reserva se crean las tareas de cocina, limpieza y mantenimiento. Al despedir al huésped, las de salida. Cada persona puede tomar las tareas sin asignar de su área, ponerlas en proceso y marcarlas como hechas; Dirección y Recepción también pueden asignarlas.
- **Fotos de daños:** se guardan en Storage (carpeta privada `danos`). Solo el equipo puede verlas.

### Quién ve qué

| Rol | Ve | Puede |
|---|---|---|
| Dirección | Todo | Todo, más tarifas, promociones y roles del equipo |
| Administración | Reservas, pagos e ingresos | Registrar pagos (confirma la reserva), ver los reportes de ingresos |
| Recepción | Reservas, calendario, huéspedes, tareas | Mover estados, crear reservas y tareas |
| Cocina | Fichas con plan, alergias y gustos | Menús, lista de compras, anotar gustos |
| Limpieza | Habitaciones y sus tareas | Cambiar el estado de las habitaciones |
| Mantenimiento | Tareas, daños, calendario | Reportar daños con foto, bloquear fechas |

### Correos con Resend (invitaciones y contraseñas)

El correo que trae Supabase solo envía unos 2 por hora («email rate limit exceeded»). Para invitar al equipo sin ese límite y que los correos salgan de `casa-maracuya.com`:

1. Crea una cuenta en [resend.com](https://resend.com).
2. **Domains › Add domain** › `casa-maracuya.com`, región *North Virginia (us-east-1)*. Resend te muestra 3 o 4 registros DNS (un **MX** y un **TXT** en `send`, y un **TXT** en `resend._domainkey`).
3. Agrega esos registros donde se maneje el DNS del dominio hoy (Squarespace: *Domains › casa-maracuya.com › DNS › Custom records*; o Cloudflare: *DNS › Records*). Copia nombre, tipo y valor tal cual. Si en Cloudflare aparece la nube naranja, ponla en gris (*DNS only*).
4. En Resend toca **Verify DNS records**. Puede tardar de minutos a unas horas.
5. **API Keys › Create API key**, permiso *Sending access*, dominio `casa-maracuya.com`. Cópiala (empieza con `re_`); solo se muestra una vez.
6. En Supabase: **Authentication › Emails › SMTP Settings › Enable custom SMTP**:
   - **Sender email:** `no-responder@casa-maracuya.com`
   - **Sender name:** `Casa Maracuyá`
   - **Host:** `smtp.resend.com` · **Port:** `465`
   - **Username:** `resend` · **Password:** la API key `re_...`
7. **Authentication › Rate Limits:** sube *Rate limit for sending emails* (por ejemplo, 30 por hora).
8. **Authentication › Emails › Templates:** pasa al español los correos *Invite user* y *Reset password* (ver abajo).

La API key de Resend va solo en Supabase. **No** la pongas en `.env.local` ni en Cloudflare. Si más adelante mueves el DNS a Cloudflare (paso 5), confirma que estos registros también se copiaron.

**Invite user**, asunto: `Te invitamos al panel de Casa Maracuyá`

```html
<h2>Te damos la bienvenida al equipo de Casa Maracuyá</h2>
<p>Te dieron acceso a Maracuyá Control, el panel de la casa.</p>
<p><a href="{{ .ConfirmationURL }}">Crear mi contraseña y entrar</a></p>
<p>Si no esperabas este correo, puedes ignorarlo.</p>
```

**Reset password**, asunto: `Tu contraseña de Maracuyá Control`

```html
<h2>Contraseña nueva</h2>
<p>Pediste cambiar tu contraseña del panel de Casa Maracuyá.</p>
<p><a href="{{ .ConfirmationURL }}">Crear una contraseña nueva</a></p>
<p>Si no lo pediste tú, ignora este correo: tu contraseña sigue igual.</p>
```

---

## 3. GitHub

```bash
git init
git add .
git commit -m "Casa Maracuyá: web y panel"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/casa-maracuya.git
git push -u origin main
```

El archivo `.env.local` no se sube (está en `.gitignore`). Las llaves van en Cloudflare (paso 4).

---

## 4. Cloudflare Pages

1. En Cloudflare: **Workers & Pages › Create › Pages › Connect to Git** y elige el repositorio.
2. Configuración de compilación:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. En **Environment variables** (Production y Preview) agrega `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WHATSAPP` y `NODE_VERSION` = `20`.
4. Guarda y despliega. Cada `git push` a `main` publica la web sola.

`public/_redirects` hace que `/admin/...` funcione al recargar la página. `public/_headers` agrega caché para fotos y videos, y le dice a Google que no indexe el panel.

---

## 5. El dominio casa-maracuya.com (de Squarespace a Cloudflare)

1. En Cloudflare: **Add a site** › escribe `casa-maracuya.com` › plan *Free*. Cloudflare copia los registros DNS que tenga hoy.
2. Revisa esos registros. Si tienen **correo** con ese dominio, asegúrate de que los registros **MX** y **TXT** sigan ahí.
3. Cloudflare te da dos **nameservers** (algo como `ana.ns.cloudflare.com`).
4. En Squarespace: **Domains › casa-maracuya.com › DNS › Nameservers › Use custom nameservers** y pega los dos de Cloudflare. Si el dominio está bloqueado, primero desactiva *Domain lock*.
5. Espera a que Cloudflare diga **Active** (de minutos a 24 horas).
6. En tu proyecto de Pages: **Custom domains › Set up a custom domain** › `casa-maracuya.com` y luego también `www.casa-maracuya.com`.
7. Cuando cargue con candado, vuelve a Supabase (paso 2.6) y confirma la Site URL.

Cambiar los nameservers basta para que Cloudflare maneje el dominio. Si además quieres **transferir el registro** del dominio a Cloudflare (para renovarlo ahí), hazlo después de que esté *Active*: Squarespace te da el código de autorización y Cloudflare lo pide en *Domain Registration › Transfer*.

---

## Estructura

```
public/            fotos, videos, logos, _redirects, _headers
src/site/          la web pública (Site.jsx, textos en i18n.js, site.css)
src/admin/         el panel (AdminApp, vistas, hojas, íconos, admin.css)
src/lib/api.js     todas las consultas a Supabase
supabase/          el SQL de la base de datos
```

## Pendiente por definir con la dueña

Las tarifas por temporada, los medios de pago y el monto del anticipo, las políticas de la casa y el equipo real. Todo se puede cargar desde el panel cuando esté listo.
