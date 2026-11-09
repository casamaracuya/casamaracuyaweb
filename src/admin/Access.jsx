// Pantallas de acceso al panel: entrar, crear contraseña, sin rol, sin configurar y carga.
// Todas comparten «la llegada»: una foto de la casa según la hora y el formulario sobre arena.
import { useState } from "react";
import { api } from "../lib/api.js";
import { LINK_ERROR } from "../lib/supabase.js";
import { Icon } from "./ui.jsx";

function moment() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { hi: "Buenos días", img: "/fotos/faro-piscina.jpg", pos: "62% 40%", alt: "El faro de Adícora visto desde el jardín de la casa" };
  if (h >= 12 && h < 19) return { hi: "Buenas tardes", img: "/fotos/muelle-atardecer.jpg", pos: "40% 50%", alt: "El muelle de la casa al atardecer" };
  return { hi: "Buenas noches", img: "/fotos/noche-pergola.jpg", pos: "50% 30%", alt: "Las palmeras sobre la pérgola iluminada de noche" };
}

// En el celular, al abrir el teclado: sube la página lo justo para que el botón del formulario
// quede visible encima del teclado, sin esconder el campo donde se está escribiendo.
function keepButtonVisible(e) {
  const input = e.target;
  if (input.tagName !== "INPUT" || !input.form) return;
  setTimeout(() => {
    const btn = input.form.querySelector(".door-btn"); if (!btn) return;
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : innerHeight);
    const b = btn.getBoundingClientRect(), i = input.getBoundingClientRect();
    const need = b.bottom + 16 - bottom;            // cuánto falta para ver el botón
    const room = i.top - 12 - top;                  // cuánto se puede subir sin tapar el campo
    const by = Math.min(need, room);
    if (by > 0) window.scrollBy({ top: by, behavior: "smooth" });
  }, 350);
}

function Door({ title, lead, children, foot = true }) {
  const [m] = useState(moment);
  return <div className="door" onFocusCapture={keepButtonVisible}>
    <figure className="door-photo">
      <img src={m.img} alt={m.alt} style={{ objectPosition: m.pos }} fetchpriority="high" decoding="async" />
      <img className="door-logo" src="/logo/logo-claro.svg" alt="Maracuyá Relaxing Getaway" width="132" height="53" />
      <figcaption>Adícora · Falcón</figcaption>
    </figure>
    <main className="door-panel">
      <div className="door-in">
        <header className="door-head">
          <h1>{typeof title === "function" ? title(m.hi) : title}</h1>
          {lead && <p>{lead}</p>}
        </header>
        {children}
        {foot && <a className="door-back" href="/"><Icon n="chevL" c="xs" />Volver a la página web</a>}
      </div>
    </main>
  </div>;
}

function Field({ id, label, type = "text", value, onChange, autoComplete, placeholder, hint, invalid }) {
  const [show, setShow] = useState(false);
  const pw = type === "password";
  return <div className="fld">
    <label htmlFor={id}>{label}</label>
    <div className={`fld-box ${invalid ? "bad" : ""}`}>
      <input id={id} type={pw && show ? "text" : type} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder}
        spellCheck={false} autoCapitalize="none" aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-h` : undefined} />
      {pw && <button type="button" className="fld-eye" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show}>
        <svg viewBox="0 0 256 256" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
          <path d="M128 56C48 56 16 128 16 128s32 72 112 72 112-72 112-72-32-72-112-72Z" /><circle cx="128" cy="128" r="40" />
          {show && <path d="M48 40l160 176" />}
        </svg>
      </button>}
    </div>
    {hint && <div className="fld-hint" id={`${id}-h`}>{hint}</div>}
  </div>;
}

const Alert = ({ kind = "err", children }) =>
  <div className={`door-msg ${kind}`} role={kind === "err" ? "alert" : "status"}><Icon n={kind === "err" ? "alert" : "check"} c="s" w={kind === "err" ? "f" : "b"} /><span>{children}</span></div>;

const Submit = ({ busy, children, busyText }) =>
  <button className="door-btn press" type="submit" disabled={busy} aria-busy={busy}>{busy ? <><span className="spin" aria-hidden="true" />{busyText}</> : children}</button>;

/* ---------- Entrar ---------- */
export function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [err, setErr] = useState(LINK_ERROR ? "Ese enlace ya venció o ya se usó. Escribe tu correo y toca «Olvidé mi contraseña» para recibir uno nuevo." : "");
  const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false); const [sending, setSending] = useState(false);
  const submit = async e => { e.preventDefault(); setErr(""); setInfo("");
    if (!email.trim() || !pw) return setErr("Escribe tu correo y tu contraseña.");
    setBusy(true);
    try { await api.signIn(email.trim(), pw); }
    catch (x) { setErr(/invalid/i.test(x.message) ? "El correo o la contraseña no coinciden. Revisa e intenta de nuevo." : /rate limit/i.test(x.message) ? "Demasiados intentos seguidos. Espera unos minutos." : x.message); setBusy(false); } };
  const forgot = async () => { setErr(""); setInfo("");
    if (!email.trim()) return setErr("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».");
    setSending(true);
    try { await api.resetPassword(email.trim()); setInfo(`Te enviamos un enlace a ${email.trim()} para crear una contraseña nueva.`); }
    catch (x) { setErr(/rate limit/i.test(x.message) ? "Ya enviamos varios correos. Espera un rato antes de pedir otro." : x.message); }
    setSending(false); };
  return <Door title={hi => <>{hi}.</>} lead="Entra al panel de la casa con el correo que te dieron.">
    <form className="door-form" onSubmit={submit} noValidate>
      <Field id="lgEmail" label="Correo" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="tu@correo.com" />
      <Field id="lgPw" label="Contraseña" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
      {err && <Alert>{err}</Alert>}{info && <Alert kind="ok">{info}</Alert>}
      <Submit busy={busy} busyText="Entrando…">Entrar</Submit>
      <button type="button" className="door-link" onClick={forgot} disabled={sending}>{sending ? "Enviando enlace…" : "Olvidé mi contraseña"}</button>
    </form>
  </Door>;
}

/* ---------- Crear contraseña (invitación o recuperación) ---------- */
export function SetPassword({ invite, email, onDone }) {
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const long = pw.length >= 8, same = !!pw && pw === pw2;
  const submit = async e => { e.preventDefault(); setErr("");
    if (!long) return setErr("La contraseña debe tener al menos 8 caracteres.");
    if (!same) return setErr("Las dos contraseñas no coinciden.");
    setBusy(true);
    try { await api.updatePassword(pw); onDone(); }
    catch (x) { setErr(/same|different/i.test(x.message) ? "Elige una contraseña distinta de la anterior." : x.message); setBusy(false); } };
  return <Door foot={false} title={invite ? "Te damos la bienvenida." : "Una contraseña nueva."}
    lead={<>{invite ? "Crea la contraseña con la que vas a entrar al panel" : "Escríbela dos veces y entras directo al panel"}{email ? <> como <b>{email}</b></> : null}.</>}>
    <form className="door-form" onSubmit={submit} noValidate>
      <Field id="npPw" label="Contraseña" type="password" value={pw} onChange={setPw} autoComplete="new-password" />
      <Field id="npPw2" label="Repítela" type="password" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={!!pw2 && !same && pw2.length >= pw.length} />
      <ul className="door-checks" aria-label="Requisitos">
        <li className={long ? "on" : ""}><Icon n="check" c="xs" w="b" />Al menos 8 caracteres</li>
        <li className={same ? "on" : ""}><Icon n="check" c="xs" w="b" />Las dos coinciden</li>
      </ul>
      {err && <Alert>{err}</Alert>}
      <Submit busy={busy} busyText="Guardando…">Guardar y entrar</Submit>
    </form>
  </Door>;
}

/* ---------- Usuario sin rol ---------- */
export function NoRole({ me }) {
  const [busy, setBusy] = useState(false);
  return <Door title={<>Hola, <em>{me.name.split(" ")[0]}</em>.</>} lead="Ya tienes usuario, pero todavía no tienes un área asignada. Pídele a Dirección que te dé tu rol en Más › Equipo y vuelve a entrar.">
    <div className="door-form">
      <button className="door-btn press" onClick={() => location.reload()}>Ya me lo dieron, entrar</button>
      <button type="button" className="door-link" disabled={busy} onClick={async () => { setBusy(true); await api.signOut(); location.reload(); }}>Cerrar sesión</button>
    </div>
  </Door>;
}

/* ---------- Faltan las llaves de Supabase ---------- */
export function NotConfigured() {
  return <Door title="Falta conectar Supabase." lead={<>Agrega <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en <code>.env.local</code> (en tu computadora) o en las variables de Cloudflare Pages, y vuelve a compilar.</>} />;
}

/* ---------- Carga ---------- */
export function Splash({ msg, label = "Abriendo la casa", leaving }) {
  return <div className={`splash ${leaving ? "leaving" : ""}`} aria-busy={!msg && !leaving} aria-hidden={leaving || undefined}>
    <div className="splash-in">
      <div className={`splash-mark ${msg ? "still" : ""}`}>
        <img src="/logo/simbolo.svg" alt="" width="58" height="80" />
        <svg className="splash-wind" viewBox="0 0 160 40" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round">
          <path pathLength="1" d="M4 22 C34 8 58 34 88 20 S136 6 156 18" strokeWidth="2" />
          <path pathLength="1" d="M30 34 C56 26 80 38 108 30 c12 -3 16 -12 8 -15 c-6 -2 -11 3 -7 7" strokeWidth="1.4" />
        </svg>
      </div>
      {msg ? <>
        <h1>No pudimos abrir el panel.</h1>
        <p>{/fetch|network/i.test(msg) ? "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo." : msg}</p>
        <div className="splash-act"><button className="door-btn press" onClick={() => location.reload()}>Reintentar</button></div>
      </> : <p className="splash-label" role="status">{label}<span className="dots" aria-hidden="true"><i /><i /><i /></span></p>}
    </div>
  </div>;
}
