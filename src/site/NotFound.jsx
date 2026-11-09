import { useEffect } from "react";
import "./site.css";
import { usePrefs, PageHeader, PageFooter, WA_URL } from "./shared.jsx";
import { PATHS } from "./paths.js";

// Página para enlaces que no existen. Cloudflare la entrega con código 404 (dist/404.html)
// y además se marca «noindex» para que Google no la guarde.
const TXT = {
  es: { doc: "Página no encontrada · Casa Maracuyá", eyebrow: "Error 404", title: <>Esta página <em>se la llevó el viento.</em></>,
    p: "Puede que el enlace esté mal escrito o que la página ya no exista. La casa sigue donde siempre: frente al faro, esperándote.",
    home: "Volver al inicio", book: "Ver planes", wa: "Escríbenos por WhatsApp", alt: "La piscina de Casa Maracuyá con el faro de Adícora al fondo" },
  en: { doc: "Page not found · Casa Maracuyá", eyebrow: "Error 404", title: <>This page <em>was blown away by the wind.</em></>,
    p: "The link may be mistyped, or the page no longer exists. The house is still where it's always been: by the lighthouse, waiting for you.",
    home: "Back to home", book: "See stays", wa: "Message us on WhatsApp", alt: "Casa Maracuyá's pool with the Adícora lighthouse behind it" }
};

export default function NotFound({ lang = "es" }) {
  const p = usePrefs(lang);
  const d = TXT[p.lang] || TXT.es;
  useEffect(() => { document.title = d.doc; }, [d]);
  useEffect(() => {
    const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    return () => m.remove();
  }, []);
  return (
    <>
      <PageHeader {...p} />
      <main className="nf">
        <section className="nf-hero linen">
          <div className="nf-copy">
            <p className="eyebrow">{d.eyebrow}</p>
            <h1>{d.title}</h1>
            <svg className="nf-wind" viewBox="0 0 160 40" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round">
              <path pathLength="1" d="M4 22 C34 8 58 34 88 20 S136 6 156 18" strokeWidth="1.6" />
              <path pathLength="1" d="M30 34 C56 26 80 38 108 30 c12 -3 16 -12 8 -15 c-6 -2 -11 3 -7 7" strokeWidth="1.2" />
            </svg>
            <p className="sub">{d.p}</p>
            <div className="ctas"><a className="btn btn-primary" href={PATHS.home[p.lang]}>{d.home}</a><a className="btn btn-ghost" href={PATHS.home[p.lang] + "#planes"}>{d.book}</a></div>
            <p className="fine"><a href={WA_URL} target="_blank" rel="noopener noreferrer">{d.wa}</a></p>
          </div>
          <div className="nf-media"><img src="/fotos/faro-piscina.jpg" alt={d.alt} width="1200" height="900" /></div>
        </section>
      </main>
      <PageFooter t={p.t} lang={p.lang} />
    </>
  );
}
