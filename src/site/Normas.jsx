import { useEffect } from "react";
import "./site.css";
import { usePrefs, PageHeader, PageFooter, EMAIL, WA_URL } from "./shared.jsx";
import { PATHS } from "./paths.js";
import { NORMAS, PDF_URL } from "./normas-data.js";

// Normas de la casa. El texto vive en normas-data.js (lo comparte con el PDF).
// Las normas llevan negritas (<b>) escritas por nosotros, por eso se insertan como HTML.
const html = s => ({ __html: s });

export default function Normas({ lang = "es" }) {
  const p = usePrefs(lang, PATHS.normas);
  const d = NORMAS[p.lang] || NORMAS.es;
  useEffect(() => { document.title = d.doc; }, [d]);
  let n = 0;
  return (
    <>
      <PageHeader {...p} />
      <main className="legal-page">
        <section className="legal-hero linen">
          <div className="wrap">
            <p className="eyebrow">{d.eyebrow}</p>
            <h1>{d.title} <em>{d.titleEm}</em></h1>
            <p className="lede">{d.sub}</p>
            <a className="btn btn-ghost" href={PDF_URL[p.lang] || PDF_URL.es} download>{d.pdf}</a>
          </div>
          <img className="legal-seal" src="/logo/sello-circular.svg" alt="" aria-hidden="true" width="240" height="240" />
        </section>

        <div className="wrap legal-body">
          <aside className="legal-index" aria-label={d.index}>
            <p className="eyebrow">{d.index}</p>
            <ol className="roman">{d.parts.map(pt => <li key={pt.id}><a href={`#${pt.id}`} data-n={pt.n}>{pt.h}</a></li>)}</ol>
          </aside>

          <div className="legal-text">
            <blockquote className="rules-welcome">{d.welcome.map(w => <p key={w}>{w}</p>)}</blockquote>
            <div className="legal-short">
              <h2>{d.keyT}</h2>
              <dl className="rules-key">{d.key.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
            {d.parts.map(pt => (
              <section key={pt.id} id={pt.id} className="rules-part">
                <header className="rules-part-head">
                  <span className="rules-roman" aria-hidden="true">{pt.n}</span>
                  <div><h2>{pt.h}</h2>{pt.note && <p className="eyebrow">{pt.note}</p>}</div>
                </header>
                {pt.rules.map(([h, items]) => {
                  n += 1;
                  return (
                    <article key={h} className="legal-sec">
                      <span className="legal-n" aria-hidden="true">{String(n).padStart(2, "0")}</span>
                      <div>
                        <h3>{h}</h3>
                        {items.length > 1
                          ? <ul>{items.map((x, j) => <li key={j} dangerouslySetInnerHTML={html(x)} />)}</ul>
                          : <p dangerouslySetInnerHTML={html(items[0])} />}
                      </div>
                    </article>
                  );
                })}
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
