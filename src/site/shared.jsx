// Piezas compartidas por las páginas secundarias (privacidad, 404): mismo encabezado,
// mismo pie y las mismas preferencias de idioma y modo día/noche que la página principal.
import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T } from "./i18n.js";
import { WHATSAPP, EMAIL, MAPS_URL } from "../lib/contacto.js";
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

// Barra de desplazamiento propia (solo con ratón). La del navegador se oculta porque
// siempre ocupa una franja a la derecha; esta flota encima de la página, aparece al bajar
// o al acercar el ratón al borde derecho, y se esconde sola. Estilo en site.css («.sb»).
function useScrollbar() {
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches) return;
    const root = document.documentElement;
    const bar = document.createElement("div");
    bar.className = "sb";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = '<button type="button" class="sb-up" tabindex="-1"></button><div class="sb-track"><div class="sb-thumb"></div></div><button type="button" class="sb-down" tabindex="-1"></button>';
    document.body.appendChild(bar);
    root.classList.add("sb-custom");
    const track = bar.querySelector(".sb-track"), thumb = bar.querySelector(".sb-thumb");
    let timer, drag = null, near = false;

    const layout = () => {
      const total = root.scrollHeight, view = innerHeight, th = track.clientHeight;
      bar.hidden = total <= view + 1;
      if (bar.hidden) return;
      const size = Math.max(40, (th * view) / total);
      thumb.style.height = size + "px";
      thumb.style.transform = `translateY(${((th - size) * scrollY) / (total - view)}px)`;
    };
    const hideLater = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!near && !drag && !bar.matches(":hover")) bar.classList.remove("on"); }, 1100);
    };
    const show = () => { bar.classList.add("on"); hideLater(); };
    const to = y => scrollTo({ top: y, behavior: "instant" });

    const onScroll = () => { layout(); show(); };
    const onMove = e => {
      const n = innerWidth - e.clientX < 28;
      if (n === near) return;
      near = n;
      if (n) { layout(); bar.classList.add("on"); clearTimeout(timer); } else hideLater();
    };
    const onLeave = () => { near = false; hideLater(); };
    thumb.addEventListener("pointerdown", e => {
      drag = { c0: e.clientY, y0: scrollY };
      thumb.setPointerCapture(e.pointerId);
      bar.classList.add("drag");
      e.preventDefault();
    });
    thumb.addEventListener("pointermove", e => {
      if (!drag) return;
      const ratio = (root.scrollHeight - innerHeight) / (track.clientHeight - thumb.offsetHeight);
      to(drag.y0 + (e.clientY - drag.c0) * ratio);
    });
    const endDrag = () => { if (!drag) return; drag = null; bar.classList.remove("drag"); hideLater(); };
    thumb.addEventListener("pointerup", endDrag);
    thumb.addEventListener("pointercancel", endDrag);
    track.addEventListener("pointerdown", e => {
      if (e.target !== track) return;
      const arriba = e.clientY < thumb.getBoundingClientRect().top;
      scrollBy({ top: (arriba ? -1 : 1) * innerHeight * 0.85, behavior: "smooth" });
    });
    bar.querySelector(".sb-up").addEventListener("click", () => scrollBy({ top: -160, behavior: "smooth" }));
    bar.querySelector(".sb-down").addEventListener("click", () => scrollBy({ top: 160, behavior: "smooth" }));
    bar.addEventListener("mouseleave", hideLater);

    const ro = new ResizeObserver(layout);
    ro.observe(document.body);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", layout);
    addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    layout();
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", layout);
      removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      root.classList.remove("sb-custom");
      bar.remove();
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

// Íconos finos del pie (trazo dorado, heredan el color del texto)
const Ico = ({ d, fill }) => (
  <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const IG = <Ico d={<><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none" /></>} />;
const WA = <Ico d={<><path d="M4.5 19.5l1.2-3.8A8 8 0 1 1 8.6 18.6z" /><path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.2-.2.3 0 .6.5.9 1.2 1.6 2.2 2.1.3.1.4.1.6-.1l.6-.7c.2-.2.3-.2.6-.1l1.5.7c.3.1.4.2.4.4 0 .6-.3 1.4-1 1.7-.7.3-1.7.3-3.3-.4-1.9-.9-3.2-2.6-3.6-3.3-.5-.8-.8-1.8-.4-2.8z" fill="currentColor" stroke="none" /></>} />;
const MAIL = <Ico d={<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4.5 7l7.5 6 7.5-6" /></>} />;
const PIN = <Ico d={<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>} />;
const Dot = () => <span className="dot" aria-hidden="true">·</span>;

export function PageFooter({ t, lang }) {
  const home = PATHS.home[lang];
  return (
    <footer>
      <div className="wrap">
        <div className="brandcol"><img className="flogo" src="/logo/logo-dorado.svg" alt="Maracuyá Relaxing Getaway" width="161" height="64" /><p className="motto">{t("foot.motto")}</p></div>
        <div className="foot-cta">
          <p className="kicker">{t("foot.cta.k")}</p>
          <p className="cta-t">{t("foot.cta.t")}</p>
          <a className="btn btn-primary" href={WA_URL} target="_blank" rel="noopener noreferrer">{WA}{t("foot.cta.btn")}</a>
          <p className="note">{t("foot.cta.note")}</p>
        </div>
        <div className="foot-nav"><h4>{t("foot.explore")}</h4><ul><li><a href={home + "#casa"}>{t("nav.casa")}</a></li><li><a href={home + "#planes"}>{t("nav.planes")}</a></li><li><a href={home + "#mesa"}>{t("nav.mesa")}</a></li><li><a href={home + "#adicora"}>{t("nav.adicora")}</a></li><li><a href={home + "#reservar"}>{t("cta.reservar")}</a></li></ul></div>
        <div className="foot-contact"><h4>{t("foot.contact")}</h4><ul>
          <li><a href="https://www.instagram.com/lacasamaracuya/" target="_blank" rel="noopener noreferrer">{IG}@lacasamaracuya</a></li>
          <li><a href={WA_URL} target="_blank" rel="noopener noreferrer">{WA}WhatsApp</a></li>
          <li><a href={`mailto:${EMAIL}`}>{MAIL}{EMAIL}</a></li>
          <li><a href={MAPS_URL} target="_blank" rel="noopener noreferrer">{PIN}<span>{t("where.v1")}<span className="go">{t("foot.maps")} →</span></span></a></li>
        </ul></div>
        <div className="legal"><span>© {new Date().getFullYear()} Casa Maracuyá <Dot /> Relaxing Getaway</span><span>{t("foot.made")} <Dot /> <a href={PATHS.normas[lang]}>{t("foot.rules")}</a> <Dot /> <a href={PATHS.privacy[lang]}>{t("foot.privacy")}</a></span></div>
      </div>
    </footer>
  );
}
