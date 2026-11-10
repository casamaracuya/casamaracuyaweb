import { useEffect } from "react";
import "./site.css";
import { usePrefs, PageHeader, PageFooter, EMAIL, WA_URL } from "./shared.jsx";
import { PATHS } from "./paths.js";

// Política de privacidad. Es un texto base: la dueña debe revisarlo (idealmente con un abogado)
// antes de darlo por definitivo. Al cambiar algo, actualiza UPDATED.
const UPDATED = { es: "9 de noviembre de 2026", en: "November 9, 2026" };
const mail = <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

const TXT = {
  es: {
    doc: "Política de privacidad · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · Privacidad",
    title: <>Tus datos, <em>en buenas manos.</em></>,
    lede: "Cuidamos tu información como cuidamos la casa: con poco y bien. Aquí te contamos qué guardamos cuando nos escribes, para qué lo usamos y cómo pedirnos que lo cambiemos o lo borremos.",
    updated: "Última actualización",
    shortT: "En corto",
    short: ["Pedimos solo lo necesario para organizar tu estadía.", "No vendemos tus datos ni los usamos para publicidad.", "Puedes pedirnos verlos, corregirlos o borrarlos cuando quieras."],
    index: "En esta página",
    sections: [
      ["quienes", "Quiénes somos", [
        <>Casa Maracuyá es una casa vacacional en Adícora, estado Falcón, Venezuela, al lado del faro. Somos responsables de los datos que nos das en esta página, por WhatsApp o durante tu estadía.</>,
        <>Para cualquier tema de privacidad, escríbenos a {mail}.</>]],
      ["datos", "Qué datos guardamos", [
        { list: [
          <><b>Cuando pides una estadía:</b> tu nombre, tu WhatsApp, el plan, las fechas, cuántas personas vienen, si traes mascota y los comentarios que escribas.</>,
          <><b>En la ficha de registro de tu estadía:</b> la cédula o el pasaporte del titular, el nombre, el documento y la edad (si es menor) de cada persona que se queda en la casa, la hora de llegada y las placas y modelos de los vehículos. La casa los necesita para saber quién pernocta y por seguridad.</>,
          <><b>Durante tu estadía, si nos lo cuentas:</b> alergias, gustos de comida, cumpleaños u otras fechas especiales y los nombres de quienes te acompañan.</>,
          <><b>Sobre los pagos:</b> el monto, la fecha y el medio de pago. Nunca guardamos números de tarjeta ni claves bancarias.</>] }]],
      ["uso", "Para qué los usamos", [
        { list: ["Responder tu solicitud y confirmarte disponibilidad y tarifa.", "Preparar la casa y el menú a tu medida, sobre todo si hay alergias.", "Recibirte como te gusta la próxima vez que vengas."] },
        "No te enviamos publicidad sin tu permiso, y no vendemos ni cedemos tus datos a nadie."]],
      ["acceso", "Quién puede verlos", [
        "Solo el equipo de la casa. Cada persona entra con su propio usuario y ve únicamente lo que necesita para su trabajo: por ejemplo, la cocina ve tus alergias y gustos, pero no tus pagos.",
        "Para funcionar usamos unos pocos servicios que guardan o transportan la información por nosotros: Supabase (la base de datos, con acceso protegido), Cloudflare (aloja esta página), Google (nuestro correo) y WhatsApp (nuestras conversaciones, que también se rigen por la política de privacidad de WhatsApp)."]],
      ["tiempo", "Cuánto tiempo los guardamos", [
        "Mientras nos sirvan para atenderte como huésped. Si nos pides borrarlos, lo hacemos, salvo lo que debamos conservar por obligaciones legales o contables, como el registro de un pago."]],
      ["derechos", "Tus derechos", [
        "Puedes pedirnos en cualquier momento que te mostremos los datos que tenemos sobre ti, que los corrijamos, que los borremos o que dejemos de usarlos para algo en particular.",
        <>Escríbenos a {mail} o por WhatsApp y te respondemos lo antes posible.</>]],
      ["cookies", "Cookies y navegación", [
        "Esta página no usa cookies de publicidad ni herramientas de seguimiento como Google Analytics o píxeles de redes sociales.",
        "Tu navegador solo recuerda dos preferencias: el idioma y el modo día o noche. Cloudflare, que aloja la página, procesa datos técnicos como tu dirección IP para entregarla de forma rápida y segura."]],
      ["cambios", "Cambios en esta política", [
        "Si cambiamos algo importante, lo publicaremos aquí y actualizaremos la fecha de arriba."]]
    ],
    askT: "¿Dudas sobre tus datos?",
    ask: "Escríbenos y te respondemos. Sin formularios ni vueltas.",
    write: "Escribir un correo"
  },
  en: {
    doc: "Privacy policy · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · Privacy",
    title: <>Your data, <em>in good hands.</em></>,
    lede: "We look after your information the way we look after the house: keep it simple, and keep it well. Here's what we keep when you write to us, what we use it for and how to ask us to change or delete it.",
    updated: "Last updated",
    shortT: "In short",
    short: ["We only ask for what we need to organize your stay.", "We don't sell your data or use it for advertising.", "You can ask us to see, correct or delete it at any time."],
    index: "On this page",
    sections: [
      ["quienes", "Who we are", [
        <>Casa Maracuyá is a holiday home in Adícora, Falcón, Venezuela, right next to the lighthouse. We are responsible for the data you give us on this website, on WhatsApp or during your stay.</>,
        <>For anything about privacy, write to {mail}.</>]],
      ["datos", "What we keep", [
        { list: [
          <><b>When you request a stay:</b> your name, your WhatsApp number, the stay, your dates, how many guests are coming, whether you bring a pet and any comments you write.</>,
          <><b>In the registration form for your stay:</b> the main guest's ID or passport, the name, document and age (if under 18) of each person staying at the house, your arrival time and the plates and models of your vehicles. The house needs them to know who is staying overnight and for safety.</>,
          <><b>During your stay, if you tell us:</b> allergies, food preferences, birthdays or other special dates and the names of those travelling with you.</>,
          <><b>About payments:</b> the amount, the date and the payment method. We never keep card numbers or bank passwords.</>] }]],
      ["uso", "What we use it for", [
        { list: ["Answering your request and confirming availability and rates.", "Preparing the house and the menu for you, especially if there are allergies.", "Welcoming you the way you like the next time you come."] },
        "We don't send you advertising without your permission, and we never sell or hand over your data to anyone."]],
      ["acceso", "Who can see it", [
        "Only the house team. Each person signs in with their own account and sees only what they need for their work: for example, the kitchen sees your allergies and preferences, but not your payments.",
        "To run, we use a few services that store or carry the information for us: Supabase (the database, with protected access), Cloudflare (hosts this website), Google (our email) and WhatsApp (our conversations, which are also covered by WhatsApp's privacy policy)."]],
      ["tiempo", "How long we keep it", [
        "For as long as it helps us look after you as a guest. If you ask us to delete it, we will, except for what we must keep for legal or accounting reasons, such as the record of a payment."]],
      ["derechos", "Your rights", [
        "At any time you can ask us to show you the data we have about you, correct it, delete it or stop using it for something in particular.",
        <>Write to {mail} or on WhatsApp and we'll reply as soon as we can.</>]],
      ["cookies", "Cookies and browsing", [
        "This website doesn't use advertising cookies or tracking tools such as Google Analytics or social media pixels.",
        "Your browser only remembers two preferences: the language and the day or night mode. Cloudflare, which hosts the website, processes technical data such as your IP address to deliver it quickly and securely."]],
      ["cambios", "Changes to this policy", [
        "If we change anything important, we'll publish it here and update the date above."]]
    ],
    askT: "Questions about your data?",
    ask: "Write to us and we'll answer. No forms, no runaround.",
    write: "Send an email"
  }
};

export default function Privacy({ lang = "es" }) {
  const p = usePrefs(lang, PATHS.privacy);
  const d = TXT[p.lang] || TXT.es;
  useEffect(() => { document.title = d.doc; }, [d]);
  return (
    <>
      <PageHeader {...p} />
      <main className="legal-page">
        <section className="legal-hero linen">
          <div className="wrap">
            <p className="eyebrow">{d.eyebrow}</p>
            <h1>{d.title}</h1>
            <p className="lede">{d.lede}</p>
            <p className="fine">{d.updated}: {UPDATED[p.lang] || UPDATED.es}</p>
          </div>
          <img className="legal-seal" src="/logo/sello-circular.svg" alt="" aria-hidden="true" width="240" height="240" />
        </section>

        <div className="wrap legal-body">
          <aside className="legal-index" aria-label={d.index}>
            <p className="eyebrow">{d.index}</p>
            <ol>{d.sections.map(([id, h]) => <li key={id}><a href={`#${id}`}>{h}</a></li>)}</ol>
          </aside>

          <div className="legal-text">
            <div className="legal-short">
              <h2>{d.shortT}</h2>
              <ul>{d.short.map(s => <li key={s}>{s}</li>)}</ul>
            </div>
            {d.sections.map(([id, h, blocks], i) => (
              <section key={id} id={id} className="legal-sec">
                <span className="legal-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{h}</h2>
                  {blocks.map((b, k) => b && b.list ? <ul key={k}>{b.list.map((x, j) => <li key={j}>{x}</li>)}</ul> : <p key={k}>{b}</p>)}
                </div>
              </section>
            ))}
            <div className="legal-ask">
              <div><h2>{d.askT}</h2><p>{d.ask}</p></div>
              <div className="ctas"><a className="btn btn-primary" href={`mailto:${EMAIL}`}>{d.write}</a><a className="btn btn-ghost" href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
            </div>
          </div>
        </div>
      </main>
      <PageFooter t={p.t} lang={p.lang} />
    </>
  );
}
