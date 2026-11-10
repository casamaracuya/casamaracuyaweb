// Piezas compartidas por las páginas secundarias (privacidad, 404): mismo encabezado,
// mismo pie y las mismas preferencias de idioma y modo día/noche que la página principal.
import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T } from "./i18n.js";
import { WHATSAPP, EMAIL } from "../lib/contacto.js";
import { saveLang, PATHS } from "./paths.js";

export { EMAIL };
export const WA_URL = `https://wa.me/${WHATSAPP}`;

// Modo día/noche. El HTML se escribe en modo día; el script de index.html ya puso el modo
// guardado en <html> antes de pintar, y aquí solo se lee para que los botones coincidan.
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useMode() {
  const [mode, setMode] = useState(null);
  useIsoLayout(() => { setMode(document.documentElement.dataset.mode === "dark" ? "dark" : "light"); }, []);
  useEffect(() => {
    if (!mode) return;
    if (mode === "dark") document.documentElement.dataset.mode = "dark"; else delete document.documentElement.dataset.mode;
    try { localStorage.setItem("maracuya-mode", mode); } catch { /* sin almacenamiento */ }
  }, [mode]);
  useScrollbar();
  return [mode || "light", setMode];
}

// Barra de desplazamiento: se esconde sola y aparece al bajar por la página o al acercar
// el ratón al borde derecho. El estilo está en site.css («Barra de desplazamiento»).
function useScrollbar() {
  useEffect(() => {
    const root = document.documentElement;
    let timer;
    const hideLater = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!root.classList.contains("sb-cerca")) root.classList.remove("sb-on"); }, 1100);
    };
    const show = () => { root.classList.add("sb-on"); hideLater(); };
    const onMove = e => {
      const cerca = innerWidth - e.clientX < 32;
      if (cerca === root.classList.contains("sb-cerca")) return;
      root.classList.toggle("sb-cerca", cerca);
      if (cerca) root.classList.add("sb-on"); else hideLater();
    };
    const onLeave = () => { root.classList.remove("sb-cerca"); hideLater(); };
    addEventListener("scroll", show, { passive: true });
    addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      clearTimeout(timer);
      removeEventListener("scroll", show);
      removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      root.classList.remove("sb-on", "sb-cerca");
    };
  }, []);
}

// alt: la dirección de esta misma página en cada idioma. Sin alt (404), el idioma cambia en el sitio.
export function usePrefs(initialLang = "es", alt) {
  const navigate = useNavigate();
  const [lang, setLangState] = useState(initialLang);
  useEffect(() => { setLangState(initialLang); }, [initialLang]);
  const [mode, setMode] = useMode();
  const setLang = l => { saveLang(l); if (alt) navigate(alt[l]); else setLangState(l); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const t = k => T[lang][k] ?? k;
  return { lang, setLang, mode, setMode, t };
}

export function PageHeader({ lang, setLang, mode, setMode, t }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href={PATHS.home[lang]} aria-label={lang === "es" ? "Casa Maracuyá, inicio" : "Casa Maracuyá, home"}><img src="/logo/logo-dorado.svg" alt="Maracuyá Relaxing Getaway" width="131" height="52" /></a>
        <div className="lang" role="group" aria-label="Idioma / Language" style={{ marginLeft: "auto" }}>
          {["es", "en"].map(l => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
        </div>
        <div className="mode" role="group" aria-label={lang === "es" ? "Apariencia" : "Appearance"}>
          <button type="button" aria-pressed={mode === "light"} aria-label={lang === "es" ? "Versión de día" : "Day version"} onClick={() => setMode("light")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg></button>
          <button type="button" aria-pressed={mode === "dark"} aria-label={lang === "es" ? "Versión de noche" : "Night version"} onClick={() => setMode("dark")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" /></svg></button>
        </div>
        <a className="btn btn-primary page-cta" href={PATHS.home[lang] + "#reservar"}>{t("cta.reservar")}</a>
      </div>
    </header>
  );
}

export function PageFooter({ t, lang }) {
  return (
    <footer>
      <div className="wrap">
        <div className="brandcol"><img className="flogo" src="/logo/logo-claro.svg" alt="Maracuyá Relaxing Getaway" width="146" height="58" /><p className="motto">{t("foot.motto")}</p></div>
        <div><h4>{t("foot.explore")}</h4><ul><li><a href={PATHS.home[lang] + "#casa"}>{t("nav.casa")}</a></li><li><a href={PATHS.home[lang] + "#planes"}>{t("nav.planes")}</a></li><li><a href={PATHS.home[lang] + "#mesa"}>{t("nav.mesa")}</a></li><li><a href={PATHS.home[lang] + "#adicora"}>{t("nav.adicora")}</a></li><li><a href={PATHS.home[lang] + "#reservar"}>{t("cta.reservar")}</a></li></ul></div>
        <div><h4>{t("foot.contact")}</h4><ul><li><a href="https://www.instagram.com/lacasamaracuya/" target="_blank" rel="noopener noreferrer">Instagram</a></li><li><a href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp</a></li><li><a href={`mailto:${EMAIL}`}>{EMAIL}</a></li><li>{t("where.v1")}</li></ul></div>
        <div className="legal"><span>© {new Date().getFullYear()} Casa Maracuyá · Relaxing Getaway</span><span>{t("foot.made")} · <a href={PATHS.normas[lang]}>{t("foot.rules")}</a> · <a href={PATHS.privacy[lang]}>{t("foot.privacy")}</a></span></div>
      </div>
    </footer>
  );
}
