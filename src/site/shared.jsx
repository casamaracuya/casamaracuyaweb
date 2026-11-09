// Piezas compartidas por las páginas secundarias (privacidad, 404): mismo encabezado,
// mismo pie y las mismas preferencias de idioma y modo día/noche que la página principal.
import { useEffect, useState } from "react";
import { T } from "./i18n.js";
import { WHATSAPP, EMAIL } from "../lib/contacto.js";

const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
export { EMAIL };
export const WA_URL = `https://wa.me/${WHATSAPP}`;

export function usePrefs() {
  const [lang, setLangState] = useState(() => store.get("maracuya-idioma") || ((navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es"));
  const [mode, setMode] = useState(() => store.get("maracuya-mode") === "dark" ? "dark" : "light");
  const setLang = l => { setLangState(l); store.set("maracuya-idioma", l); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { if (mode === "dark") document.documentElement.dataset.mode = "dark"; else delete document.documentElement.dataset.mode; store.set("maracuya-mode", mode); }, [mode]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const t = k => T[lang][k] ?? k;
  return { lang, setLang, mode, setMode, t };
}

export function PageHeader({ lang, setLang, mode, setMode, t }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href="/" aria-label={lang === "es" ? "Casa Maracuyá, inicio" : "Casa Maracuyá, home"}><img src="/logo/logo-dorado.svg" alt="Maracuyá Relaxing Getaway" width="131" height="52" /></a>
        <div className="lang" role="group" aria-label="Idioma / Language" style={{ marginLeft: "auto" }}>
          {["es", "en"].map(l => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
        </div>
        <div className="mode" role="group" aria-label={lang === "es" ? "Apariencia" : "Appearance"}>
          <button type="button" aria-pressed={mode === "light"} aria-label={lang === "es" ? "Versión de día" : "Day version"} onClick={() => setMode("light")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg></button>
          <button type="button" aria-pressed={mode === "dark"} aria-label={lang === "es" ? "Versión de noche" : "Night version"} onClick={() => setMode("dark")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" /></svg></button>
        </div>
        <a className="btn btn-primary page-cta" href="/#reservar">{t("cta.reservar")}</a>
      </div>
    </header>
  );
}

export function PageFooter({ t }) {
  return (
    <footer>
      <div className="wrap">
        <div className="brandcol"><img className="flogo" src="/logo/logo-claro.svg" alt="Maracuyá Relaxing Getaway" width="146" height="58" /><p className="motto">{t("foot.motto")}</p></div>
        <div><h4>{t("foot.explore")}</h4><ul><li><a href="/#casa">{t("nav.casa")}</a></li><li><a href="/#planes">{t("nav.planes")}</a></li><li><a href="/#mesa">{t("nav.mesa")}</a></li><li><a href="/#adicora">{t("nav.adicora")}</a></li><li><a href="/#reservar">{t("cta.reservar")}</a></li></ul></div>
        <div><h4>{t("foot.contact")}</h4><ul><li><a href="https://www.instagram.com/lacasamaracuya/" target="_blank" rel="noopener noreferrer">Instagram</a></li><li><a href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a></li><li><a href={`mailto:${EMAIL}`}>{EMAIL}</a></li><li>{t("where.v1")}</li></ul></div>
        <div className="legal"><span>© {new Date().getFullYear()} Casa Maracuyá · Relaxing Getaway</span><span>{t("foot.made")} · <a href="/privacidad">{t("foot.privacy")}</a></span></div>
      </div>
    </footer>
  );
}
