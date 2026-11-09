import { useEffect, useRef, useState } from "react";
import "./site.css";
import { T } from "./i18n.js";
import { crearSolicitud, nochesOcupadas } from "../lib/api.js";
import { WHATSAPP, supabase } from "../lib/supabase.js";
import { MAPS_URL } from "../lib/contacto.js";
import { useNavigate } from "react-router-dom";
import { PATHS, saveLang } from "./paths.js";
import { useMode } from "./shared.jsx";

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
  const [group, setGroup] = useState({ esencial: "1-6", plena: "1-6" });
  const [f, setF] = useState({ plan: "esencial", guests: "4", pet: "no", checkin: "", checkout: "", name: "", phone: "", notes: "" });
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
      const sel = [".head-row",".barefoot .text",".barefoot .big",".barefoot .details figure",".fullbleed .wrap",".strip figure",".room .main",".room .side > *",".welcome > *",".plan",".pet-media",".pet-copy",".table-grid > *",".quote",".chapter .media",".chapter .copy",".where .map",".where .wrap > div:last-child",".book .wrap > *"];
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

  const set = (k, v) => { setF(x => { const n = { ...x, [k]: v }; if (k === "checkin" && n.checkout && n.checkout <= v) n.checkout = ""; return n; }); setError(""); };
  const pick = plan => { setError(""); setF(x => ({ ...x, plan, guests: group[plan] === "6-12" ? "8" : "4" })); };
  const n = Number(f.guests); const nights = nightsBetween(f.checkin, f.checkout);
  const planName = t(f.plan === "plena" ? "p2.title" : "p1.title");
  const groupLabel = n <= 6 ? t("grp.small") : t("grp.large");
  const fmtDate = s => { const x = parseISO(s); return x ? x.toLocaleDateString(lang === "es" ? "es-VE" : "en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : ""; };

  const buildMessage = code => {
    const lines = [t("msg.hello"), "", t("msg.data"), `• ${t("msg.name")}: ${f.name.trim()}`, `• ${t("msg.plan")}: ${planName} (${groupLabel})`, `• ${t("msg.guests")}: ${n}`,
      `• ${t("msg.pet")}: ${f.pet === "si" ? t("f.yes") : t("f.no")}`, `• ${t("msg.in")}: ${fmtDate(f.checkin)}`, `• ${t("msg.out")}: ${fmtDate(f.checkout)}`, `• ${t("msg.nights")}: ${nights}`];
    if (f.notes.trim()) lines.push(`• ${t("msg.notes")}: ${f.notes.trim()}`);
    if (code) lines.push(`• Ref: ${code}`);
    lines.push("", t("msg.bye"));
    return lines.join("\n");
  };
  const submit = async e => {
    e.preventDefault();
    if (!f.checkin || !f.checkout) return setError(t("err.dates"));
    if (f.checkin < todayISO()) return setError(t("err.past"));
    if (nights <= 0) return setError(t("err.order"));
    if (!f.name.trim()) return setError(t("err.name"));
    if (f.phone.replace(/\D/g, "").length < 7) return setError(t("err.phone"));
    setSending(true);
    let code = null, saved = false;
    // Un robot llena el campo trampa o envía en menos de 3 segundos: no se guarda nada,
    // pero se le muestra lo mismo que a una persona para no darle pistas.
    const bot = !!trap.current?.value || Date.now() - shownAt.current < 3000;
    if (!bot) try { code = await crearSolicitud({ name: f.name.trim(), phone: f.phone, plan: f.plan, people: n, pet: f.pet === "si", in: f.checkin, out: f.checkout, notes: f.notes, channel: new URLSearchParams(location.search).get("utm_source") || "Web", lang }); saved = !!code; } catch { /* sigue por WhatsApp */ }
    setSending(false);
    const text = buildMessage(code);
    setResult({ text, saved: saved || bot, failed: !!supabase && !saved && !bot });
  };
  const waHref = result ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(result.text)}` : "#";
  const copyMsg = async () => { try { await navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ } };

  const Plan = ({ id, img, alt, n: k }) => (
    <article className="plan" data-plan={id}>
      <img src={img} alt={alt} loading="lazy" />
      <div className="body">
        <h3>{t(`${k}.title`)}</h3>
        <p className="includes">{t(`${k}.sub`)}</p>
        <ul><li>{t(`${k}.l1`)}</li><li>{t(`${k}.l2`)}</li><li>{t(`${k}.l3`)}</li></ul>
        <div className="seg" role="group" aria-label="Tamaño del grupo">
          {[["1-6", "grp.small"], ["6-12", "grp.large"]].map(([g, key]) => <button key={g} type="button" aria-pressed={group[id] === g} onClick={() => setGroup(x => ({ ...x, [id]: g }))}>{t(key)}</button>)}
        </div>
        <div className="price"><span>{t("plans.rate")}</span><a className="btn btn-primary" href="#reservar" onClick={() => pick(id)}>{t("plans.book")}</a></div>
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

        <section className="plans" id="planes" aria-labelledby="t-planes">
          <div className="wrap">
            <div className="head-row"><div><p className="eyebrow">{t("plans.eyebrow")}</p><h2 id="t-planes">{t("plans.title")}</h2></div><div className="prose"><p>{t("plans.p")}</p></div></div>
            <div className="plan-grid">
              <Plan id="esencial" n="p1" img="/fotos/cafe-de-la-tia.webp" alt="Café de la mañana en la terraza" />
              <Plan id="plena" n="p2" img="/fotos/postre-maracuya.webp" alt="Postre de maracuyá en vaso" />
            </div>
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
              <div className="field"><label htmlFor="guests">{t("f.guests")}</label>
                <select id="guests" value={f.guests} onChange={e => set("guests", e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map(i => <option key={i} value={i}>{i} {i === 1 ? t("person") : t("people")}</option>)}</select></div>
              <div className="field"><label htmlFor="pet">{t("f.pet")}</label>
                <select id="pet" value={f.pet} onChange={e => set("pet", e.target.value)}><option value="no">{t("f.no")}</option><option value="si">{t("f.yes")}</option></select></div>
              <div className="field"><label htmlFor="checkin">{t("f.in")}</label><input type="date" id="checkin" min={today || undefined} value={f.checkin} onChange={e => set("checkin", e.target.value)} required /></div>
              <div className="field"><label htmlFor="checkout">{t("f.out")}</label><input type="date" id="checkout" min={f.checkin || today || undefined} value={f.checkout} onChange={e => set("checkout", e.target.value)} required /></div>
              <div className="field"><label htmlFor="name">{t("f.name")}</label><input type="text" id="name" autoComplete="name" value={f.name} onChange={e => set("name", e.target.value)} required /></div>
              <div className="field"><label htmlFor="phone">{t("f.phone")}</label><input type="tel" id="phone" autoComplete="tel" placeholder={t("f.phoneph")} value={f.phone} onChange={e => set("phone", e.target.value)} required /></div>
              <div className="hp" aria-hidden="true"><label htmlFor="sitio_web">Sitio web</label><input type="text" id="sitio_web" name="sitio_web" ref={trap} tabIndex={-1} autoComplete="off" defaultValue="" /></div>
              <div className="field full"><label htmlFor="notes">{t("f.notes")}</label><textarea id="notes" placeholder={t("f.notesph")} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
              <div className="summary" aria-live="polite">
                <span>{t("sum.plan")}: <b>{planName}</b></span><span>{t("sum.group")}: <b>{groupLabel}</b></span>
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
                <pre>{result.text}</pre>
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

      <footer>
        <div className="wrap">
          <div className="brandcol"><img className="flogo" src="/logo/logo-claro.svg" alt="Maracuyá Relaxing Getaway" width="146" height="58" /><p className="motto">{t("foot.motto")}</p></div>
          <div><h4>{t("foot.explore")}</h4><ul><li><a href="#casa">{t("nav.casa")}</a></li><li><a href="#planes">{t("nav.planes")}</a></li><li><a href="#mesa">{t("nav.mesa")}</a></li><li><a href="#adicora">{t("nav.adicora")}</a></li><li><a href="#reservar">{t("cta.reservar")}</a></li></ul></div>
          <div><h4>{t("foot.contact")}</h4><ul><li><a href="https://www.instagram.com/lacasamaracuya/" target="_blank" rel="noopener noreferrer">Instagram</a></li><li><a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></li><li><a href="mailto:reservas@casa-maracuya.com">reservas@casa-maracuya.com</a></li><li>{t("where.v1")}</li></ul></div>
          <div className="legal"><span>© {new Date().getFullYear()} Casa Maracuyá · Relaxing Getaway</span><span>{t("foot.made")} · <a href={PATHS.privacy[lang]}>{t("foot.privacy")}</a></span></div>
        </div>
      </footer>

      <div className="mobile-cta"><a className="btn btn-ghost" href="#planes">{t("cta.planes")}</a><a className="btn btn-primary" href="#reservar">{t("cta.reservar")}</a></div>
    </div>
  );
}
