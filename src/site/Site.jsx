import { useEffect, useRef, useState } from "react";
import "./site.css";
import { T } from "./i18n.js";
import { crearSolicitud, nochesOcupadas } from "../lib/api.js";
import { WHATSAPP, supabase } from "../lib/supabase.js";
import { MAPS_URL } from "../lib/contacto.js";
import { useNavigate } from "react-router-dom";
import { PATHS, saveLang } from "./paths.js";
import { season, MIN_ALTA } from "../admin/util.js";
import { useMode, PageFooter } from "./shared.jsx";

const todayISO = () => { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); };
const parseISO = s => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const nightsBetween = (a, b) => { const A = parseISO(a), B = parseISO(b); return A && B ? Math.round((B - A) / 864e5) : null; };

export default function Site({ lang = "es" }) {
  // El idioma viene de la dirección (/ o /en/). El botón cambia de dirección y recuerda la elección.
  const navigate = useNavigate();
  const setLang = l => { saveLang(l); if (l !== lang) navigate(PATHS.home[l] + location.hash); };
  const [mode, setMode] = useMode();
  const [today, setToday] = useState("");
  // Anti-spam: hora en que se mostró el formulario y un campo trampa que solo llenan los robots.
  const shownAt = useRef(0); const trap = useRef(null);
  useEffect(() => { setToday(todayISO()); shownAt.current = Date.now(); }, []);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(0); // pregunta abierta (0 = ninguna)
  const [f, setF] = useState({ plan: "esencial", guests: "4", babies: "0", how: "", celebra: "", pet: "no", checkin: "", checkout: "", name: "", phone: "", notes: "" });
  const [error, setError] = useState(""); const [result, setResult] = useState(null); const [taken, setTaken] = useState(false); const [sending, setSending] = useState(false); const [copied, setCopied] = useState(false);
  const d = T[lang]; const t = k => d[k] ?? k; const html = k => ({ dangerouslySetInnerHTML: { __html: d[k] } });
  const root = useRef();

  useEffect(() => { document.documentElement.lang = lang; document.title = d["doc.title"]; }, [lang]);

  // Videos y apariciones al bajar
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const $$ = s => [...root.current.querySelectorAll(s)];
    const offs = [];
    const vids = $$("video:not([data-once])");
    if (reduce) vids.forEach(v => { v.removeAttribute("autoplay"); v.pause(); });
    else if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { en.isIntersecting ? en.target.play().catch(() => {}) : en.target.pause(); }), { threshold: .15 });
      vids.forEach(v => io.observe(v)); offs.push(() => io.disconnect());
      const pet = root.current.querySelector("#petVideo"); let away = true;
      if (pet) { const po = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && away) { away = false; pet.currentTime = 0; pet.play().catch(() => {}); } else if (!en.isIntersecting) { away = true; pet.pause(); } }), { threshold: .45 }); po.observe(pet); offs.push(() => po.disconnect()); }
      const sel = [".head-row",".barefoot .text",".barefoot .big",".barefoot .details figure",".fullbleed .wrap",".strip figure",".room .main",".room .side > *",".welcome > *",".plan",".pet-media",".pet-copy",".table-grid > *",".quote",".chapter .media",".chapter .copy",".inc",".seasons",".compare",".how",".dia-media",".dia-list li",".faq .wrap > *",".where .map",".where .wrap > div:last-child",".book .wrap > *"];
      const zoom = new Set($$(".barefoot .big, .room .main, .chapter .media, .table-grid > div"));
      const els = new Set(); sel.forEach(q => $$(q).forEach(e => els.add(e)));
      const ro = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); ro.unobserve(en.target); } }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
      els.forEach(el => { const sibs = [...el.parentElement.children].filter(c => els.has(c)); el.style.setProperty("--rd", (Math.min(sibs.indexOf(el), 5) * .1) + "s"); el.classList.add("rv"); if (zoom.has(el)) el.classList.add("rv-zoom"); ro.observe(el); });
      offs.push(() => ro.disconnect());
    }
    return () => offs.forEach(o => o());
  }, []);
  useEffect(() => { root.current.querySelectorAll(".fullbleed .rv").forEach(e => e.classList.add("in")); }, [mode]);

  // Avisa si las fechas ya están tomadas (sin mostrar de quién)
  useEffect(() => {
    if (!f.checkin || !f.checkout || f.checkout <= f.checkin) { setTaken(false); return; }
    let live = true; nochesOcupadas(f.checkin, f.checkout).then(r => live && setTaken(r.length > 0)); return () => { live = false; };
  }, [f.checkin, f.checkout]);

  // Menú del celular: se cierra al tocar fuera, con Escape o al bajar por la página.
  useEffect(() => {
    if (!menu) return;
    const y0 = window.scrollY;
    const onKey = e => { if (e.key === "Escape") setMenu(false); };
    const onScroll = () => { if (Math.abs(window.scrollY - y0) > 40) setMenu(false); };
    addEventListener("keydown", onKey); addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("keydown", onKey); removeEventListener("scroll", onScroll); };
  }, [menu]);

  const set = (k, v) => { setF(x => { const n = { ...x, [k]: v }; if (k === "checkin" && n.checkout && n.checkout <= v) n.checkout = "";
    // Cupo: hasta 12 personas que cuentan; los 2 primeros menores de 3 años no cuentan.
    const ad = Number(n.guests), bb = Number(n.babies);
    if (k === "guests" && ad + Math.max(bb - 2, 0) > 12) n.babies = String(2 + 12 - ad);
    if (k === "babies" && ad + Math.max(bb - 2, 0) > 12) n.guests = String(12 - (bb - 2));
    return n; }); setError(""); };
  const pick = plan => { setError(""); setF(x => ({ ...x, plan })); };
  const n = Number(f.guests); const nights = nightsBetween(f.checkin, f.checkout);
  const planName = t(f.plan === "plena" ? "p2.title" : "p1.title");
  // Tarifa: la de la casa cubre hasta 6 personas; desde la 7.ª, cada una es adicional.
  // Los 2 primeros menores de 3 años no pagan; del tercero en adelante cuentan como una persona más.
  const babies = Number(f.babies); const freeB = Math.min(babies, 2); const payB = babies - freeB;
  const payN = n + payB; const extra = Math.max(payN - 6, 0);
  const rateLabel = extra ? `${t("rate.base")} ${extra === 1 ? t("rate.extra1") : t("rate.extraN").replace("{n}", extra)}` : t("rate.base");
  const fmtDate = s => { const x = parseISO(s); return x ? x.toLocaleDateString(lang === "es" ? "es-VE" : "en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : ""; };

  // Mensaje de WhatsApp por bloques, para que Dirección cotice de un vistazo (negritas con *…*).
  const nightsBySeason = () => { const c = { alta: 0, media: 0, baja: 0 }; const d = parseISO(f.checkin);
    for (let i = 0; d && i < nights; i++) { const x = new Date(d.getTime() + i * 864e5); c[season(x.toISOString().slice(0, 10))]++; } return c; };
  const buildMessage = code => {
    const LINE = "━━━━━━━━━━━━━━";
    const ns = nightsBySeason(); const nn = k => `${ns[k]} ${t("m2." + k)}`;
    const mix = ["alta", "media", "baja"].filter(k => ns[k]).map(nn).join(" · ");
    const L = [t("m2.hello"), t("m2.ask")];
    if (code) L.push(`${t("m2.ref")} *${code}*`);
    L.push("", LINE, `📅 *${t("m2.dates")}*`, `${t("msg.in")}: ${fmtDate(f.checkin)}`, `${t("msg.out")}: ${fmtDate(f.checkout)}`,
      `*${nights} ${nights === 1 ? t("m2.night") : t("m2.nights")}*${mix ? ` (${mix})` : ""}`);
    if (ns.alta && nights < MIN_ALTA) L.push(`⚠️ ${t("m2.min").replace("{n}", MIN_ALTA)}`);
    L.push("", LINE, `👥 *${t("m2.group")}*`, `${t("msg.adults")}: *${n}*`);
    if (babies) L.push(`${t("msg.babies")}: *${babies}* (${payB ? t(payB === 1 ? "msg.babiespay1" : "msg.babiespay").replace("{f}", freeB).replace("{p}", payB) : t("msg.babiesfree")})`);
    L.push(`➡️ *${t("msg.rate")}: ${payN}*`, rateLabel);
    L.push("", LINE, `🌿 *${t("m2.plan")}*`, `${planName} (${t(f.plan === "plena" ? "m2.p2" : "m2.p1")})`, `🐾 ${t("msg.pet")}: ${f.pet === "si" ? t("f.yes") : t("f.no")}`);
    if (f.celebra) L.push(`🎉 ${t("m2.celebra")}: *${t("cel." + f.celebra)}*`);
    if (f.notes.trim()) L.push("", LINE, `💬 *${t("m2.notes")}*`, f.notes.trim());
    L.push("", LINE, `👤 *${t("m2.contact")}*`, f.name.trim(), f.phone.trim());
    if (f.how) L.push(`${t("m2.how")}: ${t("how." + f.how)}`);
    L.push("", t("m2.bye"));
    return L.join("\n");
  };
  const submit = async e => {
    e.preventDefault();
    if (!f.checkin || !f.checkout) return setError(t("err.dates"));
    if (f.checkin < todayISO()) return setError(t("err.past"));
    if (nights <= 0) return setError(t("err.order"));
    if (!f.name.trim()) return setError(t("err.name"));
    if (f.phone.replace(/\D/g, "").length < 7) return setError(t("err.phone"));
    if (payN > 12) return setError(t("err.max"));
    setSending(true);
    let code = null, saved = false;
    // Un robot llena el campo trampa o envía en menos de 3 segundos: no se guarda nada,
    // pero se le muestra lo mismo que a una persona para no darle pistas.
    const bot = !!trap.current?.value || Date.now() - shownAt.current < 3000;
    if (!bot) try { code = await crearSolicitud({ name: f.name.trim(), phone: f.phone, plan: f.plan, people: payN, pet: f.pet === "si", in: f.checkin, out: f.checkout, notes: [`${n} adultos y niños desde 3 años` + (babies ? `, ${babies} menores de 3 años (${payB ? `${payB} ${payB === 1 ? "paga" : "pagan"}` : "no pagan"})` : ""),
              f.celebra && `Celebran: ${T.es["cel." + f.celebra]}`, f.how && `Nos conoció por: ${T.es["how." + f.how]}`, f.notes.trim()].filter(Boolean).join(". "), channel: new URLSearchParams(location.search).get("utm_source") || "Web", lang }); saved = !!code; } catch { /* sigue por WhatsApp */ }
    setSending(false);
    const text = buildMessage(code);
    setResult({ text, saved: saved || bot, failed: !!supabase && !saved && !bot });
  };
  const waHref = result ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(result.text)}` : "#";
  const copyMsg = async () => { try { await navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ } };

  // Mensaje de WhatsApp listo, con el plan y el tamaño del grupo que eligió en la tarjeta
  const waPlan = id => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t("plans.wa").replace("{plan}", t(id === "plena" ? "p2.title" : "p1.title")))}`;
  const Plan = ({ id, img, alt, n: k }) => (
    <article className="plan" data-plan={id}>
      <img src={img} alt={alt} loading="lazy" />
      <div className="body">
        <h3>{t(`${k}.title`)}</h3>
        <p className="includes">{t(`${k}.sub`)}</p>
        <p className="ideal">{t(`${k}.ideal`)}</p>
        <ul>{[1, 2, 3, 4].map(i => <li key={i}>{t(`${k}.l${i}`)}</li>)}</ul>
        <p className="out">{t(`${k}.out`)}</p>
        <div className="cap">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2" /><circle cx="17" cy="9" r="2.5" /><path d="M16.2 13.9c2.4.1 4.2 1.6 4.8 4.3" /></svg>
          <p><b>{t("plans.cap1")}</b><span>{t("plans.cap2")}</span></p>
        </div>
        <div className="price"><a className="btn btn-primary" href="#reservar" onClick={() => pick(id)}>{t("plans.book")}</a><a className="btn btn-ghost" href={waPlan(id)} target="_blank" rel="noopener noreferrer">{t("plans.ask")}</a></div>
      </div>
    </article>
  );

  return (
    <div ref={root}>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href="#inicio" aria-label="Casa Maracuyá, inicio"><img src="/logo/logo-dorado.svg" alt="Maracuyá Relaxing Getaway" width="131" height="52" /></a>
          <nav className={`nav ${menu ? "open" : ""}`} id="nav" aria-label="Principal" onClick={() => setMenu(false)}>
            <a href="#casa">{t("nav.casa")}</a><a href="#planes">{t("nav.planes")}</a><a href="#mesa">{t("nav.mesa")}</a><a href="#adicora">{t("nav.adicora")}</a><a href="#ubicacion">{t("nav.ubicacion")}</a>
          </nav>
          <div className="lang" role="group" aria-label="Idioma / Language">
            {["es","en"].map(l => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <div className="mode" role="group" aria-label="Apariencia">
            <button type="button" aria-pressed={mode === "light"} aria-label="Versión de día" title="Día" onClick={() => setMode("light")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg></button>
            <button type="button" aria-pressed={mode === "dark"} aria-label="Versión de noche" title="Noche" onClick={() => setMode("dark")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" /></svg></button>
          </div>
          <a className="btn btn-primary header-cta" href="#reservar">{t("cta.reservar")}</a>
          <button className="menu-btn" type="button" aria-expanded={menu} aria-controls="nav" onClick={() => setMenu(m => !m)}><span /><span /><span className="sr-only">{t("nav.menu")}</span></button>
        </div>
      </header>
      {menu && <div className="nav-backdrop" aria-hidden="true" onClick={() => setMenu(false)} />}

      <main>
        <section className="hero" id="inicio">
          <div className="copy">
            <p className="eyebrow">{t("hero.eyebrow")}</p>
            <h1 {...html("hero.title")} />
            <p className="sub">{t("hero.sub")}</p>
            <div className="ctas"><a className="btn btn-primary" href="#planes">{t("cta.vive")}</a><a className="btn btn-ghost" href="#casa">{t("cta.casa")}</a></div>
            <div className="facts"><span {...html("hero.f1")} /><span {...html("hero.f2")} /><span {...html("hero.f3")} /><span {...html("hero.f4")} /></div>
          </div>
          <div className="hero-media"><video autoPlay muted loop playsInline preload="metadata" poster="/videos/video-recorrido-portada.webp" aria-label="Recorrido por Casa Maracuyá"><source src="/videos/video-recorrido.mp4" type="video/mp4" /></video></div>
        </section>

        <section className="barefoot" aria-labelledby="t-barefoot">
          <div className="wrap">
            <div className="big"><img src="/fotos/pergola-cana.webp" alt="Pasillo bajo la pérgola de caña de Casa Maracuyá" loading="lazy" width="1200" height="1600" /></div>
            <div className="text">
              <p className="eyebrow">{t("bf.eyebrow")}</p><h2 id="t-barefoot">{t("bf.title")}</h2>
              <div className="prose"><p>{t("bf.p1")}</p><p>{t("bf.p2")}</p></div>
            </div>
            <div className="details">
              <figure><img src="/fotos/detalle-cana.webp" alt="Techo de caña" loading="lazy" width="1280" height="1600" /><figcaption>{t("bf.c1")}</figcaption></figure>
              <figure><img src="/fotos/detalle-tejido.webp" alt="Alfombra tejida a mano" loading="lazy" width="1280" height="1600" /><figcaption>{t("bf.c2")}</figcaption></figure>
              <figure><img src="/fotos/detalle-sofa.webp" alt="Sofá exterior junto a la terraza de madera" loading="lazy" width="1280" height="1600" /><figcaption>{t("bf.c3")}</figcaption></figure>
            </div>
          </div>
        </section>

        <section className="fullbleed on-photo imagine">
          <img className="day-only" src="/fotos/dia-sientes.webp" alt="La piscina frente a la casa de techo de teja, con una palmera, a pleno sol" loading="lazy" />
          <img className="night-only" src="/fotos/vista-al-salir-de-la-ducha.webp" alt="La casa y la piscina iluminadas de noche" loading="lazy" />
          <div className="wrap day-only im-day"><p className="eyebrow">{t("im.eyebrow")}</p><h2>{t("imd.title")}</h2><p className="body">{t("imd.body")}</p></div>
          <div className="wrap night-only"><p className="eyebrow">{t("im.eyebrow")}</p><h2>{t("im.title")}</h2><p className="body">{t("im.body")}</p></div>
        </section>

        <section id="incluye" className="incluye" aria-labelledby="t-incluye">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("inc.eyebrow")}</p><h2 id="t-incluye">{t("inc.title")}</h2></div><div className="prose"><p>{t("inc.p")}</p></div></div>
            <div className="inc-grid">
              {[1, 2, 3, 4].map(i => <article key={i} className="inc"><span className="n">{String(i).padStart(2, "0")}</span><p className="kicker">{t(`inc.k${i}`)}</p><h3>{t(`inc.t${i}`)}</h3><p>{t(`inc.d${i}`)}</p></article>)}
            </div>
          </div>
        </section>

        <section id="casa" className="casa linen" aria-labelledby="t-casa">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("casa.eyebrow")}</p><h2 id="t-casa">{t("casa.title")}</h2></div><div className="prose"><p>{t("casa.p")}</p></div></div>
            <div className="strip" tabIndex={0} aria-label="Espacios de la casa">
              {[["faro-piscina", "Piscina con el faro de rayas al fondo", 1], ["sala-frente-al-mar", "Sala exterior frente al mar bajo una pérgola de madera", 2], ["comedor-exterior", "Comedor exterior de madera con cocina abierta", 3], ["piscina-casa", "Piscina frente a la casa de techo de teja", 4], ["noche-pergola", "Palmeras de noche sobre la pérgola iluminada", 5]].map(([img, alt, i]) =>
                <figure key={img}><img src={`/fotos/${img}.webp`} alt={alt} loading="lazy" /><figcaption><b>{t(`casa.s${i}`)}</b><span>{t(`casa.s${i}d`)}</span></figcaption></figure>)}
            </div>
            <p className="strip-hint">{t("casa.hint")}</p>
            <div className="rooms">
              <article className="room">
                <div className="main"><img src="/fotos/hab-maracuya.webp" alt="Habitación Maracuyá con altillo de madera" loading="lazy" /></div>
                <div className="side"><div><h3>{t("room1.title")}</h3><span className="tag">{t("room1.tag")}</span><p>{t("room1.p")}</p></div>
                  <div className="pair"><img src="/fotos/hab-maracuya-techo.webp" alt="Techo de vigas de madera con lámparas de papel" loading="lazy" /><img src="/fotos/hab-maracuya-cafe.webp" alt="Rincón de café con vasos amarillos" loading="lazy" /></div></div>
              </article>
              <article className="room flip">
                <div className="main"><img src="/fotos/hab-del-valle.webp" alt="Habitación Del Valle con cama de madera" loading="lazy" /></div>
                <div className="side"><div><h3>{t("room2.title")}</h3><span className="tag">{t("room2.tag")}</span><p>{t("room2.p")}</p></div>
                  <div className="pair"><img src="/fotos/hab-del-valle-detalle.webp" alt="Detalle de la habitación Del Valle" loading="lazy" /><img src="/fotos/bano-del-valle.webp" alt="Baño con espejo de madera" loading="lazy" /></div></div>
              </article>
            </div>
            <div className="welcome">
              <img src="/fotos/toallas-bienvenida.webp" alt="Toallas de playa a rayas con el logo de Maracuyá" loading="lazy" />
              <img src="/fotos/cojin-logo.webp" alt="Cojín con el logo de Maracuyá sobre la cama" loading="lazy" />
              <div className="note"><h3>{t("wel.title")}</h3><p>{t("wel.p")}</p></div>
            </div>
          </div>
        </section>

        <section className="fullbleed quiet" aria-label="Ojalá nunca perdamos la capacidad de ver belleza en lo simple">
          <video autoPlay muted loop playsInline preload="metadata" poster="/videos/viento-belleza-horizontal-portada.webp"><source src="/videos/viento-belleza-horizontal.mp4" type="video/mp4" /></video>
        </section>

        <section className="dia" id="un-dia" aria-labelledby="t-dia">
          <div className="wrap">
            <div className="dia-media"><video autoPlay muted loop playsInline preload="metadata" poster="/videos/atardecer-dia-portada.webp" aria-label="Atardecer en el jardín: la pérgola iluminada, las palmeras y el mar al fondo"><source src="/videos/atardecer-dia.mp4" type="video/mp4" /></video></div>
            <div className="dia-copy">
              <p className="eyebrow">{t("dia.eyebrow")}</p><h2 id="t-dia">{t("dia.title")}</h2>
              <p className="dia-lede">{t("dia.p")}</p>
              <ol className="dia-list">{[1, 2, 3, 4, 5, 6].map(i => <li key={i}><span className="when">{t(`dia.k${i}`)}</span><h3>{t(`dia.t${i}`)}</h3><p>{t(`dia.d${i}`)}</p></li>)}</ol>
              <p className="fine">{t("dia.note")}</p>
            </div>
          </div>
        </section>

        <section className="plans" id="planes" aria-labelledby="t-planes">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("plans.eyebrow")}</p><h2 id="t-planes">{t("plans.title")}</h2></div><div className="prose"><p>{t("plans.p")}</p></div></div>
            <div className="plan-grid">
              <Plan id="esencial" n="p1" img="/fotos/cafe-de-la-tia.webp" alt="Café de la mañana en la terraza" />
              <Plan id="plena" n="p2" img="/fotos/postre-maracuya.webp" alt="Postre de maracuyá en vaso" />
            </div>
            <div className="howrate" aria-labelledby="t-howrate">
              <div className="hr-main">
              <div className="hr-head"><p className="eyebrow">{t("hr.k")}</p><h3 id="t-howrate">{t("hr.t")}</h3><p>{t("hr.p")}</p></div>
              <ol className="hr-steps">
                <li><span className="hr-n">1</span><div><b>{t("hr.s1")}</b><p>{t("hr.s1p")}</p></div></li>
                <li className="plus" aria-hidden="true">+</li>
                <li><span className="hr-n">2</span><div><b>{t("hr.s2")}</b><p>{t("hr.s2p")}</p></div></li>
              </ol>
              <p className="hr-fine">{t("hr.fine")}</p>
              </div>
              <aside className="hr-ex">
                <p className="hr-exk">{t("hr.exk")}</p>
                <ul>
                  {[[4, 0], [6, 0], [8, 2], [12, 6]].map(([g, x]) => (
                    <li key={g}>
                      <span className="hr-g"><b>{g}</b> {t("people")}</span>
                      <span className="hr-eq">{x ? <>{t("hr.house")} <em>+ {x} {t(x === 1 ? "hr.one" : "hr.many")}</em></> : t("hr.house")}</span>
                    </li>
                  ))}
                </ul>
                <div className="hr-close"><p>{t("hr.close")}</p><span>{t("hr.closeS")}</span><a className="btn btn-primary" href="#reservar">{t("hr.cta")}</a></div>
              </aside>
            </div>
            <div className="seasons"><p {...html("plans.s1")} /><p {...html("plans.s2")} /></div>
          </div>
        </section>

        <section className="fullbleed espera" aria-labelledby="t-espera">
          <video autoPlay muted loop playsInline preload="none" poster="/videos/todo-puede-esperar-portada.webp" aria-hidden="true"><source src="/videos/todo-puede-esperar.mp4" type="video/mp4" /></video>
          <div className="wrap">
            <p className="eyebrow">{t("esp.k")}</p>
            <h2 id="t-espera">{t("esp.t1")} <em>{t("esp.t2")}</em></h2>
            <p className="body">{t("esp.p")}</p>
            <div className="e-help"><p>{t("cmp.help")}</p><a className="btn btn-primary" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(t("plans.wahelp"))}`} target="_blank" rel="noopener noreferrer">{t("cmp.helpbtn")}</a></div>
          </div>
        </section>

        <section className="petsec" id="mascotas" aria-labelledby="t-pets">
          <div className="wrap">
            <div className="pet-media">
              <video id="petVideo" data-once muted playsInline preload="auto" poster="/videos/perro-descanso-portada.webp" aria-label="El perro de la casa camina por el muelle hacia el faro; luego se ven la piscina y la terraza"><source src="/videos/perro-descanso.mp4" type="video/mp4" /></video>
              <span className="pet-badge" aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="10" r="2.2" /><circle cx="9.2" cy="5.6" r="2.2" /><circle cx="14.8" cy="5.6" r="2.2" /><circle cx="19" cy="10" r="2.2" /><path d="M12 11c-3 0-6.5 4.6-6.5 7.2 0 1.7 1.3 2.8 3 2.8 1.4 0 2.2-.8 3.5-.8s2.1.8 3.5.8c1.7 0 3-1.1 3-2.8C18.5 15.6 15 11 12 11z" /></svg>
                <span>Pet<br />friendly</span>
              </span>
            </div>
            <div className="pet-copy">
              <p className="eyebrow">{t("pets.eyebrow")}</p>
              <h2 id="t-pets" {...html("pets.title")} />
              <p className="pet-lede">{t("pets.p")}</p>
              <p className="pet-note">{t("pets.note")}</p>
              <a className="btn btn-primary" href="#reservar" onClick={() => set("pet", "si")}>{t("pets.cta")}</a>
            </div>
          </div>
        </section>

        <section id="mesa" className="mesa linen" aria-labelledby="t-mesa">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("mesa.eyebrow")}</p><h2 id="t-mesa">{t("mesa.title")}</h2></div><div className="prose"><p>{t("mesa.p")}</p></div></div>
            <div className="table-grid">
              <div className="vid"><video autoPlay muted loop playsInline preload="metadata" poster="/videos/la-mesa-portada.webp" aria-label="Jugos, tequeños y la mesa frente al mar"><source src="/videos/la-mesa.mp4" type="video/mp4" /></video></div>
              <div className="a"><img src="/fotos/tequenos.webp" alt="Tequeños y croquetas de pescado sobre tabla con el logo" loading="lazy" /></div>
              <div className="b"><img src="/fotos/jugos-brindis.webp" alt="Brindis con jugos naturales junto a la piscina" loading="lazy" /></div>
              <div className="c"><img src="/fotos/tequeno-queso.webp" alt="Tequeño recién hecho con queso" loading="lazy" /></div>
              <div className="d"><img src="/fotos/chef-sirviendo.webp" alt="Nuestra cocinera sirviendo el desayuno" loading="lazy" /></div>
            </div>
            <div className="how"><h3>{t("mesa.h")}</h3><ol className="steps">{[1, 2, 3].map(i => <li key={i}>{t(`mesa.s${i}`)}</li>)}</ol></div>
            <div className="quote"><img src="/fotos/cafe-mesa.webp" alt="Taza de café en la terraza" loading="lazy" /><blockquote>{t("mesa.quote")}</blockquote></div>
          </div>
        </section>

        <section className="adicora" id="adicora" aria-labelledby="t-adicora">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("adi.eyebrow")}</p><h2 id="t-adicora">{t("adi.title")}</h2></div><div className="prose"><p>{t("adi.p")}</p></div></div>
            <div className="chapters">
              <article className="chapter">
                <div className="media"><img src="/fotos/faro-piscina.webp" alt="El faro de Adícora de rayas rojas y blancas junto a la casa" loading="lazy" style={{ aspectRatio: "4/3", objectPosition: "50% 30%" }} /></div>
                <div className="copy"><span className="kicker">{t("ch1.k")}</span><h3>{t("ch1.t")}</h3><p>{t("ch1.p")}</p></div>
              </article>
              <article className="chapter flip">
                <div className="media tall"><video autoPlay muted loop playsInline preload="metadata" poster="/videos/kite-desde-la-casa-portada.webp" aria-label="Kitesurf visto desde la terraza"><source src="/videos/kite-desde-la-casa.mp4" type="video/mp4" /></video></div>
                <div className="copy"><span className="kicker">{t("ch2.k")}</span><h3>{t("ch2.t")}</h3><p>{t("ch2.p")}</p></div>
              </article>
              <article className="chapter">
                <div className="media tall"><video autoPlay muted loop playsInline preload="metadata" poster="/videos/atardecer-luces-portada.webp" aria-label="Atardecer con luces en el jardín"><source src="/videos/atardecer-luces.mp4" type="video/mp4" /></video></div>
                <div className="copy"><span className="kicker">{t("ch3.k")}</span><h3>{t("ch3.t")}</h3><p>{t("ch3.p")}</p></div>
              </article>
            </div>
          </div>
        </section>

        <section className="where" id="ubicacion" aria-labelledby="t-where">
          <div className="wrap">
            <div className="map"><img src="/fotos/mapa-falcon.webp" alt="Mapa de la península de Paraguaná con Casa Maracuyá marcada junto a Adícora" loading="lazy" width="720" height="900" /></div>
            <div>
              <p className="eyebrow">{t("where.eyebrow")}</p><h2 id="t-where">{t("where.title")}</h2>
              <div className="prose"><p>{t("where.p")}</p></div>
              <dl><dt>{t("where.d1")}</dt><dd>{t("where.v1")}</dd><dt>{t("where.d2")}</dt><dd>{t("where.v2")}</dd><dt>{t("where.d3")}</dt><dd>{t("where.v3")}</dd></dl>
              <div className="ctas"><a className="btn btn-primary" href={MAPS_URL} target="_blank" rel="noopener noreferrer">{t("where.maps")}</a><a className="btn btn-ghost" href="https://www.instagram.com/lacasamaracuya/" target="_blank" rel="noopener noreferrer">@lacasamaracuya</a></div>
            </div>
          </div>
        </section>

        <section className="faq" id="preguntas" aria-labelledby="t-faq">
          <div className="wrap">
            <div><p className="eyebrow">{t("faq.eyebrow")}</p><h2 id="t-faq">{t("faq.title")}</h2></div>
            <div className="faq-list">{Array.from({ length: 11 }, (_, i) => i + 1).map(i => {
              const open = faq === i;
              return <div key={i} className={`q${open ? " open" : ""}`}>
                <h3><button type="button" id={`faq-q${i}`} aria-expanded={open} aria-controls={`faq-a${i}`} onClick={() => setFaq(open ? 0 : i)}>{t(`faq.q${i}`)}<span className="ico" aria-hidden="true" /></button></h3>
                <div className="a" id={`faq-a${i}`} role="region" aria-labelledby={`faq-q${i}`} aria-hidden={!open}><div><p>{t(`faq.a${i}`)}</p></div></div>
              </div>;
            })}</div>
          </div>
        </section>

        <section className="book linen" id="reservar" aria-labelledby="t-book">
          <div className="wrap">
            <div>
              <p className="eyebrow">{t("book.eyebrow")}</p><h2 id="t-book">{t("book.title")}</h2>
              <div className="prose"><p>{t("book.p")}</p></div>
              <ol className="steps"><li>{t("book.s1")}</li><li>{t("book.s2")}</li><li>{t("book.s3")}</li></ol>
            </div>
            <form className="card" noValidate onSubmit={submit}>
              <fieldset className="field full"><legend>{t("f.plan")}</legend>
                <div className="choice">
                  {["esencial","plena"].map((p, i) => <label key={p}><input type="radio" name="plan" id={`plan-${p}`} value={p} checked={f.plan === p} onChange={() => set("plan", p)} /> <span>{t(i ? "p2.title" : "p1.title")}</span></label>)}
                </div>
              </fieldset>
              <div className="field"><label htmlFor="guests">{t("f.adults")}</label>
                <select id="guests" value={f.guests} onChange={e => set("guests", e.target.value)}>{Array.from({ length: 12 - payB }, (_, i) => i + 1).map(i => <option key={i} value={i}>{i} {i === 1 ? t("person") : t("people")}</option>)}</select></div>
              <div className="field"><label htmlFor="babies">{t("f.babies")}</label>
                <select id="babies" value={f.babies} aria-describedby="babies-hint" onChange={e => set("babies", e.target.value)}>{Array.from({ length: 2 + (12 - n) + 1 }, (_, i) => i).map(i => <option key={i} value={i}>{i}</option>)}</select>
                <small id="babies-hint" className="hint">{t("f.babieshint")}</small></div>
              <p className="hint" style={{ gridColumn: "1 / -1", margin: "-6px 0 0", fontSize: ".82rem", color: "var(--muted)" }}>{t("f.capacity")}</p>
              <div className="field"><label htmlFor="checkin">{t("f.in")}</label><input type="date" id="checkin" min={today || undefined} value={f.checkin} onChange={e => set("checkin", e.target.value)} required /></div>
              <div className="field"><label htmlFor="checkout">{t("f.out")}</label><input type="date" id="checkout" min={f.checkin || today || undefined} value={f.checkout} onChange={e => set("checkout", e.target.value)} required /></div>
              <div className="field"><label htmlFor="name">{t("f.name")}</label><input type="text" id="name" autoComplete="name" value={f.name} onChange={e => set("name", e.target.value)} required /></div>
              <div className="field"><label htmlFor="phone">{t("f.phone")}</label><input type="tel" id="phone" autoComplete="tel" placeholder={t("f.phoneph")} value={f.phone} onChange={e => set("phone", e.target.value)} required /></div>
              <div className="field"><label htmlFor="pet">{t("f.pet")}</label>
                <select id="pet" value={f.pet} onChange={e => set("pet", e.target.value)}><option value="no">{t("f.no")}</option><option value="si">{t("f.yes")}</option></select></div>
              <div className="field"><label htmlFor="how">{t("f.how")}</label>
                <select id="how" value={f.how} onChange={e => set("how", e.target.value)}><option value="">{t("f.choose")}</option>{["ig","google","rec","tiktok","other"].map(k => <option key={k} value={k}>{t("how." + k)}</option>)}</select></div>
              <div className="field"><label htmlFor="celebra">{t("f.celebra")}</label>
                <select id="celebra" value={f.celebra} onChange={e => set("celebra", e.target.value)}><option value="">{t("f.no")}</option>{["cumple","aniv","luna","familia","amigos","other"].map(k => <option key={k} value={k}>{t("cel." + k)}</option>)}</select></div>
              <div className="hp" aria-hidden="true"><label htmlFor="sitio_web">Sitio web</label><input type="text" id="sitio_web" name="sitio_web" ref={trap} tabIndex={-1} autoComplete="off" defaultValue="" /></div>
              <div className="field full"><label htmlFor="notes">{t("f.notes")}</label><textarea id="notes" placeholder={t("f.notesph")} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
              <div className="summary" aria-live="polite">
                <span>{t("sum.plan")}: <b>{planName}</b></span><span>{t("sum.rate")}: <b>{payN} {payN === 1 ? t("person") : t("people")}</b> · {rateLabel}</span>
                <span>{nights && nights > 0 ? <><b>{nights}</b> {nights === 1 ? t("night") : t("nights")}</> : t("sum.empty")}</span>
              </div>
              {taken && <p className="form-error" role="status">{t("f.taken")}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="actions">
                <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? t("f.sending") : t("f.submit")}</button>
                <p className="fine">{t("f.fine")}</p>
                <p className="fine">{t("f.privacy")} <a href={PATHS.privacy[lang]}>{t("foot.privacy")}</a>.</p>
              </div>
              {result && <div className="result">
                {result.saved && <p className="fine" style={{ fontWeight: 700 }}>{t("f.saved")}</p>}
                {result.failed && <p className="form-error" role="status">{t("err.send")}</p>}
                <pre>{result.text.split("\n").map((l, i) => <span key={i}>{l.split(/\*([^*]+)\*/).map((x, j) => j % 2 ? <b key={j}>{x}</b> : x)}{"\n"}</span>)}</pre>
                <div className="row"><a className="btn btn-primary" href={waHref} target="_blank" rel="noopener noreferrer">{t("f.wa")}</a><button className="btn btn-ghost" type="button" onClick={copyMsg}>{copied ? t("f.copied") : t("f.copy")}</button></div>
              </div>}
            </form>
          </div>
        </section>

        <section className="fullbleed closing on-photo">
          <img className="day-only cl-day-img" src="/fotos/cierre-dia.webp" alt="Sala exterior bajo la pérgola de madera, frente al mar, de día" loading="lazy" />
          <img className="night-only" src="/fotos/cierre-noche.webp" alt="La piscina y la pérgola de Casa Maracuyá iluminadas de noche" loading="lazy" />
          <div className="wrap day-only"><p className="eyebrow">{t("closed.eyebrow")}</p><h2>{t("closed.title")}</h2><p className="body">{t("closed.p")}</p><div className="ctas"><a className="btn btn-primary" href="#reservar">{t("cta.estadia")}</a></div></div>
          <div className="wrap night-only"><p className="eyebrow">{t("close.eyebrow")}</p><h2>{t("close.title")}</h2><p className="body">{t("close.p")}</p><div className="ctas"><a className="btn btn-primary" href="#reservar">{t("cta.estadia")}</a></div></div>
        </section>
      </main>

      <PageFooter t={t} lang={lang} />

      <div className="mobile-cta"><a className="btn btn-ghost" href="#planes">{t("cta.planes")}</a><a className="btn btn-primary" href="#reservar">{t("cta.reservar")}</a></div>
    </div>
  );
}
