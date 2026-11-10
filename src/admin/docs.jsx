import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./docs.css";
import { useMC, Icon, Seg } from "./ui.jsx";
import { TODAY, MES, MESL, DIA, DIAL, PLAN, parse, addDays, diff, season, rateKind, rateKey, can } from "./util.js";

// Hojas imprimibles del panel: el menú de Cocina y el presupuesto de Dirección.
// Siguen las plantillas aprobadas (A4, marco doble, sol en el horizonte).
// «Descargar PDF» usa la impresión del navegador, igual que el comprobante.

/* =================== Base: fuentes, vista previa e impresión =================== */
const FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Outfit:wght@300;400;500;600&display=swap";
function useDocFonts() {
  useEffect(() => {
    if (document.getElementById("doc-fonts")) return;
    const l = document.createElement("link"); l.id = "doc-fonts"; l.rel = "stylesheet"; l.href = FONTS; document.head.appendChild(l);
  }, []);
}

// Una hoja a escala del ancho disponible.
function A4({ children }) {
  const box = useRef(); const [k, setK] = useState(0.5);
  useLayoutEffect(() => {
    const el = box.current; const f = () => setK(el.clientWidth / 794); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  return <div className="a4-prev" ref={box} style={{ height: 1123 * k }}><div className="a4-in" style={{ transform: `scale(${k})` }} aria-hidden="true">{children}</div></div>;
}

/* ---------- Hojas: el contenido se reparte en tantas hojas como haga falta ----------
   Un documento es una «hoja base» (shell: marco, encabezado y pie) más una lista de bloques.
   Cada bloque: { key, el, gap (espacio arriba), keep (no quedarse solo al final de una hoja),
   cont (encabezado que se repite si el bloque abre una hoja, ej. los títulos de la tabla) }.
   Los bloques se miden fuera de la vista con las fuentes reales y se reparten. */
function paginate(spec, m) {
  const B = spec.blocks, pages = [[]]; let used = 0, over = false;
  const cap = () => m.caps[pages.length === 1 ? 0 : 1];
  const cost = (i, top) => (top && pages.length > 1 ? 0 : B[i].gap || 0) + m.hs[i];
  B.forEach((b, i) => {
    const top = pages.at(-1).length === 0;
    let need = cost(i, top);
    for (let j = i; B[j]?.keep && B[j + 1]; j++) need += cost(j + 1, false);
    if (!top && used + need > cap()) { pages.push([]); used = b.cont ? m.cs[b.cont] || 0 : 0; }
    used += cost(i, pages.at(-1).length === 0); pages.at(-1).push(i);
    if (used > cap() + 1) over = true;
  });
  return { pages, over };
}
export function usePaged(spec) {
  const ref = useRef(); const [m, setM] = useState(null);
  const measure = () => {
    const root = ref.current; if (!root) return;
    const caps = [...root.querySelectorAll(".dz-ms [data-fit]")].map(x => x.clientHeight);
    const hs = [...root.querySelectorAll(".dz-mb > [data-b]")].map(x => x.offsetHeight);
    const cs = Object.fromEntries([...root.querySelectorAll(".dz-mb > [data-c]")].map(x => [x.dataset.c, x.offsetHeight]));
    const sig = JSON.stringify([caps, hs, cs]);
    setM(o => o && o.sig === sig ? o : { sig, caps, hs, cs });
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const f = document.fonts; if (!f) return;
    f.ready.then(measure); f.addEventListener?.("loadingdone", measure);
    return () => f.removeEventListener?.("loadingdone", measure);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const B = spec.blocks, C = spec.conts || {};
  const { pages, over } = m && m.hs.length === B.length ? paginate(spec, m) : { pages: [B.map((_, i) => i)], over: false };
  const sheets = pages.map((idx, p) => spec.shell(p, pages.length, <>
    {p > 0 && B[idx[0]]?.cont && C[B[idx[0]].cont]}
    {idx.map((i, j) => <div key={B[i].key} className="dz-b" style={{ paddingTop: p > 0 && j === 0 ? 0 : B[i].gap || 0 }}>{B[i].el}</div>)}
  </>));
  const measureEl = <div className="dz-measure" ref={ref} aria-hidden="true">
    <div className="dz-ms">{spec.shell(0, 1, null)}{spec.shell(1, 2, null)}</div>
    <div className="dz dz-mb">{B.map(b => <div key={b.key} data-b="" className="dz-b">{b.el}</div>)}
      {Object.entries(C).map(([k, el]) => <div key={`c-${k}`} data-c={k} className="dz-b">{el}</div>)}</div>
  </div>;
  return { sheets, measureEl, over };
}
// Vista previa (todas las hojas) + copia para imprimir + avisos.
export function Sheets({ P, holder, overMsg }) {
  return <>
    {P.measureEl}
    <div className="a4-stack">{P.sheets.map((s, i) => <A4 key={i}>{s}</A4>)}</div>
    {P.sheets.length > 1 && <p className="sec-f">Son {P.sheets.length} hojas. Cada una lleva su marco y el número de hoja.</p>}
    {P.over && <div className="err">{overMsg}</div>}
    <PrintCopy holder={holder}>{P.sheets}</PrintCopy>
  </>;
}

// Copia sin escala, fuera de la app: es la única que sale al imprimir.
function PrintCopy({ holder, children }) {
  const [el] = useState(() => document.createElement("div"));
  useEffect(() => { el.className = "doc-print"; document.body.appendChild(el); holder.current = el; return () => el.remove(); }, [el, holder]);
  return createPortal(children, el);
}
async function printDoc(el, title) {
  try { await document.fonts?.ready; } catch { /* sin API de fuentes */ }
  const old = document.title;
  document.querySelectorAll(".doc-print").forEach(x => { x.hidden = x !== el; });
  document.body.classList.add("doc-printing"); document.title = title;
  const done = () => { document.body.classList.remove("doc-printing"); document.title = old; document.querySelectorAll(".doc-print").forEach(x => { x.hidden = false; }); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
}

const Star = ({ c }) => <svg className={`dz-star ${c}`} viewBox="0 0 12 12"><path fill="currentColor" d="M6 0C6.6 4.2 7.8 5.4 12 6 7.8 6.6 6.6 7.8 6 12 5.4 7.8 4.2 6.6 0 6 4.2 5.4 5.4 4.2 6 0Z" /></svg>;
const Frame = () => <div className="dz-frame">{["tl", "tr", "bl", "br"].map(c => <Star key={c} c={c} />)}</div>;
const GOLD = "#C4A56C", GREEN = "#778B63", SUN = "#F7E7A0";
const wave = (x, y, n, w = 12) => `M${x} ${y}` + Array.from({ length: n }, (_, i) => i === 0 ? ` q${w / 2} -4.5 ${w} 0` : ` t${w} 0`).join("");
const amp = s => String(s || "").split("&").flatMap((p, i) => i ? [<span key={i} className="dz-amp">&amp;</span>, p] : [p]);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtN = n => Number(n || 0).toLocaleString("es-VE", { maximumFractionDigits: 2 });
const longDate = s => { const d = parse(s); return `${d.getDate()} de ${MESL[d.getMonth()]} de ${d.getFullYear()}`; };
const toNum = v => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? null : n; };

/* =================== Presupuesto =================== */
function Horizon() {
  return <svg className="dz-horizon" viewBox="0 0 794 56" fill="none" aria-hidden="true">
    <line x1="45" x2="749" y1="40" y2="40" stroke={GOLD} strokeWidth="1" />
    <path d="M376 40A21 21 0 0 1 418 40Z" fill={SUN} />
    <path d="M364 40A33 33 0 0 1 430 40" stroke={GOLD} strokeWidth="1.2" strokeDasharray="0.1 5" strokeLinecap="round" />
    <path d={wave(314, 50, 4)} stroke={GREEN} strokeWidth="1.1" /><path d={wave(432, 50, 4)} stroke={GREEN} strokeWidth="1.1" />
  </svg>;
}
const hoja = (p, total) => total > 1 ? ` · Hoja ${p + 1} de ${total}` : "";
export function budgetSpec(b) {
  const both = b.paquetes.length > 1; const p0 = b.paquetes[0];
  const cols = { gridTemplateColumns: `minmax(0,1fr) repeat(${b.paquetes.length},150px)` };
  const thead = <div className="dz-tr h" style={cols}><span className="dz-eyebrow">Noche</span>
    {both ? b.paquetes.map(p => <span key={p} className="n"><span className="dz-eyebrow">Paquete</span><span className="pk">{p === "plena" ? <em>Plena</em> : "Esencial"}</span></span>)
      : <span className="n dz-eyebrow">Tarifa</span>}</div>;
  const last = b.rows.length - 1;
  const blocks = [
    { key: "who", gap: 64, el: <section className="dz-who">
      <div><div className="dz-eyebrow">Preparado para</div><div className="name">{b.nombre || "—"}</div></div>
      <div className="dz-boxes">{b.boxes.map(x => <div key={x.k}><div className="dz-eyebrow">{x.k}</div><b>{x.v}</b>{x.s && <small>{x.s}</small>}</div>)}</div>
    </section> },
    { key: "sec", gap: 34, keep: true, el: <div className="dz-sec"><h2>{both ? <>Paquetes <em>disponibles</em></> : <>Experiencia <em>{PLAN[p0].short}</em></>}</h2><span className="rule" /><span className="aside">{b.aside}</span></div> },
    { key: "th", gap: 16, keep: true, el: thead },
    ...b.rows.map((r, i) => ({ key: `r${i}`, cont: "th", keep: i === last, el: <div className={`dz-tr ${i === last ? "last" : ""}`} style={cols}><span>{r.label}</span>
      {b.paquetes.map(p => r.vals[p] == null ? <span key={p} className="n empty">—</span> : <span key={p} className="n">$ {fmtN(r.vals[p])}</span>)}</div> })),
    { key: "tot", el: <div className="dz-total"><span className="dz-eyebrow">Total · {b.noches} {b.noches === 1 ? "noche" : "noches"}</span>
      <div className="nums">{b.paquetes.map(p => <span key={p}><b>{fmtN(b.totals[p])}</b><small>USD</small></span>)}</div></div> },
    ...(b.notas.length ? [{ key: "nh", gap: 30, keep: true, el: <div className="dz-sec"><h2>Notas</h2><span className="rule" /></div> },
      ...b.notas.map((n, i) => ({ key: `n${i}`, gap: i ? 9 : 12, el: <p className="dz-note">{n}</p> }))] : [])
  ];
  const shell = (p, total, children) => <div className="dz" key={p}>
    <Frame />
    {p === 0 ? <><Horizon /><header className="dz-bhead">
      <img src="/logo/logo-dorado.svg" alt="Maracuyá · Relaxing Getaway" />
      <div className="r"><div className="dz-eyebrow">Cotización de estadía</div><h1>Presu<em>puesto</em></h1><div className="issued">Emitido el {longDate(b.emitido)}</div></div>
    </header></> : <header className="dz-chead"><img src="/logo/logo-dorado.svg" alt="Maracuyá" /><div className="r"><div className="dz-eyebrow">Presupuesto · continuación</div><b>{b.nombre}</b></div></header>}
    <div className="dz-fill" data-fit>{children}</div>
    <footer className="dz-foot"><div className="line"><span className="dz-seal"><img src="/logo/simbolo.svg" alt="" /></span></div><p>Casa Maracuyá · Junto al Faro de Adícora, Falcón{hoja(p, total)}</p></footer>
  </div>;
  return { shell, blocks, conts: { th: thead } };
}

// Tarifa sugerida para una noche: la de semana o fin de semana del plan (vista Tarifas).
const rateFor = (S, night, plan) => toNum(S.rates[rateKey(plan, night)]);
const PAQ = { esencial: ["esencial"], plena: ["plena"], ambos: ["esencial", "plena"] };

export function buildBudget(f, S) {
  const fechas = f.modo === "fechas" && f.in && f.out && f.out > f.in;
  const n = fechas ? diff(f.in, f.out) : f.noches;
  const keys = Array.from({ length: Math.max(0, Math.min(n, 30)) }, (_, i) => fechas ? addDays(f.in, i) : String(i + 1));
  const paquetes = PAQ[f.paq];
  const sug = (p, k) => fechas ? rateFor(S, k, p) : null;
  const val = (p, k) => { const o = f.precios[`${p}|${k}`]; return o !== undefined ? toNum(o) : sug(p, k); };
  const rows = keys.map(k => { const d = fechas && parse(k); return { key: k,
    label: fechas ? `${cap(DIAL[d.getDay()])} ${d.getDate()} de ${MESL[d.getMonth()]}` : `Noche ${k}`,
    sub: fechas ? (season(k) === "alta" ? "Temporada alta · precio de fin de semana" : rateKind(k) === "finde" ? "Fin de semana" : "Día de semana") : "",
    vals: Object.fromEntries(paquetes.map(p => [p, val(p, k)])), sug: Object.fromEntries(paquetes.map(p => [p, sug(p, k)])) }; });
  const totals = Object.fromEntries(paquetes.map(p => [p, rows.reduce((s, r) => s + (r.vals[p] || 0), 0)]));
  const A = fechas && parse(f.in), B = fechas && parse(f.out);
  const noches = `${n} ${n === 1 ? "noche" : "noches"}`;
  const boxes = fechas
    ? [{ k: "Llegada", v: `${cap(DIA[A.getDay()])} ${A.getDate()} ${MES[A.getMonth()]}`, s: "Check-in 3:00 pm" }, { k: "Salida", v: `${cap(DIA[B.getDay()])} ${B.getDate()} ${MES[B.getMonth()]}`, s: "Check-out 11:00 am" }]
    : [{ k: "Estadía", v: noches }, { k: "Check-in", v: "3:00 pm" }, { k: "Check-out", v: "11:00 am" }];
  if (f.personas > 0) boxes.push({ k: "Huéspedes", v: `${f.personas} ${f.personas === 1 ? "persona" : "personas"}` });
  const grupo = f.personas > 0 ? ` para el grupo completo de ${f.personas} ${f.personas === 1 ? "persona" : "personas"}` : "";
  const auto = [
    paquetes.length > 1 ? `Tarifas por noche${grupo || " de cada paquete"}, expresadas en dólares estadounidenses.` : `Tarifa por noche de la Experiencia ${PLAN[paquetes[0]].short}${grupo}, expresada en dólares estadounidenses.`,
    fechas ? `Estadía de ${noches}: check-in el ${DIAL[A.getDay()]} ${A.getDate()} de ${MESL[A.getMonth()]} a las 3:00 pm y check-out el ${DIAL[B.getDay()]} ${B.getDate()} de ${MESL[B.getMonth()]} de ${B.getFullYear()} a las 11:00 am.`
      : `Estadía de ${noches} con check-in a las 3:00 pm y check-out a las 11:00 am.`,
    "La reserva se confirma con el pago acordado."
  ];
  const notas = f.notas == null ? auto : f.notas.split("\n").map(s => s.trim()).filter(Boolean);
  return { nombre: f.nombre.trim(), emitido: TODAY, boxes, paquetes, rows, totals, noches: n, notas, auto,
    aside: fechas ? `${noches} · ${A.getFullYear()}` : noches, fechas, falta: rows.some(r => paquetes.some(p => r.vals[p] == null)) };
}

// El borrador se conserva mientras el panel está abierto, aunque se cierre la hoja.
let draft = null;
const blank = () => ({ nombre: "", modo: "fechas", in: addDays(TODAY, 14), out: addDays(TODAY, 18), noches: 4, personas: 0, paq: "ambos", precios: {}, notas: null });

export function BudgetSheet({ res }) {
  useDocFonts();
  const { S, toast } = useMC();
  const [f, setF] = useState(() => {
    const r = res && S.reservas.find(x => x.id === res);
    if (r) return { ...blank(), nombre: S.guests[r.g]?.name || "", in: r.in, out: r.out, personas: r.people, paq: r.plan };
    return draft || blank();
  });
  useEffect(() => { draft = f; }, [f]);
  const holder = useRef();
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const b = buildBudget(f, S);
  const P = usePaged(budgetSpec(b));
  const setPrice = (p, k, v) => setF(x => ({ ...x, precios: { ...x.precios, [`${p}|${k}`]: v.replace(/[^\d.,]/g, "") } }));
  const setAll = (p, v) => setF(x => { const pr = { ...x.precios }; b.rows.forEach(r => { pr[`${p}|${r.key}`] = v.replace(/[^\d.,]/g, ""); }); return { ...x, precios: pr }; });
  const download = () => {
    if (!b.nombre) return toast("Escribe para quién es el presupuesto");
    if (!b.noches) return toast("Revisa las fechas: la salida va después de la llegada");
    printDoc(holder.current, `Presupuesto Casa Maracuyá - ${b.nombre}`);
  };
  const both = b.paquetes.length > 1;
  const stepper = (k, min, max, label, fmt = v => v) => <div className="stepper" role="group" aria-label={label}>
    <button type="button" onClick={() => set(k, Math.max(min, f[k] - 1))} aria-label={`${label}: uno menos`}>−</button><output>{fmt(f[k])}</output>
    <button type="button" onClick={() => set(k, Math.min(max, f[k] + 1))} aria-label={`${label}: uno más`}>+</button></div>;

  return <div className="form">
    <p className="sec-f" style={{ padding: "4px 4px 0" }}>Llena los datos y descarga el PDF para enviarlo por WhatsApp o correo.</p>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="bdName">Preparado para</label><input id="bdName" className="field-in" placeholder="Nombre del cliente" value={f.nombre} onChange={e => set("nombre", e.target.value)} autoComplete="off" /></div>
    </div></section>
    <section className="sec"><div className="sec-h">Estadía</div>
      <Seg value={f.modo} onChange={v => set("modo", v)} label="Cómo se indica la estadía" options={[["fechas", "Con fechas"], ["noches", "Solo noches"]]} />
      <div className="group" style={{ marginTop: 10 }}>
        {f.modo === "fechas" ? <>
          <div className="row"><label className="k" htmlFor="bdIn">Llegada</label><input type="date" id="bdIn" className="field-in" value={f.in} onChange={e => set("in", e.target.value)} /></div>
          <div className="row"><label className="k" htmlFor="bdOut">Salida</label><input type="date" id="bdOut" className="field-in" value={f.out} min={f.in} onChange={e => set("out", e.target.value)} /></div>
        </> : <div className="row"><span className="k">Noches</span>{stepper("noches", 1, 30, "Noches")}</div>}
        <div className="row"><span className="k">Huéspedes<small style={{ display: "block", color: "var(--ink3)", fontWeight: 600, fontSize: 12 }}>{f.personas ? "Sale en el presupuesto" : "No se muestra"}</small></span>{stepper("personas", 0, 12, "Huéspedes", v => v || "—")}</div>
      </div>
      {f.modo === "fechas" && f.out <= f.in && <div className="err">La salida tiene que ser después de la llegada.</div>}
    </section>
    <section className="sec"><div className="sec-h">Paquete</div>
      <Seg value={f.paq} onChange={v => set("paq", v)} label="Paquete" options={[["esencial", "Esencial"], ["plena", "Plena"], ["ambos", "Los dos"]]} />
      <p className="sec-f">«Los dos» arma la tabla comparativa de Esencial y Plena.</p>
    </section>
    <section className="sec"><div className="sec-h">Tarifa por noche (USD)</div>
      <div className="ed-sec">
        <div className={`bud-row h ${both ? "both" : ""}`}><span>Todas las noches</span>{b.paquetes.map(p => <span key={p}>{PLAN[p].short}</span>)}</div>
        <div className={`bud-row ${both ? "both" : ""}`}><span className="d">Mismo precio<small>Lo copia en cada noche</small></span>{b.paquetes.map(p =>
          <input key={p} className="ed-in" inputMode="decimal" placeholder="$" aria-label={`Mismo precio para todas las noches, ${PLAN[p].short}`} onChange={e => setAll(p, e.target.value)} />)}</div>
        <div className="ed-sub">Por noche</div>
        <div className="bud-nights">{b.rows.map(r => <div key={r.key} className={`bud-row ${both ? "both" : ""}`}><span className="d">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          {b.paquetes.map(p => { const o = f.precios[`${p}|${r.key}`]; return <input key={p} className="ed-in" inputMode="decimal" aria-label={`${r.label}, ${PLAN[p].short}`}
            placeholder={r.sug[p] != null ? fmtN(r.sug[p]) : "$"} value={o !== undefined ? o : r.sug[p] != null ? String(r.sug[p]) : ""} onChange={e => setPrice(p, r.key, e.target.value)} />; })}</div>)}</div>
        <div className={`bud-row ${both ? "both" : ""}`} style={{ borderTop: "1.5px solid var(--line2)" }}><span className="d">Total</span>{b.paquetes.map(p => <span key={p} style={{ textAlign: "right", fontWeight: 800, paddingRight: 10 }}>${fmtN(b.totals[p])}</span>)}</div>
      </div>
      <p className="sec-f">{b.fechas ? "Salen solas de Más › Tarifas: precio de semana o de fin de semana según la noche (en temporada alta, todas a fin de semana). Puedes cambiar cualquiera." : "Escribe el precio de cada noche o usa «Mismo precio»."}</p>
    </section>
    <section className="sec"><div className="sec-h">Notas {f.notas != null && <button type="button" onClick={() => set("notas", null)}>Restaurar</button>}</div>
      <div className="group"><div className="row"><label htmlFor="bdNotes" className="sr">Notas</label>
        <textarea id="bdNotes" className="field-full" rows={4} value={f.notas ?? b.auto.join("\n")} onChange={e => set("notas", e.target.value)} /></div></div>
      <p className="sec-f">Una nota por línea. Se escriben solas con los datos de arriba hasta que las cambies.</p>
    </section>
    <section className="sec"><div className="sec-h">Así queda</div>
      <Sheets P={P} holder={holder} overMsg="Una nota es más larga que una hoja: divídela en varias líneas." />
      {b.falta && <div className="note"><Icon n="alert" c="s" w="f" /><span>Hay noches sin precio: salen con una raya.</span></div>}
    </section>
    <div className="btns">
      <button type="button" className="btn press" onClick={download}><Icon n="receipt" w="f" />Descargar PDF</button>
      <button type="button" className="btn plain press" onClick={() => { setF(blank()); toast("Presupuesto en blanco"); }}>Empezar uno nuevo</button>
    </div>
  </div>;
}

/* =================== Menú =================== */
export const MENU_DESAYUNOS = {
  eyebrow: "Especialidades culinarias", titulo: "Menú de", enfasis: "desayunos", pie: "Ingredientes frescos y locales · Adícora, Falcón",
  secciones: [
    { tipo: "elige", titulo: "Arepas tradicionales", nota: "hechas al momento", etiqueta: "Elige tu masa",
      items: [{ n: "Harina P.A.N.", d: "Suave, dorada y de contextura clásica." }, { n: "Maíz pilado", d: "Artesanal: crujiente por fuera, suave por dentro." }, { n: "Galleta de arepa", d: "Delgada y extra crujiente, a la plancha o a la brasa." }],
      cajaEtiqueta: "Rellenos y acompañantes",
      caja: [{ n: "Carne mechada", d: "Sofrito criollo tradicional" }, { n: "Caraotas negras", d: "Guisadas al estilo casero" }, { n: "Mechada de cordero", d: "A fuego lento con hierbas" }, { n: "Queso de cabra", d: "Artesanal, fresco y sabroso" },
        { n: "Pollo sazonado", d: "Jugoso, con especias del huerto" }, { n: "Huevos al gusto", d: "Pericos, revueltos o fritos" }, { n: "Pisillo de la tía", d: "Receta familiar guisada" }] },
    { tipo: "platos", titulo: "Empanadas artesanales", nota: "crujientes y doradas",
      items: [{ n: "Queso de cabra", d: "Queso artesanal de la región." }, { n: "Pollo sazonado", d: "Pechuga desmenuzada y aromatizada." }, { n: "Carne jugosa", d: "Guisada en sofrito de ají dulce y cebollín." }, { n: "Pescado de la costa", d: "Pesca fresca guisada al estilo playero." }] },
    { tipo: "destacado", titulo: "Saludable & proteica", nota: "", plato: "Omelette blanco de la costa", desc: "Para quienes cuidan su ingesta calórica y buscan un alto valor nutricional.",
      datos: [{ v: "5", d: "claras de huevo" }, { v: "Salteado", d: "tomate, cebolla y pimentón" }, { v: "Queso de cabra", d: "artesanal de la región" }],
      extra: "Acompáñalo con aguacate fresco o galleta de arepa crujiente.",
      tabla: { etiqueta: "Valor nutricional", c1: "Kcal", c2: "Proteína", filas: [{ n: "Solo omelette", a: "185", b: "25 g" }, { n: "Con aguacate y galleta", a: "350", b: "27 g", marca: true }] } }
  ]
};
const NUEVA = {
  elige: () => ({ tipo: "elige", titulo: "Nueva sección", nota: "", etiqueta: "Elige", items: [{ n: "", d: "" }], cajaEtiqueta: "Acompañantes", caja: [{ n: "", d: "" }] }),
  platos: () => ({ tipo: "platos", titulo: "Nueva sección", nota: "", items: [{ n: "", d: "" }, { n: "", d: "" }] }),
  destacado: () => ({ tipo: "destacado", titulo: "Nueva sección", nota: "", plato: "", desc: "", datos: [], extra: "", tabla: { etiqueta: "Valor nutricional", c1: "Kcal", c2: "Proteína", filas: [] } })
};
const TIPOS = { elige: "Para elegir, con recuadro", platos: "Platos en dos columnas", destacado: "Plato destacado" };
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

function Scene() {
  const s = { stroke: GOLD, strokeWidth: 1.4, strokeLinecap: "round", fill: "none" };
  const fr = (x, y, list) => list.map((d, i) => <path key={i} d={`M${x} ${y} ${d}`} {...s} />);
  return <svg viewBox="0 0 794 300" aria-hidden="true">
    <path d="M327 258A70 70 0 0 1 467 258Z" fill={SUN} />
    {["M305 258A92 92 0 0 1 321.6 205.2", "M472.4 205.2A92 92 0 0 1 489 258", "M283 258A114 114 0 0 1 309.7 184.7", "M484.3 184.7A114 114 0 0 1 511 258"].map(d =>
      <path key={d} d={d} stroke={GOLD} strokeWidth="1.3" strokeDasharray="0.1 5.5" strokeLinecap="round" fill="none" />)}
    <path d="M205 258C203 230 198 210 190 192" {...s} />
    {fr(190, 192, ["C175 182 160 184 152 198", "C178 176 164 172 150 177", "C186 176 186 164 193 153", "C200 178 214 174 227 180", "C204 186 216 190 223 205"])}
    <path d="M240 258C240 244 237 232 232 222" {...s} />
    {fr(232, 222, ["C222 214 212 216 207 227", "C224 210 214 208 205 212", "C240 212 250 210 259 215", "C242 218 251 222 254 233", "C230 212 232 205 237 198"])}
    <path d="M572 258L580 168M602 258L594 168M573.6 240H600.4M575.4 220H598.6M577.2 200H596.8M578.8 182H595.2M574 168H600M580 168V150H594V168M577 150L587 140L597 150M587 140V132" {...s} strokeWidth="1.3" />
    <path d="M579 156L530 142M595 156L650 140" stroke={GOLD} strokeWidth="1.2" strokeDasharray="0.1 5" strokeLinecap="round" />
    <line x1="28" x2="766" y1="258" y2="258" stroke={GOLD} strokeWidth="1" />
    {[wave(148, 272, 5), wave(330, 278, 9), wave(556, 272, 5)].map(d => <path key={d} d={d} stroke={GREEN} strokeWidth="1.3" fill="none" />)}
  </svg>;
}
const unit = v => { const m = String(v || "").match(/^([\d.,]+)\s*([^\d\s].*)$/); return m ? <>{m[1]}<small> {m[2]}</small></> : v; };
const Dish = ({ it, lead }) => <div><div className={`dz-dish ${lead ? "dz-lead" : ""}`}>{it.n}</div>{it.d && <div className="dz-desc">{it.d}</div>}</div>;

// Bloques de una sección del menú: el título (que no se queda solo) y su contenido.
// Los platos en dos columnas van por filas, para poder pasar de hoja entre una fila y otra.
function menuSecBlocks(s, i) {
  const n = ROMAN[i] || i + 1; const k = `s${i}`;
  const items = (s.items || []).filter(x => x.n || x.d);
  const head = { key: `${k}h`, gap: i ? 24 : 0, keep: true, el: <div className="dz-sec"><h2><span className="num">{n}.</span>{amp(s.titulo)}</h2><span className="rule" />{s.nota && <span className="aside">{s.nota}</span>}</div> };
  if (s.tipo === "elige") {
    const caja = (s.caja || []).filter(x => x.n || x.d);
    return [head, { key: `${k}b`, gap: 16, el: <div className="dz-choose" style={caja.length ? undefined : { gridTemplateColumns: "1fr" }}>
      <div>{s.etiqueta && <div className="dz-eyebrow">{s.etiqueta}</div>}<div className="opts">{items.map((it, j) => <Dish key={j} it={it} />)}</div></div>
      {caja.length > 0 && <div className="dz-box">{s.cajaEtiqueta && <div className="dz-eyebrow">{s.cajaEtiqueta}</div>}<div className="grid">{caja.map((it, j) => <div key={j}><b>{it.n}</b>{it.d && <span>{it.d}</span>}</div>)}</div></div>}
    </div> }];
  }
  if (s.tipo === "destacado") {
    const t = s.tabla || {}; const filas = (t.filas || []).filter(f => f.n || f.a || f.b); const datos = (s.datos || []).filter(x => x.v || x.d);
    return [head, { key: `${k}b`, gap: 14, el: <div className={`dz-feat ${filas.length ? "" : "solo"}`}>
      <div>
        {s.plato && <div className="dz-dish dz-lead" style={{ fontSize: 17 }}>{s.plato}</div>}
        {s.desc && <p className="dz-desc" style={{ marginTop: 10, fontSize: 12 }}>{s.desc}</p>}
        {datos.length > 0 && <div className="dz-facts" style={{ gridTemplateColumns: `repeat(${Math.min(datos.length, 3)},1fr)` }}>{datos.map((x, i) => <div key={i}><b className={/^\d/.test(x.v) ? "big" : ""}>{x.v}</b><span>{x.d}</span></div>)}</div>}
        {s.extra && <p className="dz-extra">{s.extra}</p>}
      </div>
      {filas.length > 0 && <div className="dz-nut"><span className="dz-eyebrow">{t.etiqueta}</span><table><thead><tr><th /><th>{t.c1}</th><th>{t.c2}</th></tr></thead>
        <tbody>{filas.map((f, j) => <tr key={j}><td>{f.n}</td><td className="v">{f.marca ? <mark>{unit(f.a)}</mark> : unit(f.a)}</td><td className="v">{unit(f.b)}</td></tr>)}</tbody></table></div>}
    </div> }];
  }
  const rows = []; for (let j = 0; j < items.length; j += 2) rows.push(items.slice(j, j + 2));
  return [head, ...rows.map((r, j) => ({ key: `${k}r${j}`, gap: j ? 14 : 16, el: <div className="dz-two">{r.map((it, x) => <Dish key={x} it={it} lead />)}</div> }))];
}
export function menuSpec(m) {
  const blocks = (m.secciones || []).flatMap(menuSecBlocks);
  const shell = (p, total, children) => <div className="dz" key={p}>
    <Frame />
    {p === 0 ? <header className="dz-mhead"><Scene /><div className="tt"><div className="dz-eyebrow">{m.eyebrow}</div><h1>{m.titulo} <em>{m.enfasis}</em></h1></div></header>
      : <header className="dz-mcont"><div className="dz-eyebrow">{m.eyebrow}</div><h1>{m.titulo} <em>{m.enfasis}</em></h1></header>}
    <div className="dz-fill" data-fit>{children}</div>
    <footer className="dz-foot dz-mfoot"><div className="line" /><p>{m.pie}{hoja(p, total)}</p></footer>
  </div>;
  return { shell, blocks };
}

/* ---------- Editor del menú (Cocina › Menú) ---------- */
function Items({ list = [], onChange, ph = ["Nombre", "Descripción"], label }) {
  const upd = (i, k, v) => onChange(list.map((x, j) => j === i ? { ...x, [k]: v } : x));
  return <div className="ed-grid">
    {list.map((it, i) => <div key={i} className="ed-item">
      <input className="ed-in" placeholder={ph[0]} aria-label={`${label} ${i + 1}: ${ph[0].toLowerCase()}`} value={it.n} onChange={e => upd(i, "n", e.target.value)} />
      <input className="ed-in" placeholder={ph[1]} aria-label={`${label} ${i + 1}: ${ph[1].toLowerCase()}`} value={it.d} onChange={e => upd(i, "d", e.target.value)} />
      <button type="button" className="ed-ib press" aria-label={`Quitar ${it.n || `${label} ${i + 1}`}`} onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon n="close" /></button>
    </div>)}
    <div><button type="button" className="ed-add" onClick={() => onChange([...list, { n: "", d: "" }])}><Icon n="plus" />Agregar</button></div>
  </div>;
}
function SecEditor({ s, i, total, set, move, del }) {
  const f = (k, ph, area) => { const Tag = area ? "textarea" : "input"; return <Tag className="ed-in" rows={area ? 2 : undefined} placeholder={ph} aria-label={ph} value={s[k] || ""} onChange={e => set({ [k]: e.target.value })} />; };
  const t = s.tabla || { filas: [] };
  const setT = patch => set({ tabla: { ...t, ...patch } });
  const updF = (j, patch) => setT({ filas: t.filas.map((x, k) => k === j ? { ...x, ...patch } : x) });
  return <div className="ed-sec">
    <div className="ed-h"><span className="grow">{ROMAN[i]}. {TIPOS[s.tipo]}</span>
      <button type="button" className="ed-ib press" disabled={i === 0} onClick={() => move(-1)} aria-label="Subir la sección"><Icon n="chevL" c="up" /></button>
      <button type="button" className="ed-ib press" disabled={i === total - 1} onClick={() => move(1)} aria-label="Bajar la sección"><Icon n="chev" c="down" /></button>
      <button type="button" className="ed-ib press" onClick={del} aria-label="Quitar la sección"><Icon n="close" /></button></div>
    <div className="ed-2">{f("titulo", "Título de la sección")}{f("nota", "Nota a la derecha (opcional)")}</div>
    {s.tipo === "elige" && <>
      <div className="ed-sub">Columna izquierda</div>{f("etiqueta", "Etiqueta, ej. Elige tu masa")}
      <div style={{ marginTop: 8 }}><Items label="Opción" list={s.items} onChange={v => set({ items: v })} /></div>
      <div className="ed-sub">Recuadro</div>{f("cajaEtiqueta", "Etiqueta del recuadro")}
      <div style={{ marginTop: 8 }}><Items label="Relleno" list={s.caja} onChange={v => set({ caja: v })} /></div>
    </>}
    {s.tipo === "platos" && <><div className="ed-sub">Platos</div><Items label="Plato" list={s.items} onChange={v => set({ items: v })} /></>}
    {s.tipo === "destacado" && <>
      <div className="ed-sub">Plato</div>
      <div className="ed-grid">{f("plato", "Nombre del plato")}{f("desc", "Descripción", true)}</div>
      <div className="ed-sub">Datos destacados (hasta 3)</div>
      <Items label="Dato" ph={["Ej. 5", "Ej. claras de huevo"]} list={(s.datos || []).map(x => ({ n: x.v, d: x.d }))} onChange={v => set({ datos: v.slice(0, 3).map(x => ({ v: x.n, d: x.d })) })} />
      <div className="ed-sub">Frase final</div>{f("extra", "Ej. Acompáñalo con aguacate fresco…")}
      <div className="ed-sub">Tabla (opcional)</div>
      <div className="ed-3"><input className="ed-in" aria-label="Título de la tabla" placeholder="Título de la tabla" value={t.etiqueta || ""} onChange={e => setT({ etiqueta: e.target.value })} />
        <input className="ed-in" aria-label="Columna 1" placeholder="Columna 1" value={t.c1 || ""} onChange={e => setT({ c1: e.target.value })} />
        <input className="ed-in" aria-label="Columna 2" placeholder="Columna 2" value={t.c2 || ""} onChange={e => setT({ c2: e.target.value })} /></div>
      <div className="ed-grid" style={{ marginTop: 8 }}>{(t.filas || []).map((r, j) => <div key={j} className="ed-item nut">
        <input className="ed-in" placeholder="Fila" aria-label={`Fila ${j + 1}`} value={r.n} onChange={e => updF(j, { n: e.target.value })} />
        <input className="ed-in" placeholder={t.c1} aria-label={`Fila ${j + 1}: ${t.c1}`} value={r.a} onChange={e => updF(j, { a: e.target.value })} />
        <input className="ed-in" placeholder={t.c2} aria-label={`Fila ${j + 1}: ${t.c2}`} value={r.b} onChange={e => updF(j, { b: e.target.value })} />
        <label className="ed-mark"><input type="checkbox" checked={!!r.marca} onChange={e => updF(j, { marca: e.target.checked })} />Resaltar</label>
        <button type="button" className="ed-ib press" aria-label={`Quitar la fila ${j + 1}`} onClick={() => setT({ filas: t.filas.filter((_, k) => k !== j) })}><Icon n="close" /></button>
      </div>)}<div><button type="button" className="ed-add" onClick={() => setT({ filas: [...(t.filas || []), { n: "", a: "", b: "" }] })}><Icon n="plus" />Agregar fila</button></div></div>
    </>}
  </div>;
}

const LOCAL = "mc-carta";
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)); } catch { return null; } };
const writeLocal = v => { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const clone = o => JSON.parse(JSON.stringify(o));

export function MenuStudio() {
  useDocFonts();
  const { S, role, act, toast } = useMC();
  const edit = can(role, "compras");
  const online = Array.isArray(S.cartas);
  const list = online ? S.cartas : [];
  const first = () => list[0] ? { id: list[0].id, name: list[0].name, data: list[0].data } : (readLocal() || { id: null, name: "Desayunos", data: clone(MENU_DESAYUNOS) });
  const [c, setC] = useState(first);
  const [sure, setSure] = useState(false);
  const holder = useRef(); const timer = useRef(); const chain = useRef(Promise.resolve()); const idRef = useRef(c.id);
  const m = c.data;
  const P = usePaged(menuSpec(m));

  // Guarda solo, un momento después de dejar de escribir. Los guardados van en fila para no duplicar.
  const save = next => {
    if (!edit) return;
    if (!online) { writeLocal(next); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      chain.current = chain.current.then(() => act(async a => {
        const id = await a.guardarCarta({ id: idRef.current, name: next.name, data: next.data });
        if (!idRef.current) { idRef.current = id; setC(x => ({ ...x, id })); }
      }, null, { quiet: true }));
    }, 800);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = fn => setC(x => { const next = fn(x); save(next); return next; });
  const setM = patch => change(x => ({ ...x, data: { ...x.data, ...patch } }));
  const secs = m.secciones || [];
  const setSec = (i, patch) => setM({ secciones: secs.map((s, j) => j === i ? { ...s, ...patch } : s) });
  const move = (i, d) => { const a = secs.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; setM({ secciones: a }); };
  const open = x => { clearTimeout(timer.current); idRef.current = x.id; setC({ id: x.id, name: x.name, data: clone(x.data) }); setSure(false); };
  const create = (name, data) => { clearTimeout(timer.current); idRef.current = null; const next = { id: null, name, data }; setC(next); save(next); toast("Menú nuevo. Se guarda solo"); };
  const remove = () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 3500); return; }
    const id = c.id; const rest = list.filter(x => x.id !== id);
    if (id) act(a => a.borrarCarta(id), "Menú borrado");
    rest[0] ? open(rest[0]) : (idRef.current = null, setC({ id: null, name: "Desayunos", data: clone(MENU_DESAYUNOS) }));
  };
  const download = () => printDoc(holder.current, `Maracuyá — ${[m.titulo, m.enfasis].filter(Boolean).join(" ")}`.trim());

  return <div className="studio">
    <div>
      {!online && <div className="note" style={{ marginTop: 0 }}><Icon n="alert" c="s" w="f" /><span>Los menús todavía no se guardan para todo el equipo: falta correr la migración <b>0013</b> en Supabase. Mientras tanto se guardan en este dispositivo.</span></div>}
      {online && <section className="sec" style={{ marginTop: online ? 0 : 14 }}><div className="sec-h">Menús guardados</div>
        <div className="ed-pick">{list.map(x => <button key={x.id} type="button" className="chip press" aria-pressed={x.id === c.id} onClick={() => open(x)}>{x.name}</button>)}
          {!c.id && <button type="button" className="chip press" aria-pressed="true">{c.name} · sin guardar</button>}
          {edit && <button type="button" className="chip press" onClick={() => create(`${c.name} (copia)`, clone(m))}><Icon n="copy" c="xs" />Duplicar</button>}
          {edit && <button type="button" className="chip press" onClick={() => create("Menú nuevo", { ...clone(MENU_DESAYUNOS), enfasis: "", secciones: [NUEVA.platos()] })}><Icon n="plus" c="xs" />Nuevo</button>}</div>
        <p className="sec-f">Cada menú se guarda solo. Para rotarlos, abre el que toque y descárgalo.</p></section>}
      <fieldset disabled={!edit} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <section className="sec"><div className="sec-h">Encabezado</div><div className="ed-sec">
          <div className="ed-grid">
            {online && <input className="ed-in" aria-label="Nombre del menú (solo para el equipo)" placeholder="Nombre para el equipo, ej. Desayunos · semana 2" value={c.name} onChange={e => change(x => ({ ...x, name: e.target.value }))} />}
            <input className="ed-in" aria-label="Línea superior" placeholder="Línea superior, ej. Especialidades culinarias" value={m.eyebrow || ""} onChange={e => setM({ eyebrow: e.target.value })} />
            <div className="ed-2"><input className="ed-in" aria-label="Título" placeholder="Título, ej. Menú de" value={m.titulo || ""} onChange={e => setM({ titulo: e.target.value })} />
              <input className="ed-in" aria-label="Título en cursiva verde" placeholder="En cursiva, ej. desayunos" value={m.enfasis || ""} onChange={e => setM({ enfasis: e.target.value })} /></div>
            <input className="ed-in" aria-label="Pie de página" placeholder="Pie de página" value={m.pie || ""} onChange={e => setM({ pie: e.target.value })} />
          </div></div></section>
        <section className="sec"><div className="sec-h">Secciones</div>
          {secs.map((s, i) => <SecEditor key={i} s={s} i={i} total={secs.length} set={p => setSec(i, p)} move={d => move(i, d)} del={() => setM({ secciones: secs.filter((_, j) => j !== i) })} />)}
          {edit && <div className="ed-pick">{Object.entries(TIPOS).map(([k, l]) => <button key={k} type="button" className="chip press" onClick={() => setM({ secciones: [...secs, NUEVA[k]()] })}><Icon n="plus" c="xs" />{l}</button>)}</div>}
          <p className="sec-f">Escribe «&» en un título y sale en cursiva, como en «Saludable & proteica».</p>
        </section>
        {edit && <section className="sec"><div className="group">
          <button type="button" className="row press" onClick={() => { if (confirm("¿Volver al menú de desayunos original? Se pierde lo que cambiaste en este menú.")) change(x => ({ ...x, data: clone(MENU_DESAYUNOS) })); }}><span className="grow"><span className="t">Volver a la plantilla de desayunos</span></span></button>
          {online && <button type="button" className="row press" onClick={remove}><span className="grow"><span className="t" style={{ color: "var(--danger)" }}>{sure ? "Toca otra vez para borrar este menú" : "Borrar este menú"}</span></span></button>}
        </div></section>}
      </fieldset>
    </div>
    <div className="prev-col">
      <div className="sec-h" style={{ marginTop: 6 }}>Así queda</div>
      <Sheets P={P} holder={holder} overMsg="Una sección es más larga que una hoja: divídela en dos secciones." />
      <div className="btns"><button type="button" className="btn press" onClick={download}><Icon n="receipt" w="f" />Descargar PDF</button></div>
      <p className="sec-f">En el teléfono: Descargar › Compartir › Guardar en Archivos o enviarlo por WhatsApp.</p>
    </div>
  </div>;
}
