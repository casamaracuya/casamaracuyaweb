import { useEffect, useState } from "react";
import "./site.css";
import { usePrefs, PageHeader, PageFooter, EMAIL, WA_URL } from "./shared.jsx";
import { PATHS } from "./paths.js";
import { MAPS_URL } from "../lib/contacto.js";
import { portalEntrar, portalGuardarFicha, portalFirmar } from "../lib/api.js";
import Ficha from "./Ficha.jsx";

// «Mi reserva»: el apartado del cliente (SPEC-portal-huesped.md). Entra con el código
// CM- de su reserva y su apellido; no hay cuenta ni contraseña. El código viene en el
// enlace que le envía Recepción (/mi-reserva?c=CM-XXXXXX). Mientras la pestaña siga
// abierta no tiene que volver a escribirlo (sessionStorage).
// Paso 1: la ficha de registro. Paso 2: su estadía (se abre al firmar la ficha).

const KEY = "maracuya-mi-reserva";
const TX = {
  es: {
    doc: "Mi reserva · Casa Maracuyá", eyebrow: "Mi reserva", title: "Tu estadía en Casa Maracuyá",
    lead: "Escribe el código de tu reserva y tu apellido. El código empieza por CM- y está en el mensaje que te enviamos.",
    codigo: "Código de la reserva", codigoPh: "CM-XXXXXX", apellido: "Tu apellido", apellidoPh: "Como aparece en la reserva",
    entrar: "Entrar", entrando: "Entrando…", falta: "Escribe el código y tu apellido.",
    sinConexion: "No pudimos conectarnos. Revisa tu internet y vuelve a probar.",
    hola: "Hola,", tuCodigo: "Tu código", llegada: "Llegada", salida: "Salida", noches: "noches", noche: "noche",
    personas: "personas", plan: "Plan", plans: { esencial: "Experiencia Esencial", plena: "Experiencia Plena" },
    desde: "desde las 3:00 PM", hasta: "hasta las 11:00 AM",
    paso: "Paso", p1: "Ficha de registro", p1d: "Los datos de quienes se quedan en la casa, la comida y la firma de las normas. Te toma unos 5 minutos y te ahorra el papeleo al llegar.",
    p1pend: "Pendiente", p1parte: "La empezaste: sigue donde ibas", p1ok: "Firmada el",
    llenar: "Llenar la ficha", seguir: "Seguir con la ficha", ver: "Ver o corregir la ficha",
    p2: "Tu estadía", p2lock: "Se abre cuando firmes la ficha.",
    horarios: "Horarios", hIn: "Check-in desde las 3:00 PM", hOut: "Check-out hasta las 11:00 AM", hServ: "El equipo te atiende de 7:30 AM a 9:30 PM",
    llegar: "Cómo llegar", llegarD: "Adícora, Falcón · al lado del faro", maps: "Abrir en Google Maps",
    comprobante: "Comprobante de pago", comprobanteD: "Tu reserva y lo que has pagado, para guardar o imprimir.", verComp: "Ver comprobante",
    normas: "Normas de la casa", normasD: "Lo que acordamos para que todos disfruten la casa.", verNormas: "Leer las normas",
    ayuda: "¿Necesitas algo?", correo: "Correo", ayudaD: "Escríbenos por WhatsApp o al correo y te respondemos.",
    salir: "Salir", noEsTuya: "¿No es tu reserva?"
  },
  en: {
    doc: "My booking · Casa Maracuyá", eyebrow: "My booking", title: "Your stay at Casa Maracuyá",
    lead: "Enter your booking code and your last name. The code starts with CM- and it's in the message we sent you.",
    codigo: "Booking code", codigoPh: "CM-XXXXXX", apellido: "Your last name", apellidoPh: "As it appears on the booking",
    entrar: "Sign in", entrando: "Signing in…", falta: "Enter the code and your last name.",
    sinConexion: "We couldn't connect. Check your internet and try again.",
    hola: "Hi,", tuCodigo: "Your code", llegada: "Check-in", salida: "Check-out", noches: "nights", noche: "night",
    personas: "guests", plan: "Plan", plans: { esencial: "Essential Experience", plena: "Full Experience" },
    desde: "from 3:00 PM", hasta: "by 11:00 AM",
    paso: "Step", p1: "Registration form", p1d: "Who's staying at the house, food preferences and your signature on the house rules. It takes about 5 minutes and saves you the paperwork on arrival.",
    p1pend: "To do", p1parte: "You started it: pick up where you left off", p1ok: "Signed on",
    llenar: "Fill in the form", seguir: "Continue the form", ver: "View or edit the form",
    p2: "Your stay", p2lock: "Opens once you sign the form.",
    horarios: "Times", hIn: "Check-in from 3:00 PM", hOut: "Check-out by 11:00 AM", hServ: "Our team is available 7:30 AM to 9:30 PM",
    llegar: "Getting here", llegarD: "Adícora, Falcón · next to the lighthouse", maps: "Open in Google Maps",
    comprobante: "Payment receipt", comprobanteD: "Your booking and what you've paid, to save or print.", verComp: "View receipt",
    normas: "House rules", normasD: "What we agree on so everyone enjoys the house.", verNormas: "Read the rules",
    ayuda: "Need anything?", correo: "Email", ayudaD: "Message us on WhatsApp or by email and we'll get back to you.",
    salir: "Sign out", noEsTuya: "Not your booking?"
  }
};

const leer = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } };
const guardar = v => { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };

export default function MiReserva({ lang = "es" }) {
  const qs = typeof location !== "undefined" ? location.search : "";
  const p = usePrefs(lang, { es: "/mi-reserva" + qs, en: "/en/my-booking" + qs });
  const t = TX[p.lang] || TX.es;
  const enlace = typeof location !== "undefined" ? (new URLSearchParams(location.search).get("c") || "").toUpperCase() : "";
  const [codigo, setCodigo] = useState(enlace);
  const [apellido, setApellido] = useState("");
  const [d, setD] = useState(null);          // lo que devuelve portal_entrar
  const [estado, setEstado] = useState("inicio"); // inicio | entrando | dentro
  const [error, setError] = useState("");
  const [vista, setVista] = useState("inicio"); // inicio | ficha

  useEffect(() => { document.title = t.doc; }, [t]);

  const entrar = async (c, a, silencioso) => {
    setEstado("entrando"); setError("");
    try {
      const r = await portalEntrar(c, a);
      if (r?.ok) {
        setD(r); setEstado("dentro"); guardar({ c, a });
        // El código no se queda en la barra de direcciones (ni en el historial ni en capturas).
        if (location.search) history.replaceState(null, "", location.pathname);
        return;
      }
      guardar(null); setEstado("inicio"); if (!silencioso) setError(r?.error || t.sinConexion);
    } catch {
      setEstado("inicio"); if (!silencioso) setError(t.sinConexion);
    }
  };

  // Si ya entró en esta pestaña (y el enlace no es de otra reserva), entra solo.
  useEffect(() => {
    const s = leer();
    if (s?.c && s?.a && (!enlace || norm(enlace) === norm(s.c))) { setCodigo(s.c); setApellido(s.a); entrar(s.c, s.a, true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = e => {
    e.preventDefault();
    if (!codigo.trim() || apellido.trim().length < 2) { setError(t.falta); return; }
    entrar(codigo.trim(), apellido.trim());
  };
  // Cada parte de la ficha se guarda con el mismo código y apellido con que entró.
  const guardarParte = async (parte, datos) => {
    const s = leer() || { c: codigo, a: apellido };
    const r = parte === 6 ? await portalFirmar(s.c, s.a, datos) : await portalGuardarFicha(s.c, s.a, parte, datos);
    if (r?.ok) setD(r);
    return r;
  };
  const salir = () => { guardar(null); setD(null); setApellido(""); setEstado("inicio"); setVista("inicio"); };

  return (
    <>
      <PageHeader {...p} />
      <main className="mr-page linen">
        <div className="wrap">
          {estado !== "dentro"
            ? <Entrada t={t} codigo={codigo} setCodigo={setCodigo} apellido={apellido} setApellido={setApellido} enviar={enviar} error={error} entrando={estado === "entrando"} />
            : vista === "ficha"
              ? <Ficha lang={p.lang} d={d} guardarParte={guardarParte} volver={() => { setVista("inicio"); window.scrollTo(0, 0); }} />
              : <Dentro t={t} lang={p.lang} d={d} abrirFicha={() => setVista("ficha")} salir={salir} />}
        </div>
      </main>
      <PageFooter t={p.t} lang={p.lang} />
    </>
  );
}

const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(?!CM)/, "CM");

function Entrada({ t, codigo, setCodigo, apellido, setApellido, enviar, error, entrando }) {
  return (
    <section className="mr-login">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="mr-lead">{t.lead}</p>
      <form className="mr-card" noValidate onSubmit={enviar}>
        <div className="field">
          <label htmlFor="mr-codigo">{t.codigo}</label>
          <input id="mr-codigo" autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder={t.codigoPh}
            value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={12} />
        </div>
        <div className="field">
          <label htmlFor="mr-apellido">{t.apellido}</label>
          <input id="mr-apellido" autoComplete="family-name" placeholder={t.apellidoPh} value={apellido}
            onChange={e => setApellido(e.target.value)} maxLength={80} autoFocus={!!codigo} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={entrando}>{entrando ? t.entrando : t.entrar}</button>
      </form>
      <p className="mr-help">{t.ayudaD} <a href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a> · <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
    </section>
  );
}

function Dentro({ t, lang, d, abrirFicha, salir }) {
  const r = d.reserva, f = d.ficha;
  const locale = lang === "en" ? "en-US" : "es-VE";
  const fecha = s => new Date(s + "T00:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
  const firmada = f.firmada ? new Date(f.firmada).toLocaleDateString(locale, { day: "numeric", month: "long" }) : null;
  const empezada = !firmada && (f.hora_llegada || f.adultos || (f.ocupantes || []).length);
  const nombre = String(f.nombre || "").trim().split(/\s+/)[0];
  return (
    <>
      <section className="mr-hello">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.hola} <em>{nombre}</em></h1>
        <dl className="mr-stay">
          <div><dt>{t.tuCodigo}</dt><dd className="mr-code">{r.codigo}</dd></div>
          <div><dt>{t.llegada}</dt><dd>{fecha(r.llegada)}<small>{t.desde}</small></dd></div>
          <div><dt>{t.salida}</dt><dd>{fecha(r.salida)}<small>{t.hasta}</small></dd></div>
          <div><dt>{t.plan}</dt><dd>{t.plans[r.plan] || r.plan}<small>{r.noches} {r.noches === 1 ? t.noche : t.noches} · {r.personas} {t.personas}</small></dd></div>
        </dl>
      </section>

      <ol className="mr-steps">
        <li className={`mr-step ${firmada ? "done" : "now"}`}>
          <div className="mr-step-n" aria-hidden="true">{firmada ? "✓" : "1"}</div>
          <div className="mr-step-b">
            <p className="eyebrow">{t.paso} 1 · <span className={`mr-tag ${firmada ? "ok" : ""}`}>{firmada ? `${t.p1ok} ${firmada}` : empezada ? t.p1parte : t.p1pend}</span></p>
            <h2>{t.p1}</h2>
            <p>{t.p1d}</p>
            <button type="button" className={`btn ${firmada ? "btn-ghost" : "btn-primary"}`} onClick={abrirFicha}>{firmada ? t.ver : empezada ? t.seguir : t.llenar}</button>
          </div>
        </li>
        <li className={`mr-step ${firmada ? "now" : "locked"}`}>
          <div className="mr-step-n" aria-hidden="true">2</div>
          <div className="mr-step-b">
            <p className="eyebrow">{t.paso} 2</p>
            <h2>{t.p2}</h2>
            {!firmada ? <p>{t.p2lock}</p> : (
              <div className="mr-grid">
                <article className="mr-card"><h3>{t.horarios}</h3><ul className="mr-list"><li>{t.hIn}</li><li>{t.hOut}</li><li>{t.hServ}</li></ul></article>
                <article className="mr-card"><h3>{t.llegar}</h3><p>{t.llegarD}</p><a className="btn btn-ghost" href={MAPS_URL} target="_blank" rel="noopener noreferrer">{t.maps}</a></article>
                {r.comprobante && <article className="mr-card"><h3>{t.comprobante}</h3><p>{t.comprobanteD}</p><a className="btn btn-ghost" href={`/comprobante?c=${r.comprobante}`}>{t.verComp}</a></article>}
                <article className="mr-card"><h3>{t.normas}</h3><p>{t.normasD}</p><a className="btn btn-ghost" href={PATHS.normas[lang]}>{t.verNormas}</a></article>
              </div>
            )}
          </div>
        </li>
      </ol>

      <section className="mr-card mr-help-card">
        <div><h3>{t.ayuda}</h3><p>{t.ayudaD}</p></div>
        <div className="ctas"><a className="btn btn-primary" href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className="btn btn-ghost" href={`mailto:${EMAIL}`}>{t.correo}</a></div>
      </section>
      <p className="mr-out">{t.noEsTuya} <button type="button" className="mr-link" onClick={salir}>{t.salir}</button></p>
    </>
  );
}
