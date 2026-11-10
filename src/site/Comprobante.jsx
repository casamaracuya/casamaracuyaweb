import { useEffect, useState } from "react";
import "./site.css";
import { usePrefs, PageHeader, PageFooter, EMAIL, WA_URL } from "./shared.jsx";
import { PATHS, savedLang } from "./paths.js";
import { leerComprobante } from "../lib/api.js";

// Comprobante de reserva y pago. Se abre con el enlace privado de cada reserva confirmada
// (/comprobante?c=<código>) que llega por correo y por WhatsApp. Solo lectura.
// «Guardar en PDF» usa la impresión del navegador; los estilos de impresión dejan solo la hoja.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX = {
  es: { doc: "Comprobante · Casa Maracuyá", title: "Comprobante de reserva y pago", n: "N°", emitido: "Emitido", titular: "Titular", doc2: "C.I. / Pasaporte",
    llegada: "Llegada", salida: "Salida", desde: "desde las 3:00 PM", hasta: "hasta las 11:00 AM", noches: "Noches", personas: "Personas", plan: "Plan",
    concepto: "Concepto", total: "Total de la estadía", pagado: "Pagado", saldo: "Saldo pendiente", pagos: "Pagos recibidos", fecha: "Fecha", metodo: "Método", monto: "Monto",
    pdf: "Guardar en PDF", normas: "Normas de la casa", cargando: "Cargando tu comprobante…",
    noT: "Este comprobante no está disponible", no: "Puede que el enlace esté incompleto o que la reserva todavía no esté confirmada. Escríbenos y te lo enviamos de nuevo.",
    poli: "La tarifa no es reembolsable. Puedes cambiar la fecha avisando con al menos 15 días de anticipación a la llegada, sujeto a disponibilidad.",
    fiscal: "Este comprobante lo emite Casa Maracuyá y no sustituye una factura fiscal. Si necesitas factura, escríbenos.",
    plans: { esencial: "Experiencia Esencial", plena: "Experiencia Plena" }, locale: "es-VE" },
  en: { doc: "Receipt · Casa Maracuyá", title: "Booking and payment receipt", n: "No.", emitido: "Issued", titular: "Main guest", doc2: "ID / Passport",
    llegada: "Check-in", salida: "Check-out", desde: "from 3:00 PM", hasta: "by 11:00 AM", noches: "Nights", personas: "Guests", plan: "Plan",
    concepto: "Description", total: "Total for the stay", pagado: "Paid", saldo: "Balance due", pagos: "Payments received", fecha: "Date", metodo: "Method", monto: "Amount",
    pdf: "Save as PDF", normas: "House rules", cargando: "Loading your receipt…",
    noT: "This receipt isn't available", no: "The link may be incomplete or the booking may not be confirmed yet. Message us and we'll send it again.",
    poli: "Rates are non-refundable. Dates can be changed with at least 15 days' notice before arrival, subject to availability.",
    fiscal: "This receipt is issued by Casa Maracuyá and is not a tax invoice. If you need one, please contact us.",
    plans: { esencial: "Essential Experience", plena: "Full Experience" }, locale: "en-US" }
};

export default function Comprobante() {
  const token = typeof location !== "undefined" ? new URLSearchParams(location.search).get("c") || "" : "";
  const p = usePrefs(savedLang() || "es");
  const t = TX[p.lang] || TX.es;
  const [d, setD] = useState(null); const [status, setStatus] = useState("loading");
  useEffect(() => { document.title = t.doc; }, [t]);
  useEffect(() => {
    if (!UUID.test(token)) { setStatus("invalid"); return; }
    leerComprobante(token).then(r => {
      if (!r) { setStatus("invalid"); return; }
      setD(r); setStatus("ok");
      if (!savedLang() && r.idioma && r.idioma !== p.lang) p.setLang(r.idioma === "en" ? "en" : "es");
    }).catch(() => setStatus("invalid"));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = n => "$" + Number(n || 0).toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = s => new Date(s + "T00:00:00Z").toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const short = s => new Date(s + "T00:00:00Z").toLocaleDateString(t.locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const nights = d ? Math.round((Date.parse(d.salida) - Date.parse(d.llegada)) / 864e5) : 0;
  const saldo = d ? Math.max(0, Number(d.total) - Number(d.pagado)) : 0;

  return (
    <>
      <PageHeader {...p} />
      <main className="receipt-page linen">
        <div className="wrap">
          {status === "loading" && <p className="receipt-msg" role="status">{t.cargando}</p>}
          {status === "invalid" && <div className="legal-ask"><div><h2>{t.noT}</h2><p>{t.no}</p></div>
            <div className="ctas"><a className="btn btn-primary" href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className="btn btn-ghost" href={`mailto:${EMAIL}`}>{EMAIL}</a></div></div>}
          {status === "ok" && d && <>
            <div className="receipt-actions">
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>{t.pdf}</button>
              <a className="btn btn-ghost" href={PATHS.normas[p.lang]}>{t.normas}</a>
            </div>
            <article className="receipt">
              <header className="rc-head">
                <div><img src="/logo/logo-dorado.svg" alt="Casa Maracuyá · Relaxing Getaway" width="150" height="60" /><p className="rc-place">Adícora, Falcón, Venezuela</p></div>
                <div className="rc-no"><h1>{t.title}</h1><p>{t.n} <b>{d.codigo}</b></p><p>{t.emitido}: {short(d.emitido)}</p></div>
              </header>

              <section className="rc-who"><p className="eyebrow">{t.titular}</p><p className="rc-name">{d.nombre}</p>{d.documento && <p className="rc-sub">{t.doc2}: {d.documento}</p>}</section>

              <dl className="rc-stay">
                <div><dt>{t.llegada}</dt><dd>{date(d.llegada)}<small>{t.desde}</small></dd></div>
                <div><dt>{t.salida}</dt><dd>{date(d.salida)}<small>{t.hasta}</small></dd></div>
                <div><dt>{t.noches}</dt><dd>{nights}</dd></div>
                <div><dt>{t.personas}</dt><dd>{d.personas}</dd></div>
                <div><dt>{t.plan}</dt><dd>{t.plans[d.plan] || d.plan}</dd></div>
              </dl>

              <table className="rc-lines">
                <tbody>
                  {d.concepto && <tr><th scope="row">{t.concepto}</th><td>{d.concepto}</td></tr>}
                  <tr className="strong"><th scope="row">{t.total}</th><td>{money(d.total)}</td></tr>
                  <tr><th scope="row">{t.pagado}</th><td>{money(d.pagado)}</td></tr>
                  <tr className={`strong ${saldo > 0 ? "due" : ""}`}><th scope="row">{t.saldo}</th><td>{money(saldo)}</td></tr>
                </tbody>
              </table>

              {d.pagos?.length > 0 && <section className="rc-pays"><p className="eyebrow">{t.pagos}</p>
                <table><thead><tr><th>{t.fecha}</th><th>{t.metodo}</th><th>{t.monto}</th></tr></thead>
                  <tbody>{d.pagos.map((x, i) => <tr key={i}><td>{short(x.fecha)}</td><td>{x.metodo}</td><td>{money(x.monto)}</td></tr>)}</tbody></table></section>}

              <footer className="rc-foot">
                <p>{t.poli}</p><p>{t.fiscal}</p>
                <p className="rc-contact">{EMAIL} · casa-maracuya.com</p>
              </footer>
            </article>
          </>}
        </div>
      </main>
      <PageFooter t={p.t} lang={p.lang} />
    </>
  );
}
