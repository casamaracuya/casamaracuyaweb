// Recorrido de bienvenida: aparece la primera vez que alguien entra y siempre se puede abrir
// desde Perfil › «Cómo funciona el panel». Se adapta al rol con el que se está trabajando.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { ROLES, VIEWS, STATE } from "./util.js";

const KEY = "mc-tour-1:";
export const tourSeen = uid => { try { return !!localStorage.getItem(KEY + uid); } catch { return true; } };
const markSeen = uid => { try { localStorage.setItem(KEY + uid, "1"); } catch { /* sin almacenamiento */ } };

const VIEW_DESC = {
  hoy: "Lo que pasa hoy y lo que necesita tu atención.",
  reservas: "Solicitudes y reservas, ordenadas por estado.",
  calendario: "Qué noches están ocupadas, apartadas o bloqueadas.",
  huespedes: "Fichas con alergias, gustos, familia y cumpleaños.",
  tareas: "Lo pendiente de tu área: tómalas y márcalas.",
  cocina: "El menú de cada estadía y la lista de compras.",
  casa: "Habitaciones, piscina, jardín y muelle.",
  pagos: "Pagos recibidos y lo que entró cada mes.",
  tarifas: "Precios por temporada y promociones.",
  reportes: "Gráficos de ingresos, temporadas y días.",
  equipo: "Quién entra al panel y con qué rol.",
  mas: "El resto de secciones y tu perfil."
};

const STEPS = [
  ["nueva", "Llega de la web, o la anotas con «Nueva reserva»."],
  ["conversacion", "Le respondiste por WhatsApp."],
  ["pre", "Fechas apartadas 24 h. Sin anticipo, se liberan solas."],
  ["confirmada", "Llegó el anticipo: se reparten las tareas del equipo."],
  ["casa", "Tocas «Ya llegaron» al recibirlos."],
  ["finalizada", "Cierras la cuenta y se crean las tareas de salida."]
];

const WORK = {
  cocina: [["Se confirma una reserva", "«Menú para…» te llega 7 días antes de la llegada, con plan, alergias y gustos."],
           ["Mientras están en casa", "Anota en su ficha lo que más le gustó. La próxima vez ya lo sabremos."],
           ["Siempre", "La lista de compras está en Cocina: marca lo que ya compraste."]],
  limpieza: [["Se confirma una reserva", "«Preparar la casa y la bienvenida» te llega el día antes de la llegada."],
             ["Mientras limpias", "En La casa, toca una habitación para pasarla de sucia a en limpieza, lista y revisada."],
             ["Cuando se van", "Te llega «Limpieza de salida y lavandería» ese mismo día."]],
  mantenimiento: [["Se confirma una reserva", "«Piscina y jardín listos» te llega el día antes de la llegada."],
                  ["Si algo se daña", "Repórtalo en Tareas con el botón + y una foto. Queda guardado para todos."],
                  ["Si algo no está listo", "En La casa puedes bloquear fechas para que nadie reserve esas noches."]]
};

function slides(role, R, name) {
  const first = (name || "").split(" ")[0];
  const moves = ["direccion", "recepcion", "admin"].includes(role);
  const list = [
    { id: "hola", title: <>Hola{first ? <>, <em>{first}</em></> : null}.</>,
      text: <>Esto es <b>Maracuyá Control</b>, donde trabaja toda la casa. Entras como <b>{R.name}</b>: {R.ve.charAt(0).toLowerCase() + R.ve.slice(1)}</>,
      art: <div className="tv-hola"><span className="tv-badge" style={{ background: `var(--r-${role})`, color: `var(--r-${role}-ink)` }}><Icon n={R.icon} c="xl" w="d" /></span>
        {Object.keys(ROLES).filter(k => k !== role).slice(0, 5).map((k, i) => <span key={k} className={`tv-orb o${i}`} style={{ background: `var(--r-${k})`, color: `var(--r-${k}-ink)` }}><Icon n={ROLES[k].icon} c="s" w="d" /></span>)}</div> },
    { id: "menu", title: <>Tu <em>menú</em>.</>, text: "Abajo en el teléfono, o a la izquierda en la computadora. Solo ves lo que te toca.",
      art: <ul className="tv-menu">{[...R.tabs.filter(t => t !== "mas"), ...R.more].slice(0, 6).map(t =>
        <li key={t}><span className="ic"><Icon n={t} c="s" w="f" /></span><span><b>{VIEWS[t]}</b><small>{VIEW_DESC[t]}</small></span></li>)}</ul> }
  ];
  if (moves) list.push({ id: "flujo", title: <>El camino de una <em>reserva</em>.</>,
    text: "La casa se alquila completa: el sistema nunca deja que dos reservas compartan noches.",
    art: <ol className="tv-flow">{STEPS.map(([s, t], i) => <li key={s} style={{ "--i": i }}><span className="pill-s" style={{ background: `var(--s-${s}-bg)`, color: `var(--s-${s}-ink)` }}>{STATE[s]}</span><span className="tx">{t}</span></li>)}</ol> });
  if (WORK[role]) list.push({ id: "trabajo", title: <>El trabajo te <em>llega solo</em>.</>,
    text: "Cuando se confirma una reserva, tus tareas aparecen con su fecha. Toca «Tomar» para quedártela, ponla en proceso y márcala al terminar.",
    art: <ul className="tv-work">{WORK[role].map(([k, t], i) => <li key={k} style={{ "--i": i }}><b>{k}</b><span>{t}</span></li>)}</ul> });
  list.push({ id: "tuyo", title: <>Lo que haces <em>tú</em>.</>, text: "Todo lo que anotas queda guardado y el resto del equipo lo ve al momento, sin recargar.",
    art: <ul className="tv-do">{R.hace.map((h, i) => <li key={h} style={{ "--i": i }}><span className="ck"><Icon n="check" c="xs" w="b" /></span>{h}</li>)}</ul> });
  list.push({ id: "mano", title: <>Siempre a <em>la mano</em>.</>,
    text: <>Empieza cada día en <b>Hoy</b>.{moves ? <> El botón <b>Nueva reserva</b> está en todas las pantallas.</> : null} Para ver este recorrido otra vez, toca tu perfil y elige <b>Cómo funciona el panel</b>.</>,
    art: <div className="tv-mano">
      {moves ? <span className="tv-fab"><Icon n="plus" c="s" w="b" />Nueva reserva</span> : <span className="tv-fab tv-hoy"><Icon n="hoy" c="s" w="f" />Hoy</span>}
      <span className="tv-avatar" style={{ background: `var(--r-${role})`, color: `var(--r-${role}-ink)` }}><Icon n={R.icon} c="l" w="d" /></span>
      <span className="tv-tip">Perfil › Cómo funciona el panel</span></div> });
  return list;
}

export function Tour({ uid, role, name, onClose }) {
  const R = ROLES[role];
  const S = slides(role, R, name);
  const [i, setI] = useState(0); const [dir, setDir] = useState(1);
  const ref = useRef(null); const x0 = useRef(null);
  const last = i === S.length - 1;
  const go = n => { if (n < 0 || n >= S.length) return; setDir(n > i ? 1 : -1); setI(n); };
  const close = () => { markSeen(uid); onClose(); };
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const f = e => { if (e.key === "ArrowRight") go(i + 1); else if (e.key === "ArrowLeft") go(i - 1); else if (e.key === "Escape") close(); };
    document.addEventListener("keydown", f); return () => document.removeEventListener("keydown", f);
  });
  const s = S[i];
  return <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tourT" tabIndex={-1} ref={ref}
    onPointerDown={e => { x0.current = e.clientX; }} onPointerUp={e => { if (x0.current == null) return; const d = e.clientX - x0.current; x0.current = null; if (Math.abs(d) > 60) go(i + (d < 0 ? 1 : -1)); }}>
    <div className="tour-top">
      <div className="tour-dots" role="tablist" aria-label="Pasos del recorrido">{S.map((x, k) =>
        <button key={x.id} role="tab" aria-selected={k === i} aria-label={`Paso ${k + 1} de ${S.length}`} className={k === i ? "on" : k < i ? "done" : ""} onClick={() => go(k)} />)}</div>
      {!last && <button className="tour-skip" onClick={close}>Saltar</button>}
    </div>
    <div className={`tour-slide ${dir > 0 ? "fwd" : "back"}`} key={s.id}>
      <div className="tour-art">{s.art}</div>
      <div className="tour-copy">
        <h2 id="tourT">{s.title}</h2>
        <p>{s.text}</p>
      </div>
    </div>
    <div className="tour-nav">
      {i > 0 ? <button className="tour-prev press" onClick={() => go(i - 1)} aria-label="Anterior"><Icon n="chevL" c="s" /></button> : <span />}
      <button className="tour-next press" onClick={() => last ? close() : go(i + 1)}>{last ? "Empezar" : "Siguiente"}{!last && <Icon n="chev" c="s" />}</button>
    </div>
  </div>;
}
