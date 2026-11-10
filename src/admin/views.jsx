import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MenuStudio } from "./docs.jsx";
import { useMC, Icon, Pill, Empty, Head, ResRow, TaskRow, Seg, Chips, Switch, myTasks } from "./ui.jsx";
import { T0, TODAY, MES, MESL, DIAL, ROLES, VIEWS, AREAS, AREAS_NUEVAS, AREA_C, AMBITOS, can, FLOW, STATE, HOLDS, PLAN, ROOM_ST, ROOM_LB, SEASONS, SEASON_DESC, RATE_KIND, SOLD, season, nightsList, nextBirthday, birthdaysIn, fdate,
  parse, isoOf, addDays, diff, frange, rel, money, ago, left, nights, monthStats, initials } from "./util.js";

const L = ({ to, children, className }) => <Link className={className} to={`/admin/${to}`}>{children}</Link>;

/* ---------- HOY ---------- */
export function Hoy() {
  const { S, role, R, openSheet } = useMC();
  const h = new Date().getHours(); const hi = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const d = new Date();
  const act = S.reservas;
  const enCasa = act.find(r => r.state === "casa");
  const nextIn = act.filter(r => ["confirmada","pre"].includes(r.state) && r.in >= TODAY).sort((a, b) => a.in < b.in ? -1 : 1)[0];
  const nuevas = act.filter(r => r.state === "nueva"), pres = act.filter(r => r.state === "pre");
  const mt = myTasks(S, role).filter(t => t.due <= TODAY); const pend = mt.filter(t => !t.done).length;
  const m = monthStats(S, T0.getFullYear(), T0.getMonth());
  const G = id => S.guests[id] || {};
  const st = (n, l, to) => <L className="stat press" to={to}><b>{n}</b><span>{l}</span></L>;
  let stats = null;
  if (role === "direccion") stats = <>{st(<>{m.occ}<small>%</small></>, `ocupación de ${MESL[T0.getMonth()]}`, "reportes")}{st(money(m.cash), "cobrado este mes", "pagos")}{st(nuevas.length, nuevas.length === 1 ? "solicitud nueva" : "solicitudes nuevas", "reservas")}</>;
  if (role === "recepcion") stats = <>{st(nuevas.length, "sin responder", "reservas")}{st(pres.length, "esperan anticipo", "reservas")}{st(act.filter(r => r.state === "casa" && r.out === TODAY).length, "salen hoy", "reservas")}</>;
  if (role === "admin") { const yr = S.payments.filter(p => p.date.startsWith(String(T0.getFullYear()))).reduce((s, p) => s + p.amount, 0); stats = <>{st(money(m.cash), "cobrado este mes", "pagos")}{st(money(yr), `ingresos de ${T0.getFullYear()}`, "reportes")}{st(pres.length, "esperan anticipo", "pagos")}</>; }
  if (role === "cocina") { const al = act.filter(r => HOLDS.includes(r.state) && r.out >= TODAY).flatMap(r => G(r.g).allergies || []); stats = <>{st(enCasa ? enCasa.people : 0, "personas en casa", "cocina")}{st(al.length, al.length === 1 ? "alergia a cuidar" : "alergias a cuidar", "cocina")}{st(S.shopping.filter(s => !s.done).length, "cosas por comprar", "cocina")}</>; }
  if (role === "limpieza") { const ready = S.rooms.filter(x => ["lista","revisada"].includes(x.state)).length; stats = <>{st(<>{ready}<small>/{S.rooms.length}</small></>, "espacios listos", "casa")}{st(S.rooms.length - ready, "por limpiar", "casa")}{st(pend, "tareas de hoy", "tareas")}</>; }
  if (role === "operaciones") { const hoyLlegan = act.filter(r => ["confirmada","casa"].includes(r.state) && r.in === TODAY).length; stats = <>{st(hoyLlegan, hoyLlegan === 1 ? "grupo llega hoy" : "grupos llegan hoy", "calendario")}{st(S.tasks.filter(t => !t.done && t.due <= TODAY).length, "tareas del equipo hoy", "tareas")}{st(S.shopping.filter(s => !s.done).length, "cosas por comprar", "cocina")}</>; }
  if (role === "servicio") { const ready = S.rooms.filter(x => ["lista","revisada"].includes(x.state)).length; stats = <>{st(enCasa ? enCasa.people : 0, "personas en casa", "huespedes")}{st(<>{ready}<small>/{S.rooms.length}</small></>, "espacios listos", "casa")}{st(pend, "tareas de hoy", "tareas")}</>; }
  if (role === "calidad") { const rojos = (S.audits || []).filter(a => a.level === "rojo").length; stats = <>{st(S.rooms.filter(x => x.state === "revisada").length, "espacios revisados", "casa")}{st(S.tasks.filter(t => !t.done && t.due < TODAY).length, "tareas atrasadas", "tareas")}{st(rojos, rojos === 1 ? "semáforo en rojo" : "semáforos en rojo", "tareas")}</>; }
  if (role === "mantenimiento") stats = <>{st(S.tasks.filter(t => t.area === "mantenimiento" && !t.done).length, "tareas abiertas", "tareas")}{st(S.tasks.filter(t => t.area === "mantenimiento" && t.damage && !t.done).length, "daños reportados", "tareas")}{st(S.blocks.length, "fechas bloqueadas", "casa")}</>;

  let feature = null;
  if (role === "admin") {
    if (pres.length) feature = <section className="sec"><div className="sec-h"><h2>Esperan anticipo</h2><L to="pagos">Ver ingresos</L></div><div className="group res">{pres.slice(0, 3).map(r => <ResRow key={r.id} r={r} extra={r.hold ? <span className="st" style={{ color: "var(--ink)", fontWeight: 800 }}>Vence en {left(r.hold)}</span> : null} />)}</div></section>;
  } else {
    const r = (role === "cocina" && enCasa) ? enCasa : nextIn;
    if (r) { const g = G(r.g);
      feature = <section className="sec"><button className="card feature press" onClick={() => openSheet("res", { id: r.id })}>
        <span className="ph"><img src={r.state === "casa" ? "/fotos/sala-frente-al-mar.webp" : "/fotos/hab-maracuya.webp"} alt="" /><span className="over"><span className="pill light"><Icon n="door" c="xs" w="f" /> {r.state === "casa" ? "En casa ahora" : `Llegan ${rel(r.in)}`}</span></span></span>
        <span className="fb"><span className="lbl">{r.state === "casa" ? "Ahora en la casa" : "Próxima llegada"}</span><h3>{g.name}</h3>
          <span className="meta"><span><Icon n="calendario" c="s" />{frange(r.in, r.out)}</span><span><Icon n="huespedes" c="s" />{r.people} personas</span><span><Icon n="cocina" c="s" />{PLAN[r.plan].short}</span>{r.pet && <span><Icon n="paw" c="s" />Mascota</span>}</span>
          <span className="tags">{(g.allergies || []).map(a => <span key={a} className="tag warn"><Icon n="alert" c="xs" w="f" />{a}</span>)}{g.celebra && <span className="tag gold"><Icon n="gift" c="xs" w="f" />{g.celebra}</span>}{g.kite && <span className="tag"><Icon n="wind" c="xs" />Kite</span>}{(g.likes || []).slice(0, 2).map(x => <span key={x} className="tag">{x}</span>)}</span>
        </span></button></section>;
    }
  }

  const al = []; const see = x => x.includes(role);
  const res = id => () => openSheet("res", { id });
  if (see(["direccion","recepcion"])) nuevas.forEach(r => al.push({ i: "chat", c: "var(--s-nueva-bg)", k: "var(--s-nueva-ink)", t: `${G(r.g).name} pidió fechas`, s: `${frange(r.in, r.out)} · ${r.people} pers. · ${ago(r.created)}`, on: res(r.id) }));
  if (see(["direccion","recepcion","admin"])) pres.forEach(r => al.push({ i: "clock", c: "var(--s-pre-bg)", k: "var(--s-pre-ink)", t: `${G(r.g).name}: el anticipo vence en ${left(r.hold)}`, s: "Si no paga, las fechas se liberan solas", on: res(r.id) }));
  // Semáforo en rojo: aviso inmediato a la CEO (y a Calidad, que lo registró).
  if (see(["direccion","calidad"])) (S.audits || []).filter(a => a.level === "rojo").forEach(a => { const r = act.find(x => x.id === a.res); if (r && r.out >= addDays(TODAY, -7))
    al.push({ i: "alert", c: "var(--danger-bg)", k: "var(--danger)", t: `Semáforo en rojo: ${AMBITOS[a.area]?.name || a.area}`, s: `${G(r.g).name}${a.note ? ` · ${a.note}` : ""}`, on: res(r.id) }); });
  if (see(["operaciones","servicio","calidad"])) act.filter(r => ["confirmada","casa"].includes(r.state) && r.in === TODAY).forEach(r => al.push({ i: "door", c: "var(--s-confirmada-bg)", k: "var(--s-confirmada-ink)", t: `Hoy llega ${G(r.g).name}`, s: `${r.people} personas${r.ficha?.arrival ? ` · llegada estimada ${r.ficha.arrival}` : " · check-in desde las 3:00 PM"}`, on: res(r.id) }));
  if (see(["direccion","recepcion","admin","limpieza","operaciones","calidad"])) act.filter(r => r.state === "casa" && r.out === TODAY).forEach(r => al.push({ i: "out", c: "var(--s-casa-bg)", k: "var(--s-casa-ink)", t: `Hoy sale ${G(r.g).name}`, s: "Cerrar la cuenta y revisar la casa", on: res(r.id) }));
  if (see(["cocina"])) act.filter(r => ["confirmada","pre"].includes(r.state) && diff(TODAY, r.in) >= 0 && diff(TODAY, r.in) <= 7).forEach(r => { const g = G(r.g); al.push({ i: "chef", c: "var(--r-cocina)", k: "var(--r-cocina-ink)", t: `Ficha de cocina: ${g.name}`, s: `Llegan ${rel(r.in)} · ${r.people} pers.${(g.allergies || [])[0] ? " · Alergia: " + g.allergies[0] : ""}`, to: "cocina" }); });
  if (see(["mantenimiento","direccion","operaciones"])) S.tasks.filter(t => t.damage && !t.done).forEach(t => al.push({ i: "camera", c: "var(--danger-bg)", k: "var(--danger)", t: `Daño: ${t.title}`, s: `Reportado ${rel(t.due)}`, to: "tareas" }));
  // Cumpleaños: de los huéspedes y sus acompañantes en los próximos 14 días, o durante una estadía próxima.
  if (see(["direccion","recepcion","cocina","servicio","calidad"])) {
    const seen = new Set();
    act.filter(r => HOLDS.includes(r.state) && r.out >= TODAY).forEach(r => { const g = G(r.g); const bd = birthdaysIn(g, r.in, r.out);
      if (bd.length) { seen.add(r.g); al.push({ i: "gift", c: "var(--sol)", k: "var(--alga)", t: `Cumpleaños durante la estadía: ${bd.join(", ")}`, s: `${g.name} · ${frange(r.in, r.out)}`, on: res(r.id) }); } });
    Object.entries(S.guests).forEach(([id, g]) => { if (seen.has(id)) return;
      [{ n: g.name, b: g.birthday }, ...(g.companions || []).map(c => ({ n: `${c.name} (de ${g.name.split(" ")[0]})`, b: c.birthday }))].forEach(p => { const nb = p.b && nextBirthday(p.b);
        if (nb && nb.days <= 14) al.push({ i: "gift", c: "var(--sol)", k: "var(--alga)", t: `Cumpleaños de ${p.n} ${nb.label}`, s: "Un mensaje por WhatsApp les hace sentir en casa", on: () => openSheet("guest", { id }) }); }); });
  }
  // Tareas sin dueño en tu área.
  if (!["direccion","recepcion"].includes(role)) { const free = S.tasks.filter(t => t.area === role && !t.done && !t.who && t.due <= TODAY).length;
    if (free) al.push({ i: "tareas", c: "var(--arena)", k: "var(--alga)", t: `${free} ${free === 1 ? "tarea sin asignar" : "tareas sin asignar"} en tu área`, s: "Tómala para que el equipo sepa que la tienes", to: "tareas" }); }
  if (see(["limpieza"])) S.rooms.filter(x => x.state === "sucia").forEach(x => al.push({ i: "broom", c: "var(--r-limpieza)", k: "var(--r-limpieza-ink)", t: `${x.name} está sucia`, s: "Tócala en La casa cuando empieces", to: "casa" }));
  const AlertRow = ({ a }) => { const inner = <><span className="ico" style={{ background: a.c, color: a.k }}><Icon n={a.i} c="s" w="f" /></span><span className="grow"><span className="t" style={{ whiteSpace: "normal" }}>{a.t}</span><span className="st">{a.s}</span></span><Icon n="chev" c="s chev" /></>;
    return a.to ? <L className="row press" to={a.to}>{inner}</L> : <button className="row press" onClick={a.on}>{inner}</button>; };

  return <>
    <Head eyebrow={<>{DIAL[d.getDay()]} {d.getDate()} de {MESL[d.getMonth()]}</>} title={<>{hi},<br /><em>{R.name.toLowerCase()}</em></>}><div className="stats">{stats}</div></Head>
    {feature}
    {al.length > 0 && <section className="sec"><div className="sec-h"><h2>Necesita atención</h2></div><div className="group inset-ico">{al.map((a, i) => <AlertRow key={i} a={a} />)}</div></section>}
    {mt.length > 0 && <section className="sec"><div className="sec-h"><h2>Tus tareas de hoy</h2><L to="tareas">Ver todas</L></div><div className="group">{mt.slice().sort((a, b) => a.done - b.done).slice(0, 6).map(t => <TaskRow key={t.id} t={t} />)}</div><p className="sec-f">{pend ? `Te ${pend === 1 ? "queda" : "quedan"} ${pend}. Toca el círculo cuando termines.` : "Terminaste todo por hoy."}</p></section>}
  </>;
}

/* ---------- RESERVAS ---------- */
const F = { activas: ["nueva","conversacion","pre","confirmada","casa"], nueva: ["nueva"], conversacion: ["conversacion"], pre: ["pre"], confirmada: ["confirmada"], casa: ["casa"], cerradas: ["finalizada","rechazada","vencida","cancelada"] };
const FL = { activas: "Activas", nueva: "Nuevas", conversacion: "En conversación", pre: "Pre-reservadas", confirmada: "Confirmadas", casa: "En casa", cerradas: "Cerradas" };
export function Reservas() {
  const { S } = useMC();
  const [f, setF] = useState("activas");
  const cnt = k => S.reservas.filter(r => F[k].includes(r.state)).length;
  const list = S.reservas.filter(r => F[f].includes(r.state)).sort((a, b) => f === "cerradas" ? (a.in < b.in ? 1 : -1) : (FLOW.indexOf(a.state) - FLOW.indexOf(b.state) || (a.in < b.in ? -1 : 1)));
  return <>
    <Head title="Reservas" lead="Toca una reserva para verla y moverla al siguiente paso. Un WhatsApp nunca es una reserva confirmada hasta que entra el anticipo." />
    <Chips value={f} onChange={setF} label="Filtrar por estado" options={Object.keys(F).map(k => [k, <>{FL[k]} <span className="n">{cnt(k)}</span></>])} />
    {f === "activas"
      ? F.activas.map(s => { const rs = list.filter(r => r.state === s); return rs.length ? <section className="sec" key={s}><div className="sec-h">{STATE[s]}</div><div className="group res">{rs.map(r => <ResRow key={r.id} r={r} />)}</div></section> : null; })
      : <section className="sec"><div className="group res">{list.length ? list.map(r => <ResRow key={r.id} r={r} />) : <Empty icon="reservas">No hay reservas en este estado.</Empty>}</div></section>}
  </>;
}

/* ---------- CALENDARIO ---------- */
export function Calendario() {
  const { S, openSheet, toast, canMove } = useMC();
  const [[y, mo], setM] = useState([T0.getFullYear(), T0.getMonth()]);
  const nav = n => { const x = new Date(y, mo + n, 1); setM([x.getFullYear(), x.getMonth()]); };
  const first = new Date(y, mo, 1); const start = (first.getDay() + 6) % 7; const days = new Date(y, mo + 1, 0).getDate();
  const cells = []; for (let i = 0; i < 42; i++) { const d = new Date(y, mo, 1 - start + i); cells.push(d); if (i >= 34 && i % 7 === 6 && d.getMonth() !== mo) break; }
  const active = S.reservas.filter(r => FLOW.includes(r.state));
  const G = id => S.guests[id] || {};
  const tap = s => { const r = active.find(x => x.in <= s && s < x.out); if (r) return openSheet("res", { id: r.id }); const b = S.blocks.find(x => x.from <= s && s < x.to); if (b) return toast(`Bloqueada: ${b.reason}`); if (canMove && s >= TODAY) return openSheet("newRes", { date: s }); toast("Libre"); };
  const inMonth = active.filter(r => r.out > `${y}-${String(mo + 1).padStart(2, "0")}-01` && r.in <= `${y}-${String(mo + 1).padStart(2, "0")}-${days}`).sort((a, b) => a.in < b.in ? -1 : 1);
  return <>
    <Head title="Calendario" lead="La casa se alquila completa: cada franja es un grupo. Toca un día libre para anotar una reserva." />
    <div className="cal card">
      <div className="cal-h"><h2>{MESL[mo]} {y}</h2><div><button className="icon-btn press" onClick={() => nav(-1)} aria-label="Mes anterior"><Icon n="chevL" c="s" /></button><button className="icon-btn press" onClick={() => nav(1)} aria-label="Mes siguiente"><Icon n="chev" c="s" /></button></div></div>
      <div className="cal-grid">
        {["lun","mar","mié","jue","vie","sáb","dom"].map(x => <div key={x} className="cal-dow">{x}</div>)}
        {cells.map((d, i) => { const s = isoOf(d); const r = active.find(x => x.in <= s && s < x.out); const b = S.blocks.find(x => x.from <= s && s < x.to);
          let band = null;
          if (r) { const st = s === r.in || i % 7 === 0; band = <span className={`bnd st-${r.state} ${s === r.in ? "start" : ""} ${addDays(s, 1) === r.out ? "end" : ""}`} style={{ background: `var(--s-${r.state})` }}>{st ? (G(r.g).name || "").split(" ")[0] : " "}</span>; }
          else if (b) band = <span className={`bnd block ${s === b.from ? "start" : ""} ${addDays(s, 1) === b.to ? "end" : ""}`}>{s === b.from || i % 7 === 0 ? "Bloqueo" : " "}</span>;
          return <button key={s} className={`cday ${d.getMonth() !== mo ? "out" : ""} ${s === TODAY ? "today" : ""}`} onClick={() => tap(s)} aria-label={`${d.getDate()} de ${MESL[d.getMonth()]}${r ? `, ${G(r.g).name}, ${STATE[r.state]}` : b ? ", bloqueado" : ", libre"}`}><span className="dn">{d.getDate()}</span>{band}</button>; })}
      </div>
      <div className="legend">{["pre","confirmada","casa","finalizada"].map(s => <span key={s}><i className="dot" style={{ background: `var(--s-${s})` }} />{STATE[s]}</span>)}<span><i className="dot" style={{ background: "repeating-linear-gradient(135deg,var(--ink3) 0 2px,transparent 2px 4px)" }} />Bloqueada</span></div>
    </div>
    <section className="sec"><div className="sec-h">En {MESL[mo]}</div><div className="group res">{inMonth.length ? inMonth.map(r => <ResRow key={r.id} r={r} />) : <Empty icon="calendario">Este mes todavía está libre.</Empty>}</div></section>
  </>;
}

/* ---------- HUÉSPEDES ---------- */
export function Huespedes() {
  const { S, role, openSheet } = useMC();
  const [q, setQ] = useState("");
  const list = Object.entries(S.guests).filter(([, g]) => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()) || (g.city || "").toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return <>
    <Head title="Huéspedes" lead={role === "cocina" ? "Alergias y gustos de cada huésped. Anota lo que más les gustó para la próxima vez." : "La ficha de cada persona: lo que le gusta, sus alergias y cuántas veces ha venido."} />
    <label className="search"><Icon n="search" c="s" /><span className="sr">Buscar huésped</span><input className="field-in" style={{ textAlign: "left", color: "var(--ink)" }} placeholder="Buscar por nombre o ciudad" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" /></label>
    <section className="sec"><div className="group inset-av">{list.length ? list.map(([id, g]) =>
      <button key={id} className="row press" onClick={() => openSheet("guest", { id })}>
        <span className="avatar m" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>{initials(g.name)}</span>
        <span className="grow"><span className="t">{g.name}</span><span className="st">{g.city}{g.visits > 1 ? ` · ${g.visits} visitas` : ""}</span></span>
        <span className="tags" style={{ justifyContent: "flex-end" }}>{g.birthday && nextBirthday(g.birthday).days <= 14 && <span className="tag gold"><Icon n="gift" c="xs" w="f" />Cumple</span>}{g.visits > 1 && <span className="tag good"><Icon n="heart" c="xs" w="f" />Vuelve</span>}{(g.allergies || []).length > 0 && <span className="tag warn">Alergia</span>}</span>
        <Icon n="chev" c="s chev" />
      </button>) : <Empty icon="search">{q.trim() ? "No encontramos a nadie con ese nombre." : "Todavía no hay huéspedes. Aparecen solos con cada solicitud."}</Empty>}</div></section>
    {can(role, "datosHuesped") && <div className="btns"><button className="btn plain press" onClick={() => openSheet("newGuest")}><Icon n="plus" />Agregar un huésped</button></div>}
  </>;
}

/* ---------- TAREAS ---------- */
export function Tareas() {
  const { S, role, me, openSheet } = useMC();
  const [seg, setSeg] = useState("hoy"); const [area, setArea] = useState("todas"); const [who, setWho] = useState("todas");
  const whoF = { todas: () => true, mias: t => me && t.who === me.id, libres: t => !t.who && !t.done };
  const all = myTasks(S, role).filter(whoF[who]);
  const segF = { hoy: t => !t.done && t.due <= TODAY, proximas: t => !t.done && t.due > TODAY, hechas: t => t.done };
  const showArea = can(role, "supervisar");
  let list = all.filter(segF[seg]); if (showArea && area !== "todas") list = list.filter(t => t.area === area);
  list.sort((a, b) => a.due < b.due ? -1 : 1);
  const n = k => all.filter(segF[k]).length;
  return <>
    <Head title="Tareas" lead={role === "mantenimiento" ? "Lo que hay que arreglar o preparar. Toca una tarea para tomarla o ponerla en proceso." : "Toca una tarea para tomarla o ponerla en proceso, y el círculo cuando termines. Todo el equipo ve el avance."} />
    <Seg value={seg} onChange={setSeg} label="Cuándo" options={[["hoy", `Hoy · ${n("hoy")}`], ["proximas", `Próximas · ${n("proximas")}`], ["hechas", `Hechas · ${n("hechas")}`]]} />
    <div style={{ marginTop: 12 }}><Chips value={who} onChange={setWho} label="De quién" options={[["todas", "Todas"], ["mias", "Mías"], ["libres", "Sin asignar"]]} /></div>
    {showArea && <div style={{ marginTop: 8 }}><Chips value={area} onChange={setArea} label="Área" options={[["todas", "Todas"], ...AREAS_NUEVAS.map(k => [k, AREAS[k], <i className="dot" style={{ background: AREA_C[k] }} />])]} /></div>}
    <section className="sec"><div className="group">{list.length ? list.map(t => <TaskRow key={t.id} t={t} />) : <Empty icon="check">{seg === "hechas" ? "Todavía no hay tareas hechas." : "Nada pendiente aquí."}</Empty>}</div></section>
    <div className="btns"><button className="btn plain press" onClick={() => openSheet("newTask")}><Icon n={role === "mantenimiento" ? "camera" : "plus"} />{role === "mantenimiento" ? "Reportar un daño" : "Nueva tarea"}</button></div>
  </>;
}

/* ---------- COCINA ---------- */
function MenuBox({ id, initial }) {
  const { act } = useMC(); const [v, setV] = useState(initial || ""); const t = useRef();
  useEffect(() => setV(initial || ""), [initial]);
  return <textarea id={`menu-${id}`} value={v} placeholder="Escribe aquí el menú. Se guarda solo." onChange={e => { setV(e.target.value); clearTimeout(t.current); const val = e.target.value; t.current = setTimeout(() => act(a => a.setMenu(id, val), null, { quiet: true }), 700); }} />;
}
export function Cocina() {
  const { S, act, role } = useMC(); const buy = can(role, "compras");
  const [seg, setSeg] = useState("fichas"); const [nuevo, setNuevo] = useState("");
  const segs = <Seg value={seg} onChange={setSeg} label="Vista" options={[["fichas", "Fichas"], ["menu", "Menú"], ["compras", "Compras"]]} />;
  if (seg === "menu") return <><Head title="Cocina" lead="El menú impreso de la mesa. Edítalo, guarda varios para irlos rotando y descárgalo en PDF." />{segs}<section className="sec"><MenuStudio /></section></>;
  if (seg === "compras") {
    const items = S.shopping.slice().sort((a, b) => a.done - b.done);
    return <>
      <Head title="Cocina" lead="Lo que hay que comprar para las próximas estadías." />{segs}
      <section className="sec"><div className="group">
        {items.map(s => <div key={s.id} className={`row task ${s.done ? "done" : ""}`}><button className="check press" role="checkbox" aria-checked={s.done} aria-label={`Comprado: ${s.text}`} disabled={!buy} onClick={() => act(a => a.setCompra(s.id, !s.done))} style={{ "--c": AREA_C.cocina }}><Icon n="check" w="b" /></button><span className="grow"><span className="t">{s.text}</span></span></div>)}
        {buy && <form className="row" style={{ "--inset": "62px" }} onSubmit={e => { e.preventDefault(); if (nuevo.trim()) { act(a => a.addCompra(nuevo.trim())); setNuevo(""); } }}><span style={{ width: 30, display: "grid", placeItems: "center", color: "var(--accent-ink)" }}><Icon n="plus" c="s" /></span><label htmlFor="shopIn" className="sr">Agregar a la lista</label><input id="shopIn" className="field-in" style={{ textAlign: "left", color: "var(--ink)" }} placeholder="Agregar a la lista" value={nuevo} onChange={e => setNuevo(e.target.value)} autoComplete="off" /></form>}
      </div></section>
    </>;
  }
  const list = S.reservas.filter(r => HOLDS.includes(r.state) && r.out >= TODAY).sort((a, b) => a.in < b.in ? -1 : 1);
  return <>
    <Head title="Cocina" lead="Cada ficha llega 7 días antes. Arma el menú según el plan y cuida las alergias." />{segs}
    <div className="sec">{list.length ? list.map(r => { const g = S.guests[r.g] || {}; const d = parse(r.in); return (
      <article key={r.id} className="kcard card">
        <div className="kdate"><span className="dbox"><b>{d.getDate()}</b><span>{MES[d.getMonth()]}</span></span><div style={{ flex: 1, minWidth: 0 }}><h3>{g.name}</h3><div style={{ color: "var(--ink2)", fontSize: 14, fontWeight: 600 }}>{r.state === "casa" ? "En casa ahora" : `Llegan ${rel(r.in)}`} · {nights(r)} noches · {r.people} personas</div></div><Pill s={r.state} /></div>
        <div className="tags"><span className="tag good">{PLAN[r.plan].name}</span>{PLAN[r.plan].meals.map(x => <span key={x} className="tag">{x}</span>)}</div>
        {(g.allergies || []).length > 0 && <div className="note" style={{ margin: 0, background: "var(--danger-bg)", color: "var(--danger)" }}><Icon n="alert" c="s" w="f" /><span><b>Alergias:</b> {g.allergies.join(", ")}</span></div>}
        {(() => { const bd = birthdaysIn(g, r.in, r.out); const cal = (g.companions || []).filter(c => c.allergies); const no = g.dislikes || [];
          return (bd.length > 0 || cal.length > 0 || no.length > 0) && <div className="tags">{bd.length > 0 && <span className="tag gold"><Icon n="gift" c="xs" w="f" />Cumpleaños: {bd.join(", ")}</span>}{cal.map(c => <span key={c.id} className="tag warn"><Icon n="alert" c="xs" w="f" />{c.name}: {c.allergies}</span>)}{no.map(x => <span key={x} className="tag">No: {x}</span>)}</div>; })()}
        {((g.likes || []).length > 0 || g.celebra || g.kite) && <div className="tags">{g.celebra && <span className="tag gold"><Icon n="gift" c="xs" w="f" />{g.celebra}</span>}{g.kite && <span className="tag"><Icon n="wind" c="xs" />Vienen a hacer kite</span>}{(g.likes || []).map(x => <span key={x} className="tag">{x}</span>)}</div>}
        <label htmlFor={`menu-${r.id}`} className="lbl">Menú de la estadía</label>
        <MenuBox id={r.id} initial={S.menus[r.id]} />
      </article>); }) : <div className="group"><Empty icon="cocina">No hay estadías próximas.</Empty></div>}</div>
  </>;
}

/* ---------- LA CASA ---------- */
export function Casa() {
  const { S, role, act, openSheet } = useMC();
  const canRoom = can(role, "habitaciones"); const canOut = can(role, "afuera");
  return <>
    <Head title="La casa" lead={canRoom ? "Toca una habitación para pasarla al siguiente estado: sucia, en limpieza, lista y revisada." : "Así está cada espacio de la casa ahora mismo."} />
    <div className="rooms">{S.rooms.map(x => { const k = ROOM_ST.indexOf(x.state); return (
      <button key={x.id} className="room press" disabled={!canRoom} style={canRoom ? undefined : { cursor: "default" }} aria-label={`${x.name}: ${ROOM_LB[x.state]}${canRoom ? ". Toca para pasar al siguiente estado" : ""}`}
        onClick={() => canRoom && act(a => a.nextRoom(x.id), `${x.name.replace("Habitación ", "")}: ${ROOM_LB[ROOM_ST[(k + 1) % 4]].toLowerCase()}`)}>
        <span className="ph">{x.img ? <img src={x.img} alt="" loading="lazy" /> : <Icon n="bed" c="xl" w="d" />}<span className="pill light">{ROOM_LB[x.state]}</span></span>
        <span className="rb"><b>{x.name}</b>{x.note && <small style={{ color: "var(--ink3)", fontSize: 12 }}>{x.note}</small>}<span className="rstate" aria-hidden="true">{ROOM_ST.map((s, i) => <i key={s} className={i <= k ? "on" : ""} />)}</span></span>
      </button>); })}</div>
    <section className="sec"><div className="sec-h">Afuera</div><div className="group">{S.outside.map(o =>
      <div key={o.id} className="row"><span className="grow"><span className="t">{o.name}</span><span className="st">{o.ok ? "Al día" : "Pendiente antes de la próxima llegada"}</span></span><Switch id={`out-${o.id}`} checked={o.ok} disabled={!canOut} label={`${o.name} al día`} onChange={v => act(a => a.setExterior(o.id, v))} /></div>)}</div></section>
    <section className="sec"><div className="sec-h">Fechas bloqueadas {canOut && <button onClick={() => openSheet("block")}>Bloquear</button>}</div><div className="group">{S.blocks.length ? S.blocks.map(b =>
      <div key={b.id} className="row"><span className="ico"><Icon n="lock" c="s" w="f" /></span><span className="grow"><span className="t">{frange(b.from, b.to)}</span><span className="st">{b.reason}</span></span>{canOut && <button className="btn small plain press" onClick={() => act(a => a.delBloqueo(b.id), "Fechas liberadas")}>Liberar</button>}</div>) : <Empty icon="lock">No hay fechas bloqueadas.</Empty>}</div><p className="sec-f">Si algo no está listo, bloquea las fechas y nadie podrá apartarlas.</p></section>
  </>;
}

/* ---------- TARIFAS ---------- */
function RateInput({ k }) {
  const { S, act } = useMC(); const [v, setV] = useState(S.rates[k] || ""); const t = useRef();
  return <input className="field-in" style={{ maxWidth: 110 }} inputMode="decimal" id={`rate-${k}`} placeholder="por noche" value={v}
    onChange={e => { const val = e.target.value.replace(/[^\d.,]/g, ""); setV(val); clearTimeout(t.current); t.current = setTimeout(() => act(a => a.setTarifa(k, val), null, { quiet: true }), 700); }} />;
}
export function Tarifas() {
  const { S, act } = useMC();
  const [promo, setPromo] = useState("");
  return <>
    <Head title="Tarifas" lead="Precio por noche de la casa completa. Se guarda solo al escribir y el presupuesto lo usa." />
    {["esencial","plena"].map(p => <section key={p} className="sec"><div className="sec-h">{PLAN[p].name}</div><div className="group form">{Object.entries(RATE_KIND).map(([k, l]) =>
      <div key={k} className="row"><label className="k" htmlFor={`rate-${p}-${k}`}>{l}</label><span style={{ color: "var(--ink3)" }}>$</span><RateInput k={`${p}-${k}`} /></div>)}</div></section>)}
    <p className="sec-f" style={{ marginTop: 10 }}>Fin de semana: noches de viernes, sábado y domingo, feriados y sus vísperas. En temporada alta ({SEASON_DESC.alta.toLowerCase().replace(/\.$/, "")}) no aplica el precio de semana: todas las noches van a precio de fin de semana.</p>
    <section className="sec"><div className="sec-h">Promociones</div><div className="group">{S.promos.length ? S.promos.map(p =>
      <div key={p.id} className="row"><span className="grow"><span className="t" style={{ whiteSpace: "normal", fontWeight: 600 }}>{p.name}</span></span><Switch id={`promo-${p.id}`} checked={p.on} label={p.name} onChange={v => act(a => a.setPromo(p.id, v), v ? "Promoción activa en la web" : "Promoción pausada")} /></div>) : <Empty icon="tarifas">Todavía no hay promociones.</Empty>}
      <form className="row" onSubmit={e => { e.preventDefault(); if (promo.trim()) { act(a => a.addPromo(promo.trim()), "Promoción creada. Actívala cuando quieras"); setPromo(""); } }}><span className="ico"><Icon n="plus" c="s" /></span><label htmlFor="promoIn" className="sr">Nueva promoción</label><input id="promoIn" className="field-in" style={{ textAlign: "left", color: "var(--ink)" }} placeholder="Nueva promoción. Ej.: entre semana, 10% menos" value={promo} onChange={e => setPromo(e.target.value)} autoComplete="off" /></form></div>
      <p className="sec-f">En Reportes verás qué noches y temporadas se llenan menos.</p></section>
  </>;
}

/* ---------- INGRESOS ---------- */
export function Pagos() {
  const { S, openSheet } = useMC();
  const G = id => S.guests[id] || {};
  const ym = isoOf(T0).slice(0, 7), y = String(T0.getFullYear());
  const sum = f => S.payments.filter(f).reduce((s, p) => s + p.amount, 0);
  const pre = S.reservas.filter(r => r.state === "pre").sort((a, b) => a.in < b.in ? -1 : 1);
  const byMonth = {}; S.payments.slice().sort((a, b) => a.date < b.date ? 1 : -1).forEach(p => { (byMonth[p.date.slice(0, 7)] ||= []).push(p); });
  return <>
    <Head title="Ingresos" lead="Lo que entra por las reservas. Al registrar el anticipo, la reserva queda confirmada.">
      <div className="stats"><div className="stat"><b>{money(sum(p => p.date.startsWith(ym)))}</b><span>en {MESL[T0.getMonth()]}</span></div><div className="stat"><b>{money(sum(p => p.date.startsWith(y)))}</b><span>en {y}</span></div><div className="stat"><b>{S.payments.filter(p => p.date.startsWith(ym)).length}</b><span>pagos este mes</span></div></div></Head>
    <section className="sec"><div className="group"><L className="row press" to="reportes"><span className="ico"><Icon n="reportes" c="s" w="f" /></span><span className="grow"><span className="t">Ver los gráficos del año</span><span className="st">Ingresos por mes, temporadas y qué noches se llenan</span></span><Icon n="chev" c="s chev" /></L></div></section>
    {pre.length > 0 && <section className="sec"><div className="sec-h">Esperan anticipo</div><div className="group">{pre.map(r =>
      <div key={r.id} className="row"><span className="grow"><span className="t">{G(r.g).name}</span><span className="st">{frange(r.in, r.out)}{r.hold ? ` · vence en ${left(r.hold)}` : ""}</span></span><button className="btn small press" onClick={() => openSheet("pay", { id: r.id })}>Registrar</button></div>)}</div></section>}
    {Object.keys(byMonth).length ? Object.entries(byMonth).map(([m, ps]) => { const [yy, mm] = m.split("-"); return (
      <section key={m} className="sec"><div className="sec-h">{MESL[+mm - 1]} {yy} · {money(ps.reduce((s, p) => s + p.amount, 0))}</div><div className="group">{ps.map(p => { const r = S.reservas.find(x => x.id === p.res); return (
        <button key={p.id} className="row press" onClick={() => r && openSheet("res", { id: r.id })}><span className="ico"><Icon n="check" c="s" w="b" /></span><span className="grow"><span className="t">{r ? G(r.g).name : "Reserva"}</span><span className="st">{p.kind} · {p.method} · {fdate(p.date)}</span></span><span className="val">{money(p.amount)}</span></button>); })}</div></section>); })
      : <section className="sec"><div className="group"><Empty icon="pagos">Todavía no hay pagos registrados.</Empty></div></section>}
  </>;
}

/* ---------- Gráficos ---------- */
// Barras verticales de una sola serie. Cada barra es un botón: al pasar o tocar muestra el detalle.
function Columns({ data, fmt, label }) {
  const [on, setOn] = useState(null);
  const max = Math.max(...data.map(d => d.v), 0);
  const top = max > 0 ? niceMax(max) : 1;
  const peak = data.reduce((b, d, i) => d.v > (data[b]?.v ?? -1) ? i : b, 0);
  const cur = on ?? null;
  return <figure className="chart" aria-label={label}>
    <div className="cols" onMouseLeave={() => setOn(null)}>
      <div className="grid" aria-hidden="true">{[1, .5, 0].map(f => <span key={f} style={{ bottom: `${f * 100}%` }}><em>{fmt(top * f)}</em></span>)}</div>
      {data.map((d, i) => <button key={d.k} className={`col ${d.dim ? "dim" : ""} ${cur === i ? "on" : ""}`} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onBlur={() => setOn(null)} onClick={() => setOn(cur === i ? null : i)}
        aria-label={`${d.full}: ${fmt(d.v)}${d.note ? `, ${d.note}` : ""}`}>
        <span className="bar" style={{ height: `${d.v / top * 100}%` }}>{i === peak && d.v > 0 && cur == null && <b className="peak">{fmt(d.v)}</b>}</span>
        <span className="lab">{d.label}</span>
        {cur === i && <span className="tip" role="tooltip"><b>{d.full}</b>{fmt(d.v)}{d.note && <small>{d.note}</small>}</span>}
      </button>)}
    </div>
  </figure>;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => n <= s) || 10) * p; }
// Filas con barra: para comparar pocas categorías (temporadas, días).
function Rows({ data, fmt }) {
  const max = Math.max(1e-9, ...data.map(d => d.v));
  return <div className="group bars">{data.map(d => <div key={d.k} className={`bar-row ${d.hi ? "hi" : ""}`}><span>{d.label}</span><span className="tr"><i style={{ width: `${d.v / max * 100}%` }} /></span><b>{fmt(d.v)}</b>{d.note && <small className="bar-note">{d.note}</small>}</div>)}</div>;
}
function NumbersTable({ head, rows }) {
  return <details className="nums"><summary>Ver los números</summary><div className="nums-in"><table><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div></details>;
}

/* ---------- REPORTES ---------- */
const DOW = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export function Reportes() {
  const { S } = useMC();
  const [y, setY] = useState(T0.getFullYear());
  const Y = String(y);
  const sold = S.reservas.filter(r => SOLD.includes(r.state));
  // Ingresos por mes (fecha del pago).
  const inc = Array(12).fill(0), cnt = Array(12).fill(0);
  S.payments.forEach(p => { if (p.date.startsWith(Y)) { const m = +p.date.slice(5, 7) - 1; inc[m] += p.amount; cnt[m]++; } });
  // Noches vendidas y lo cobrado repartido por noche.
  const nightsM = Array(12).fill(0); const seas = { alta: { n: 0, $: 0, all: 0 }, media: { n: 0, $: 0, all: 0 }, baja: { n: 0, $: 0, all: 0 } };
  const dowN = Array(7).fill(0), dowAll = Array(7).fill(0);
  const until = y < T0.getFullYear() ? `${Y}-12-31` : y === T0.getFullYear() ? TODAY : null;   // para los porcentajes, solo noches que ya pasaron

  sold.forEach(r => { const ns = nightsList(r); const per = ns.length ? r.paid / ns.length : 0;
    ns.forEach(s => { if (!s.startsWith(Y)) return; nightsM[+s.slice(5, 7) - 1]++; const k = season(s); seas[k].$ += per; if (until && s < until) seas[k].n++; if (until && s < until) dowN[(parse(s).getDay() + 6) % 7]++; }); });
  if (until) for (let s = `${Y}-01-01`; s < until; s = addDays(s, 1)) { seas[season(s)].all++; dowAll[(parse(s).getDay() + 6) % 7]++; }
  const total = inc.reduce((a, b) => a + b, 0), nightsY = nightsM.reduce((a, b) => a + b, 0);
  const pastNights = until ? Object.values(seas).reduce((a, s) => a + s.all, 0) : 0, soldPast = until ? Object.values(seas).reduce((a, s) => a + s.n, 0) : 0;
  const occ = pastNights ? Math.round(soldPast / pastNights * 100) : null;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const dowP = DOW.map((d, i) => ({ k: d, label: d, v: pct(dowN[i], dowAll[i]) }));
  // Pistas para promociones.
  const tips = [];
  if (until && soldPast > 0) {
    const low = dowP.slice().sort((a, b) => a.v - b.v).slice(0, 2);
    if (low[0].v < 40) tips.push(<>Los <b>{low.map(d => d.label.toLowerCase()).join(" y ")}</b> son las noches más vacías ({low[0].v}% y {low[1].v}% ocupadas). Una promoción entre semana podría llenarlas.</>);
    const sb = pct(seas.baja.n, seas.baja.all);
    if (seas.baja.all > 0 && sb < 30) tips.push(<>En <b>temporada baja</b> la casa se llena solo el {sb}% de las noches. Es el mejor momento para promociones.</>);
    const pastM = inc.map((v, i) => [v, i]).filter(([, i]) => `${Y}-${String(i + 1).padStart(2, "0")}` < TODAY.slice(0, 7));
    if (pastM.length > 2) { const [v, i] = pastM.sort((a, b) => a[0] - b[0])[0]; tips.push(<><b>{MESL[i][0].toUpperCase() + MESL[i].slice(1)}</b> fue el mes con menos ingresos ({money(v)}). Vale la pena preparar algo para ese mes el próximo año.</>); }
  }
  const ch = {}; S.reservas.filter(r => r.created && new Date(r.created).getFullYear() === y).forEach(r => { ch[r.channel] = (ch[r.channel] || 0) + 1; });
  const monthData = inc.map((v, i) => ({ k: i, label: MES[i][0].toUpperCase(), full: `${MESL[i]} ${y}`, v, note: cnt[i] ? `${cnt[i]} ${cnt[i] === 1 ? "pago" : "pagos"}` : "sin pagos", dim: y === T0.getFullYear() && i > T0.getMonth() }));
  return <>
    <Head title="Reportes" lead="Ingresos y ocupación del año, para decidir cuándo sacar promociones.">
      <div className="stats"><div className="stat"><b>{money(total)}</b><span>ingresos en {y}</span></div><div className="stat"><b>{nightsY}</b><span>noches vendidas</span></div><div className="stat"><b>{occ == null ? "—" : <>{occ}<small>%</small></>}</b><span>ocupación{y === T0.getFullYear() ? " hasta hoy" : ""}</span></div></div></Head>
    <div className="year-nav"><button className="icon-btn press" onClick={() => setY(y - 1)} aria-label="Año anterior"><Icon n="chevL" c="s" /></button><b>{y}</b><button className="icon-btn press" onClick={() => setY(y + 1)} disabled={y >= T0.getFullYear() + 1} aria-label="Año siguiente"><Icon n="chev" c="s" /></button></div>

    {tips.length > 0 && <section className="sec"><div className="sec-h">Ideas para promociones</div><div className="group">{tips.map((t, i) => <div key={i} className="row" style={{ alignItems: "flex-start" }}><span className="ico" style={{ background: "var(--sol)", color: "var(--alga)" }}><Icon n="sparkle" c="s" w="f" /></span><span className="grow" style={{ whiteSpace: "normal", fontWeight: 600 }}>{t}</span></div>)}</div></section>}

    <section className="sec"><div className="sec-h">Ingresos por mes</div><div className="card chart-card"><Columns data={monthData} fmt={v => money(v)} label={`Ingresos por mes en ${y}`} />
      <NumbersTable head={["Mes", "Ingresos", "Pagos"]} rows={inc.map((v, i) => [MESL[i], money(v), cnt[i]])} /></div>
      <p className="sec-f">Por la fecha en que entró cada pago.</p></section>

    <section className="sec"><div className="sec-h">Noches vendidas por mes</div><div className="card chart-card"><Columns data={nightsM.map((v, i) => ({ k: i, label: MES[i][0].toUpperCase(), full: `${MESL[i]} ${y}`, v, note: `de ${new Date(y, i + 1, 0).getDate()} noches` }))} fmt={v => `${Math.round(v)}`} label={`Noches vendidas por mes en ${y}`} />
      <NumbersTable head={["Mes", "Noches", "Ocupación"]} rows={nightsM.map((v, i) => [MESL[i], v, `${pct(v, new Date(y, i + 1, 0).getDate())}%`])} /></div>
      <p className="sec-f">Incluye las reservas confirmadas que todavía no llegan.</p></section>

    <section className="sec"><div className="sec-h">Por temporada</div>
      <Rows fmt={v => money(v)} data={Object.keys(SEASONS).map(k => ({ k, label: SEASONS[k].replace("Temporada ", "").replace(/^./, c => c.toUpperCase()), v: seas[k].$, note: until ? `${pct(seas[k].n, seas[k].all)}% de las noches ocupadas` : `${seas[k].$ ? "" : "Sin datos"}` }))} />
      <p className="sec-f">{Object.keys(SEASONS).map(k => `${SEASONS[k]}: ${SEASON_DESC[k].toLowerCase()}`).join(" ")} Lo cobrado de cada reserva se reparte entre sus noches.</p></section>

    {until && <section className="sec"><div className="sec-h">Qué noches se llenan</div>
      <Rows fmt={v => `${v}%`} data={dowP.map(d => ({ ...d, hi: d.v === Math.max(...dowP.map(x => x.v)) && d.v > 0 }))} />
      <p className="sec-f">Porcentaje de noches ocupadas según el día en que empieza la noche{y === T0.getFullYear() ? ", hasta hoy" : ""}.</p></section>}

    {Object.keys(ch).length > 0 && <section className="sec"><div className="sec-h">De dónde llegan</div><Rows fmt={v => `${v}`} data={Object.entries(ch).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, label: k, v: n }))} /><p className="sec-f">Solicitudes de {y} según cómo nos encontraron.</p></section>}
  </>;
}

/* ---------- EQUIPO ---------- */
export function Equipo() {
  const { S, openSheet } = useMC();
  return <>
    <Head title="Equipo" lead="Un rol por puesto del organigrama. Cada persona entra con su propio usuario y ve solo lo que le toca. Una persona puede tener dos roles." />
    <section className="sec"><div className="sec-h">Roles</div><div className="group inset-av">{Object.entries(ROLES).filter(([k, r]) => !r.legacy || S.team.some(p => (p.roles || []).includes(k))).map(([k, r]) => { const people = S.team.filter(p => (p.roles || []).includes(k)); return (
      <button key={k} className="row press" onClick={() => openSheet("role", { id: k })}><span className="avatar m" style={{ background: `var(--r-${k})`, color: `var(--r-${k}-ink)` }}><Icon n={r.icon} c="s" w="d" /></span><span className="grow"><span className="t">{r.name}</span><span className="st">{people.length ? people.map(p => p.name).join(", ") : "Sin personas todavía"}</span></span><Icon n="chev" c="s chev" /></button>); })}</div></section>
    <section className="sec"><div className="sec-h">Personas</div><div className="group inset-av">{S.team.length ? S.team.map(p =>
      <button key={p.id} className="row press" onClick={() => openSheet("person", { id: p.id })}><span className="avatar m" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>{initials(p.name)}</span><span className="grow"><span className="t">{p.name}</span><span className="st">{(p.roles || []).length ? p.roles.map(x => ROLES[x]?.name).join(" y ") : "Sin rol: no puede entrar todavía"}</span></span><Icon n="chev" c="s chev" /></button>) : <Empty icon="huespedes">Todavía no hay personas.</Empty>}</div>
      <p className="sec-f">Para sumar a alguien: Supabase › Authentication › Users › Invite user. Aparece aquí y le asignas el rol.</p></section>
  </>;
}

/* ---------- MÁS ---------- */
export function Mas() {
  const { R, openSheet } = useMC();
  return <>
    <Head title="Más" />
    <section className="sec"><div className="group inset-ico">{R.more.map(v => <L key={v} className="row press" to={v}><span className="ico" style={{ background: "var(--arena)", color: "var(--alga)" }}><Icon n={v} c="s" w="f" /></span><span className="grow"><span className="t">{VIEWS[v]}</span></span><Icon n="chev" c="s chev" /></L>)}</div></section>
    <section className="sec"><div className="group"><button className="row press" onClick={() => openSheet("profile")}><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>Mi perfil</span></span><Icon n="chev" c="s chev" /></button></div></section>
  </>;
}

export const VIEW_CMP = { hoy: Hoy, reservas: Reservas, calendario: Calendario, huespedes: Huespedes, tareas: Tareas, cocina: Cocina, casa: Casa, pagos: Pagos, tarifas: Tarifas, reportes: Reportes, equipo: Equipo, mas: Mas };
