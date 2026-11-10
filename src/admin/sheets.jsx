import { useState, useEffect, useRef } from "react";
import { useMC, Icon, Pill, ResRow, Seg, Chips, Switch } from "./ui.jsx";
import { TODAY, ROLES, AREAS, AREAS_NUEVAS, AREA_C, AMBITOS, NIVEL, can, FLOW, STATE, STATE_SHORT, PLAN, METODOS, CANALES, MESL, addDays, day, fdate, frange, money, ago, left, nights, initials, parse, nextBirthday, birthdaysIn } from "./util.js";
import { findGuest } from "../lib/api.js";
import { REVIEW_URL } from "../lib/contacto.js";
import { OPCIONES } from "../site/ficha-data.js";

const Err = ({ msg }) => msg ? <div className="err" role="alert">{msg}</div> : null;
const KV = ({ k, v }) => <div className="row"><span className="k">{k}</span><span className="val">{v}</span></div>;

async function copy(text, toast) {
  try { await navigator.clipboard.writeText(text); toast("Copiado"); } catch { toast("No se pudo copiar. Mantén presionado el texto para copiarlo."); }
}

// Resumen de una reserva para mandar al equipo por WhatsApp.
export function teamMsg(S, r) {
  const g = S.guests[r.g] || { name: "Huésped" };
  const lines = [`🌴 Reserva confirmada: ${g.name}`, `📅 ${frange(r.in, r.out)} · ${nights(r)} noches`, `👥 ${r.people} personas · ${PLAN[r.plan].name}`];
  if (r.pet) lines.push(`🐾 Mascota: ${g.pet || "sí"}`);
  if (r.ficha?.filled && r.ficha.arrival) lines.push(`🕒 Llegada estimada: ${r.ficha.arrival}`);
  if (r.ficha?.vehicles?.length) lines.push(`🚗 Vehículos: ${r.ficha.vehicles.join(" · ")}`);
  if (r.ficha?.drinks) lines.push(`☕ Bebidas: ${r.ficha.drinks}`);
  if (r.ficha?.needs) lines.push(`🍽️ Requerimientos: ${r.ficha.needs}`);
  const al = [...(g.allergies || []), ...(g.companions || []).filter(c => c.allergies).map(c => `${c.name}: ${c.allergies}`)];
  if (al.length) lines.push(`⚠️ Alergias: ${al.join(", ")}`);
  if (g.celebra) lines.push(`🎉 Celebran: ${g.celebra}`);
  const bd = birthdaysIn(g, r.in, r.out); if (bd.length) lines.push(`🎂 Cumpleaños en la estadía: ${bd.join(", ")}`);
  if (g.kite) lines.push("🪁 Vienen a hacer kite");
  if ((g.likes || []).length) lines.push(`💛 Le gusta: ${g.likes.join(", ")}`);
  const ts = S.tasks.filter(t => t.res === r.id && !t.done);
  if (ts.length) { lines.push("", "Tareas:"); ts.forEach(t => lines.push(`• ${AREAS[t.area]}: ${t.title} (${fdate(t.due)})`)); }
  lines.push("", "Detalles en Maracuyá Control.");
  return lines.join("\n");
}

/* ---------- Ficha de registro ----------
   El huésped la llena y la firma en papel (public/ficha-registro-casa-maracuya.pdf) y el equipo
   la pasa aquí. Los datos van a la reserva (quiénes pernoctan, vehículos…) y a la ficha del huésped. */
const FICHA_PDF_URL = "/ficha-registro-casa-maracuya.pdf";
const canFicha = role => ["direccion","recepcion","admin","operaciones"].includes(role);
function FichaSec({ r, g }) {
  const { S, R, role, openSheet } = useMC();
  const f = r.ficha || {}; const edit = canFicha(role);
  if (!f.filled && !edit) return null;
  const total = (f.adults || 0) + (f.kids || 0);
  const by = f.by && S.team.find(p => p.id === f.by);
  return <section className="sec"><div className="sec-h">Ficha de registro</div>
    {!f.filled
      ? <div className="note"><Icon n="alert" c="s" w="f" /><span>Todavía no se ha pasado la ficha. Imprímela, que el titular la llene y firme, y pásala aquí.</span></div>
      : f.signed
        ? <div className="note" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="check" c="s" w="b" /><span>Firmada en papel por <b>{f.firma}</b>. Aceptó las normas de la casa.{by ? ` Pasada por ${by.name.split(" ")[0]} ${ago(f.at)}.` : ""}</span></div>
        : <div className="note"><Icon n="alert" c="s" w="f" /><span>Pasada al panel, pero falta la firma del titular en papel.</span></div>}
    {f.filled && <div className="group kv">
      <KV k="Llegada estimada" v={f.arrival || "Sin indicar"} />
      <KV k="Huéspedes" v={`${f.adults || 0} adultos · ${f.kids || 0} niños`} />
      {total !== r.people && <div className="row"><span className="st" style={{ color: "var(--danger)", whiteSpace: "normal" }}>La reserva dice {r.people} personas y la ficha {total}. Confírmalo con el huésped.</span></div>}
      <KV k="Vehículos" v={f.vehicles.length ? f.vehicles.join(" · ") : "Ninguno"} />
      {f.drinks && <KV k="Bebidas" v={f.drinks} />}
      {f.needs && <KV k="Requerimientos" v={f.needs} />}
      {f.reason && <KV k="Motivo" v={f.reason} />}
      {r.pet && <KV k="Mascota" v={[f.petName, f.petBreed].filter(Boolean).join(", ") || "Sí"} />}
    </div>}
    {f.filled && f.people.length > 0 && <><div className="sec-h" style={{ marginTop: 14 }}>Registrados para dormir ({f.people.length})</div><div className="group">
      {f.people.map((o, i) => <div key={i} className="row"><span className="ico" style={{ fontWeight: 700 }}>{i + 1}</span><span className="grow"><span className="t">{o.nombre}{i === 0 && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> · titular</span>}</span>
        <span className="st">{[R.phone && o.documento, o.edad != null && `${o.edad} años`].filter(Boolean).join(" · ") || " "}</span></span></div>)}
    </div><p className="sec-f">Solo pueden pernoctar las personas de esta lista.</p></>}
    {edit && <div className="group" style={{ marginTop: 10 }}>
      <button className="row press" onClick={() => openSheet("ficha", { id: r.id })}><span className="ico" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}><Icon n="plus" c="s" /></span><span className="grow"><span className="t">{f.filled ? "Corregir la ficha" : "Pasar la ficha al panel"}</span><span className="st">Con la ficha en papel en la mano</span></span><Icon n="chev" c="s chev" /></button>
      <a className="row press" href={FICHA_PDF_URL} target="_blank" rel="noreferrer"><span className="ico"><Icon n="receipt" c="s" /></span><span className="grow"><span className="t">Imprimir la ficha en blanco</span><span className="st">PDF de 2 páginas para que la llene el titular</span></span><Icon n="chev" c="s chev" /></a>
    </div>}
  </section>;
}

// Selección múltiple con el mismo estilo de las fichas de opciones del panel.
function Multi({ value, onChange, options, label }) {
  return <div className="chips" role="group" aria-label={label}>{options.map(o =>
    <button key={o} type="button" className="chip press" aria-pressed={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])}>{o}</button>)}</div>;
}
const optV = k => OPCIONES[k].map(o => o.v);
const splitOpts = (k, list) => { const vals = optV(k); const parts = (Array.isArray(list) ? list : String(list || "").split(",")).map(x => x.trim()).filter(Boolean);
  return [parts.filter(x => vals.includes(x)), parts.filter(x => !vals.includes(x)).join(", ")]; };
const joinOpts = (set, otro) => [...set, ...String(otro || "").split(",").map(x => x.trim()).filter(Boolean)];

export function FichaSheet({ id }) {
  const { S, act, openSheet } = useMC();
  const r = S.reservas.find(x => x.id === id); const g = r && (S.guests[r.g] || {});
  const [f, setF] = useState(() => {
    if (!r) return null;
    const fi = r.ficha || {};
    const [al, alO] = splitOpts("alergias", g.allergies || []), [be, beO] = splitOpts("bebidas", fi.drinks), [rq, rqO] = splitOpts("requerimientos", fi.needs), [mo, moO] = splitOpts("motivo", fi.reason);
    const occ = (fi.people || []).slice(1).map(o => ({ nombre: o.nombre || "", documento: o.documento || "", edad: o.edad == null ? "" : String(o.edad) }));
    while (occ.length < Math.min(11, r.people - 1)) occ.push({ nombre: "", documento: "", edad: "" });
    const veh = [...(fi.vehicles || [])]; while (veh.length < 2) veh.push("");
    return { nombre: g.name || "", documento: g.doc || "", telefono: g.phone || "", email: g.email || "", ciudad: g.city || "",
      hora: fi.arrival || "", adultos: fi.adults ?? r.people, ninos: fi.kids ?? 0, veh, occ,
      al, alO, be, beO, rq, rqO, mo, moO, mascota: !!r.pet, mN: fi.petName || "", mR: fi.petBreed || "", firmada: !!fi.signed };
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!r || !f) return <p className="sec-f">Esta reserva ya no existe.</p>;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setOcc = (i, k, v) => setF(x => ({ ...x, occ: x.occ.map((o, j) => j === i ? { ...o, [k]: v } : o) }));
  const ad = parseInt(f.adultos, 10) || 0, ni = parseInt(f.ninos, 10) || 0;
  const Row = ({ id: fid, label, k, ...rest }) => <div className="row"><label className="k" htmlFor={fid}>{label}</label><input id={fid} className="field-in" value={f[k]} onChange={e => set(k, e.target.value)} autoComplete="off" {...rest} /></div>;
  const submit = async e => {
    e.preventDefault(); setErr("");
    if (f.nombre.trim().length < 2) return setErr("Falta el nombre del titular.");
    if (ad < 1) return setErr("Tiene que venir al menos un adulto.");
    if (ad + ni > 12) return setErr("La casa recibe hasta 12 personas en total.");
    setBusy(true);
    const er = await act(a => a.guardarFicha(r.id, {
      nombre: f.nombre.trim(), documento: f.documento.trim(), telefono: f.telefono.trim(), email: f.email.trim(), ciudad: f.ciudad.trim(),
      hora_llegada: f.hora, adultos: ad, ninos: ni, vehiculos: f.veh.map(v => v.trim()).filter(Boolean),
      ocupantes: [{ nombre: f.nombre.trim(), documento: f.documento.trim(), edad: "" }, ...f.occ],
      alergias: joinOpts(f.al, f.alO), bebidas: joinOpts(f.be, f.beO).join(", "), requerimientos: joinOpts(f.rq, f.rqO).join(", "), motivo: joinOpts(f.mo, f.moO).join(", "),
      mascota: f.mascota, mascota_nombre: f.mascota ? f.mN.trim() : "", mascota_raza: f.mascota ? f.mR.trim() : "", firmada: f.firmada
    }), "Ficha guardada");
    setBusy(false); if (er) setErr(er); else openSheet("res", { id: r.id });
  };
  // Se dibuja como función (no como componente) para que los campos no pierdan el foco al escribir.
  const row = (fid, label, k, extra) => Row({ id: fid, label, k, ...extra });
  return <form className="form" onSubmit={submit}>
    <div className="res-hero" style={{ paddingBottom: 6 }}><div><h3>{g.name}</h3><div className="st">{r.code} · {frange(r.in, r.out)} · check-in 3:00 PM, check-out 11:00 AM</div></div></div>
    <p className="sec-f" style={{ padding: "0 4px" }}>Copia aquí lo que el titular escribió en la ficha en papel. Puedes guardarla incompleta y terminarla en el check-in.</p>

    <section className="sec"><div className="sec-h">1 · Titular de la reserva</div><div className="group">
      {row("fcN", "Nombre y apellido", "nombre")}{row("fcD", "C.I. / Pasaporte", "documento")}{row("fcT", "WhatsApp", "telefono", { inputMode: "tel" })}
      {row("fcE", "Correo", "email", { type: "email" })}{row("fcC", "Ciudad de origen", "ciudad")}
    </div></section>

    <section className="sec"><div className="sec-h">2 · Estancia y transporte</div><div className="group">
      {row("fcH", "Hora est. de llegada", "hora", { type: "time" })}
      {row("fcA", "Adultos", "adultos", { type: "number", inputMode: "numeric", min: 1, max: 12 })}
      {row("fcK", "Niños", "ninos", { type: "number", inputMode: "numeric", min: 0, max: 11 })}
      {f.veh.map((v, i) => <div key={i} className="row"><label className="k" htmlFor={`fcV${i}`}>Vehículo {i + 1}</label><input id={`fcV${i}`} className="field-in" placeholder="Placa · modelo" value={v} onChange={e => set("veh", f.veh.map((x, j) => j === i ? e.target.value : x))} autoComplete="off" /></div>)}
    </div><p className="sec-f" style={{ color: ad + ni > 12 ? "var(--danger)" : undefined }}>Total: {ad + ni} de 12 personas como máximo.</p></section>

    <section className="sec"><div className="sec-h">3 · Acompañantes ({f.occ.length + 1} con el titular)</div>
      {f.occ.map((o, i) => <div key={i} className="group" style={{ marginBottom: 10 }}>
        <div className="row"><label className="k" htmlFor={`fcO${i}`}>{i + 2}. Nombre</label><input id={`fcO${i}`} className="field-in" value={o.nombre} onChange={e => setOcc(i, "nombre", e.target.value)} autoComplete="off" />
          <button type="button" className="icon-btn press" onClick={() => set("occ", f.occ.filter((_, j) => j !== i))} aria-label={`Quitar a la persona ${i + 2}`}><Icon n="close" c="s" /></button></div>
        <div className="row"><label className="k" htmlFor={`fcOD${i}`}>C.I. / Documento</label><input id={`fcOD${i}`} className="field-in" value={o.documento} onChange={e => setOcc(i, "documento", e.target.value)} autoComplete="off" /></div>
        <div className="row"><label className="k" htmlFor={`fcOE${i}`}>Edad (si es menor)</label><input id={`fcOE${i}`} className="field-in" type="number" inputMode="numeric" min="0" max="17" value={o.edad} onChange={e => setOcc(i, "edad", e.target.value)} /></div>
      </div>)}
      {f.occ.length < 11 && <div className="group"><button type="button" className="row press" onClick={() => set("occ", [...f.occ, { nombre: "", documento: "", edad: "" }])}><span className="ico"><Icon n="plus" c="s" /></span><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>Agregar a otra persona</span></span></button></div>}
      <p className="sec-f">Solo pueden pernoctar las personas registradas. Las filas sin nombre no se guardan.</p></section>

    <section className="sec"><div className="sec-h">4 · Gastronomía y alergias</div>
      <Multi label="Alergias o intolerancias" value={f.al} onChange={v => set("al", v)} options={optV("alergias")} />
      <div className="group" style={{ marginTop: 8 }}>{row("fcAO", "Otras alergias", "alO", { placeholder: "Ninguna" })}</div>
      <div className="sec-h" style={{ marginTop: 14 }}>Bebidas</div>
      <Multi label="Bebidas" value={f.be} onChange={v => set("be", v)} options={optV("bebidas")} />
      <div className="group" style={{ marginTop: 8 }}>{row("fcBO", "Otras bebidas", "beO")}</div>
      <div className="sec-h" style={{ marginTop: 14 }}>Requerimientos especiales</div>
      <Multi label="Requerimientos" value={f.rq} onChange={v => set("rq", v)} options={optV("requerimientos")} />
      <div className="group" style={{ marginTop: 8 }}>{row("fcRO", "Otros", "rqO")}</div>
    </section>

    <section className="sec"><div className="sec-h">5 · Mascota y ocasión</div><div className="group">
      <div className="row"><label className="k" htmlFor="fcM">Trae mascota</label><Switch id="fcM" checked={f.mascota} onChange={v => set("mascota", v)} /></div>
      {f.mascota && row("fcMN", "Nombre", "mN")}{f.mascota && row("fcMR", "Raza", "mR")}
    </div>
      <div className="sec-h" style={{ marginTop: 14 }}>Motivo de la visita</div>
      <Multi label="Motivo de la visita" value={f.mo} onChange={v => set("mo", v)} options={optV("motivo")} />
      <div className="group" style={{ marginTop: 8 }}>{row("fcMO", "Otro motivo", "moO")}</div>
    </section>

    <section className="sec"><div className="sec-h">6 · Firma</div><div className="group">
      <div className="row"><label className="k" htmlFor="fcF" style={{ whiteSpace: "normal" }}>El titular firmó la ficha en papel y aceptó las normas</label><Switch id="fcF" checked={f.firmada} onChange={v => set("firmada", v)} /></div>
    </div><p className="sec-f">Guarda la ficha firmada en papel: es el respaldo de que aceptó las normas.</p></section>

    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit" disabled={busy}><Icon n="check" w="b" />{busy ? "Guardando…" : "Guardar la ficha"}</button></div>
  </form>;
}

/* ---------- Semáforo de calidad (lo llena Calidad; lo lee Dirección) ---------- */
const NIVEL_C = { verde: ["var(--good-bg)", "var(--good)"], amarillo: ["var(--sol)", "var(--alga)"], rojo: ["var(--danger-bg)", "var(--danger)"] };
function AuditRow({ r, k, a }) {
  const { act, role } = useMC(); const A = AMBITOS[k];
  const [note, setNote] = useState(a?.note || ""); useEffect(() => setNote(a?.note || ""), [a?.note]);
  const edit = role === "calidad" || role === "direccion";
  const save = (level, n = note) => act(x => x.setAuditoria(r.id, k, level, n), level === "rojo" ? "Semáforo en rojo: la CEO ya lo ve" : "Guardado en el semáforo");
  return <div className="row" style={{ display: "grid", gap: 8, alignItems: "start" }}>
    <span><span className="t">{A.name}</span><span className="st" style={{ whiteSpace: "normal" }}>{A.who} · {A.check}</span></span>
    <div className="chips" role="group" aria-label={`Semáforo: ${A.name}`}>{Object.entries(NIVEL).map(([lv, label]) => {
      const on = a?.level === lv; const [bg, ink] = NIVEL_C[lv];
      return <button key={lv} type="button" className="chip press" aria-pressed={on} disabled={!edit} onClick={() => save(lv)}
        style={on ? { background: bg, color: ink, borderColor: ink } : undefined}><i className="dot" style={{ background: ink }} />{label}</button>; })}</div>
    {(edit || a?.note) && <input className="field-in" style={{ textAlign: "left", color: "var(--ink)" }} disabled={!edit || !a} value={note}
      placeholder={a ? "Qué pasó y cómo se corrigió" : "Elige un color primero"} onChange={e => setNote(e.target.value)}
      onBlur={() => { if (a && note !== (a.note || "")) save(a.level, note); }} aria-label={`Nota: ${A.name}`} />}
  </div>;
}
function AuditSec({ r }) {
  const { S, role } = useMC();
  if (!can(role, "semaforo") || !["casa","finalizada"].includes(r.state)) return null;
  const mine = (S.audits || []).filter(a => a.res === r.id);
  return <section className="sec"><div className="sec-h">Semáforo de calidad</div>
    <div className="group">{Object.keys(AMBITOS).map(k => <AuditRow key={k} r={r} k={k} a={mine.find(a => a.area === k)} />)}</div>
    <p className="sec-f">Verde: se cumple a la perfección. Amarillo: un descuido corregido en el momento. Rojo: falla importante; la CEO recibe el aviso de inmediato.</p>
  </section>;
}

/* ---------- Detalle de reserva ---------- */
const TEMPLATES = [
  ["Saludo", "¡Hola {n}! Gracias por escribirle a Casa Maracuyá. Tenemos tus fechas ({f}). Te cuento la tarifa y lo que incluye el plan en un momento."],
  ["Disponible", "¡Buenas noticias, {n}! Las fechas {f} están libres. Si quieres, te las apartamos 24 horas mientras haces el anticipo."],
  ["Sin cupo", "Hola {n}, qué pena: las fechas {f} ya están tomadas. ¿Te sirve otra fecha cercana?"]
];
export function ResSheet({ id }) {
  const { S, R, act, openSheet, toast, canMove, canReceive, canMoney } = useMC();
  const [err, setErr] = useState(""); const [sure, setSure] = useState(false);
  const r = S.reservas.find(x => x.id === id);
  if (!r) return <p className="sec-f">Esta reserva ya no existe.</p>;
  const g = S.guests[r.g] || { name: "Huésped", allergies: [], likes: [] };
  const fi = FLOW.indexOf(r.state); const fr = frange(r.in, r.out); const first = g.name.split(" ")[0];
  const step = async (to, msg) => { setErr(""); const e = await act(a => a.cambiarEstado(r.id, to), msg); if (e) setErr(e); };
  const wa = g.phone && g.phone.replace(/\D/g, "").length > 6 ? `https://wa.me/${g.phone.replace(/\D/g, "")}` : "https://wa.me/";
  let actions = null;
  if (canMove || canReceive) {
    if (canMove && r.state === "nueva") actions = <><button className="btn press" onClick={() => step("conversacion", "En conversación")}><Icon n="chat" w="f" />Ya le respondí por WhatsApp</button><button className="btn danger press" onClick={() => step("rechazada", "Marcada sin cupo")}>No hay cupo</button></>;
    if (canMove && r.state === "conversacion") actions = <><button className="btn press" onClick={() => step("pre", "Fechas apartadas por 24 horas")}><Icon n="lock" w="f" />Apartar las fechas 24 horas</button><button className="btn danger press" onClick={() => step("rechazada", "Marcada sin cupo")}>No hay cupo</button></>;
    if (canMove && r.state === "pre") actions = <>{canMoney ? <button className="btn press" onClick={() => openSheet("pay", { id: r.id })}><Icon n="pagos" w="f" />Registrar el anticipo</button> : <p className="sec-f" style={{ padding: "0 4px" }}>Administración registra el anticipo y la reserva se confirma sola.</p>}<button className="btn danger press" onClick={() => step("vencida", "Fechas liberadas")}>Liberar las fechas</button></>;
    if (r.state === "confirmada") actions = <><button className="btn press" onClick={() => step("casa", `¡Bienvenidos! ${first} ya está en casa`)}><Icon n="door" w="f" />Ya llegaron</button>{canMove && <button className="btn danger press" onClick={() => sure ? step("cancelada", "Reserva cancelada. Fechas libres") : (setSure(true), setTimeout(() => setSure(false), 3500))}>{sure ? "Toca otra vez para cancelar" : "Cancelar la reserva"}</button>}</>;
    if (r.state === "casa") actions = <button className="btn press" onClick={() => step("finalizada", "Cuenta cerrada. Se crearon las tareas de salida")}><Icon n="out" />Cerrar la cuenta y despedir</button>;
    if (canMove && r.state === "finalizada") actions = <a className="btn plain press" href={`${wa}?text=${encodeURIComponent(`¡Gracias por quedarte en Casa Maracuyá, ${first}! Si te gustó, nos ayudas mucho dejando tu reseña en Google: ${REVIEW_URL}`)}`} target="_blank" rel="noreferrer"><Icon n="heart" w="f" />Enviar las gracias por WhatsApp</a>;
  }
  return <>
    <div className="res-hero"><span className="avatar l" style={{ background: `var(--s-${fi >= 0 ? r.state : "salida"}-bg)`, color: `var(--s-${fi >= 0 ? r.state : "salida"}-ink)` }}>{initials(g.name)}</span>
      <div style={{ minWidth: 0 }}><h3>{g.name}</h3><div className="st">{r.code} · llegó por {r.channel} {ago(r.created)}</div><div style={{ marginTop: 8 }}><Pill s={r.state} /></div></div></div>
    {fi >= 0
      ? <div className="track" aria-label={`Paso ${fi + 1} de ${FLOW.length}: ${STATE[r.state]}`}>{FLOW.map((s, i) => <div key={s} className={`stp ${i < fi ? "done" : i === fi ? "now" : ""}`}><i>{i < fi && <Icon n="check" c="xs" w="b" />}</i>{STATE_SHORT[s]}</div>)}</div>
      : <div className="note"><Icon n="alert" c="s" w="f" /><span>Esta reserva terminó como <b>{STATE[r.state].toLowerCase()}</b>. Sus fechas quedaron libres.</span></div>}
    {r.state === "pre" && r.hold && <div className="countdown"><Icon n="clock" c="s" w="f" /><span>Fechas apartadas. Si no llega el anticipo, se liberan solas en <b>{left(r.hold)}</b>.</span></div>}
    <Err msg={err} />
    {actions && <div className="btns">{actions}</div>}
    <section className="sec"><div className="sec-h">Estadía</div><div className="group kv"><KV k="Llegada" v={fdate(r.in)} /><KV k="Salida" v={fdate(r.out)} /><KV k="Noches" v={nights(r)} /><KV k="Plan" v={PLAN[r.plan].name} /><KV k="Personas" v={r.people} /><KV k="Mascota" v={r.pet ? (g.pet || "Sí") : "No"} /></div></section>
    {canMove && ["nueva","conversacion","pre"].includes(r.state) && <section className="sec"><div className="group"><button className="row press" onClick={() => openSheet("budget", { res: r.id })}><span className="ico"><Icon n="receipt" c="s" /></span><span className="grow"><span className="t">Hacer presupuesto</span><span className="st">Con su nombre, fechas, personas y plan ya puestos</span></span><Icon n="chev" c="s chev" /></button></div></section>}
    <ReceiptSec r={r} g={g} />
    <FichaSec r={r} g={g} />
    <AuditSec r={r} />
    {(canMove || canReceive) && ["confirmada","casa"].includes(r.state) && <section className="sec"><div className="sec-h">Avisar al equipo</div><div className="group">
      <a className="row press" href={`https://wa.me/?text=${encodeURIComponent(teamMsg(S, r))}`} target="_blank" rel="noreferrer"><span className="ico" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="chat" c="s" w="f" /></span><span className="grow"><span className="t">Enviar el resumen por WhatsApp</span><span className="st">Elige el grupo del equipo o a una persona</span></span><Icon n="chev" c="s chev" /></a>
      <button className="row press" onClick={() => copy(teamMsg(S, r), toast)}><span className="ico"><Icon n="copy" c="s" /></span><span className="grow"><span className="t">Copiar el resumen</span></span></button>
    </div></section>}
    {canMoney && (() => { const ps = S.payments.filter(p => p.res === r.id).sort((a, b) => a.date < b.date ? -1 : 1); return <section className="sec"><div className="sec-h">Pagos recibidos · {money(r.paid)}</div><div className="group">
      {ps.length ? ps.map(p => <div key={p.id} className="row"><span className="ico"><Icon n="check" c="s" w="b" /></span><span className="grow"><span className="t">{p.kind}</span><span className="st">{p.method} · {fdate(p.date)}</span></span><span className="val">{money(p.amount)}</span></div>) : <div className="row"><span className="st">Todavía no hay pagos de esta reserva.</span></div>}
      {["confirmada","casa","finalizada"].includes(r.state) && <button className="row press" onClick={() => openSheet("pay", { id: r.id })}><span className="ico"><Icon n="plus" c="s" /></span><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>Registrar otro pago</span></span></button>}
    </div></section>; })()}
    <section className="sec"><div className="sec-h">Huésped</div><div className="group">
      <button className="row press" onClick={() => openSheet("guest", { id: r.g })}><span className="grow"><span className="t">Ver la ficha completa</span><span className="st">{[(g.allergies || []).length ? `Alergias: ${g.allergies.join(", ")}` : "Sin alergias anotadas", g.visits > 1 ? `${g.visits} visitas` : ""].filter(Boolean).join(" · ")}</span></span><Icon n="chev" c="s chev" /></button>
      {R.phone && g.phone && <div className="row"><span className="grow"><span className="t" style={{ userSelect: "all" }}>{g.phone}</span><span className="st">WhatsApp</span></span><button className="btn small plain press" onClick={() => copy(g.phone, toast)}>Copiar</button></div>}
    </div></section>
    {r.notes && <section className="sec"><div className="sec-h">Lo que nos contó</div><div className="group"><div className="row"><span className="grow" style={{ whiteSpace: "normal" }}>{r.notes}</span></div></div></section>}
    {canMove && ["nueva","conversacion"].includes(r.state) && <section className="sec"><div className="sec-h">Respuestas preparadas</div><div className="group">{TEMPLATES.map(([t, x]) => { const txt = x.replace("{n}", first).replace("{f}", fr); return (
      <div key={t} className="row" style={{ alignItems: "flex-start" }}><span className="grow"><span className="t">{t}</span><span className="st" style={{ whiteSpace: "normal" }}>{txt}</span></span><button className="btn small plain press" onClick={() => copy(txt, toast)}>Copiar</button></div>); })}</div><p className="sec-f">Copia la respuesta y pégala en WhatsApp Business.</p></section>}
  </>;
}

/* ---------- Comprobante de reserva y pago ---------- */
const receiptUrl = r => `${location.origin}/comprobante?c=${r.receiptToken}`;
function ReceiptSec({ r, g }) {
  const { act, toast, openSheet, canMoney } = useMC();
  if (!canMoney || !["confirmada","casa","finalizada"].includes(r.state) || !r.receiptToken) return null;
  const saldo = Math.max(0, r.total - r.paid); const first = (g.name || "").split(" ")[0];
  const phone = (g.phone || "").replace(/\D/g, "");
  const msg = r.lang === "en"
    ? `Hello ${first}! Your stay at Casa Maracuyá is confirmed (${r.code}). Here is your booking and payment receipt: ${receiptUrl(r)}`
    : `¡Hola ${first}! Tu reserva en Casa Maracuyá está confirmada (${r.code}). Aquí tienes tu comprobante de reserva y pago: ${receiptUrl(r)}`;
  const mail = () => act(async a => { const res = await a.enviarComprobante(r.id);
    toast(res?.sinCorreo ? "No tiene correo anotado. Agrégalo en su ficha o envíalo por WhatsApp" : `Comprobante enviado a ${res.to}`); }, null);
  return <section className="sec"><div className="sec-h">Comprobante</div>
    <div className="group kv"><KV k="Total" v={money(r.total)} /><KV k="Pagado" v={money(r.paid)} /><KV k="Saldo" v={money(saldo)} />
      {r.concept && <KV k="Concepto" v={r.concept} />}</div>
    <div className="group" style={{ marginTop: 10 }}>
      <a className="row press" href={receiptUrl(r)} target="_blank" rel="noreferrer"><span className="ico"><Icon n="receipt" c="s" /></span><span className="grow"><span className="t">Ver el comprobante</span><span className="st">El mismo que recibe el huésped; desde ahí se guarda en PDF</span></span><Icon n="chev" c="s chev" /></a>
      <a className="row press" href={`https://wa.me/${phone.length > 6 ? phone : ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><span className="ico" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="chat" c="s" w="f" /></span><span className="grow"><span className="t">Enviar por WhatsApp</span><span className="st">Se abre con el mensaje y el enlace listos</span></span><Icon n="chev" c="s chev" /></a>
      <button className="row press" onClick={mail}><span className="ico"><Icon n="copy" c="s" /></span><span className="grow"><span className="t">{r.receiptSent ? "Reenviar por correo" : "Enviar por correo"}</span>
        <span className="st">{r.receiptSent ? `Enviado a ${r.receiptTo} ${ago(r.receiptSent)}` : g.email ? `A ${g.email}` : "No tiene correo anotado en su ficha"}</span></span></button>
      <button className="row press" onClick={() => openSheet("total", { id: r.id })}><span className="ico"><Icon n="pagos" c="s" /></span><span className="grow"><span className="t">Cambiar el total o el concepto</span></span><Icon n="chev" c="s chev" /></button>
    </div>
    <p className="sec-f">No es una factura fiscal. Si el huésped la pide, Administración la emite en su sistema autorizado.</p>
  </section>;
}
export function TotalSheet({ id }) {
  const { S, act, openSheet } = useMC(); const r = S.reservas.find(x => x.id === id);
  const [total, setTotal] = useState(r ? String(r.total || "") : ""); const [concept, setConcept] = useState(r?.concept || ""); const [err, setErr] = useState("");
  if (!r) return null;
  const submit = async e => { e.preventDefault(); const t = Number(String(total).replace(",", "."));
    if (total === "" || isNaN(t) || t < 0) return setErr("Escribe un total válido.");
    const er = await act(a => a.fijarTotal(r.id, t, concept.trim()), "Comprobante actualizado"); if (er) setErr(er); else openSheet("res", { id: r.id }); };
  return <form className="form" onSubmit={submit}>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="ttTot">Total de la estadía</label><span style={{ color: "var(--ink3)" }}>$</span><input id="ttTot" className="field-in" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} style={{ maxWidth: 120, color: "var(--ink)" }} /></div>
      <div className="row"><label className="k" htmlFor="ttCon">Concepto</label><input id="ttCon" className="field-in" value={concept} onChange={e => setConcept(e.target.value)} autoComplete="off" /></div>
    </div><p className="sec-f">El comprobante del huésped se actualiza al momento. Si ya se lo enviaste, reenvíaselo.</p></section>
    <Err msg={err} /><div className="btns"><button className="btn press" type="submit">Guardar</button></div>
  </form>;
}

/* ---------- Pago ---------- */
export function PaySheet({ id }) {
  const { S, act, openSheet } = useMC();
  const r = S.reservas.find(x => x.id === id); const g = S.guests[r.g] || {};
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState(METODOS[0]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(r.total ? String(r.total) : "");
  const [concept, setConcept] = useState(r.concept || `${nights(r)} noches · ${PLAN[r.plan].name} · ${r.people} personas`);
  const { toast } = useMC();
  const num = v => Number(String(v).replace(",", "."));
  const submit = async e => {
    e.preventDefault(); const n = num(amt), tot = total === "" ? null : num(total);
    if (!n || n <= 0) return setErr("Escribe el monto que recibiste.");
    if (tot == null || isNaN(tot) || tot < 0) return setErr("Escribe el total de la estadía: va en el comprobante.");
    setBusy(true); const wasPre = r.state === "pre";
    const er = await act(a => a.registrarPago(r.id, n, method, tot, concept.trim()), wasPre ? "Confirmada. Se crearon las tareas para el equipo" : "Pago registrado");
    if (er) { setBusy(false); return setErr(er); }
    // Al confirmar, el comprobante sale solo por correo.
    if (wasPre) await act(async a => { const res = await a.enviarComprobante(r.id);
      toast(res?.sinCorreo ? "Confirmada. No tiene correo anotado: envíale el comprobante por WhatsApp" : `Confirmada. Comprobante enviado a ${res.to}`); }, null);
    setBusy(false); openSheet("res", { id: r.id });
  };
  return <form className="form" onSubmit={submit}>
    <div className="res-hero" style={{ paddingBottom: 6 }}><div><h3>{g.name}</h3><div className="st">{frange(r.in, r.out)}{r.paid ? ` · ya recibido ${money(r.paid)}` : ""}</div></div></div>
    <section className="sec"><div className="group"><div className="row"><label className="k" htmlFor="payAmt">Monto recibido</label><span style={{ color: "var(--ink3)" }}>$</span><input id="payAmt" className="field-in" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} style={{ maxWidth: 120, color: "var(--ink)" }} /></div></div></section>
    <section className="sec"><div className="sec-h">Para el comprobante</div><div className="group">
      <div className="row"><label className="k" htmlFor="payTot">Total de la estadía</label><span style={{ color: "var(--ink3)" }}>$</span><input id="payTot" className="field-in" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} style={{ maxWidth: 120, color: "var(--ink)" }} /></div>
      <div className="row"><label className="k" htmlFor="payCon">Concepto</label><input id="payCon" className="field-in" value={concept} onChange={e => setConcept(e.target.value)} autoComplete="off" /></div>
    </div>{r.state === "pre" && <p className="sec-f">Al registrar el pago se confirma la reserva y el huésped recibe el comprobante por correo.</p>}</section>
    <section className="sec"><div className="sec-h">Cómo pagó</div><Chips value={method} onChange={setMethod} label="Método de pago" options={METODOS.map(m => [m, m])} /></section>
    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit" disabled={busy}><Icon n="check" w="b" />{r.state === "pre" ? "Registrar y confirmar la reserva" : "Registrar el pago"}</button></div>
  </form>;
}

/* ---------- Ficha del huésped (interna) ---------- */
// Campo que se guarda solo al salir de él.
function FactRow({ label, id, value, onSave, type = "text", placeholder, disabled }) {
  const [v, setV] = useState(value || "");
  useEffect(() => setV(value || ""), [value]);
  return <div className="row"><label className="k" htmlFor={id}>{label}</label>
    <input id={id} type={type} className="field-in" value={v} placeholder={placeholder || "Sin anotar"} disabled={disabled} autoComplete="off"
      onChange={e => setV(e.target.value)} onBlur={() => { if (v !== (value || "")) onSave(v.trim()); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></div>;
}
// Lista de etiquetas que se pueden agregar y quitar.
function TagList({ items, onChange, placeholder, tone, icon, canEdit, label }) {
  const [t, setT] = useState("");
  const add = e => { e.preventDefault(); const x = t.trim(); if (!x || items.includes(x)) return setT(""); onChange([...items, x]); setT(""); };
  return <div className="group">
    {items.length > 0 && <div className="row"><div className="taglist">{items.map(x => <span key={x} className={`tag ${tone || ""}`}>{icon && <Icon n={icon} c="xs" w="f" />}{x}
      {canEdit && <button type="button" className="tag-x" onClick={() => onChange(items.filter(y => y !== x))} aria-label={`Quitar ${x}`}><Icon n="close" c="xs" /></button>}</span>)}</div></div>}
    {canEdit ? <form className="row" onSubmit={add}><span className="ico"><Icon n="plus" c="s" /></span><label className="sr">{label}</label>
      <input className="field-in" style={{ textAlign: "left", color: "var(--ink)" }} placeholder={placeholder} value={t} onChange={e => setT(e.target.value)} autoComplete="off" aria-label={label} /></form>
      : !items.length && <div className="row"><span className="st">Nada anotado</span></div>}
  </div>;
}
function Companions({ gid, list, canEdit }) {
  const { act, R } = useMC();
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: "", rel: "", birthday: "", allergies: "" });
  const save = async e => { e.preventDefault(); if (!f.name.trim()) return;
    const er = await act(a => a.addAcomp(gid, { ...f, name: f.name.trim() }), `${f.name.trim()} anotado`); if (!er) { setF({ name: "", rel: "", birthday: "", allergies: "" }); setOpen(false); } };
  return <div className="group inset-av">
    {list.map(c => { const b = c.birthday && nextBirthday(c.birthday); return <div key={c.id} className="row">
      <span className="avatar m" style={{ background: "var(--laguna)", color: "var(--verde-tabla)" }}>{initials(c.name)}</span>
      <span className="grow"><span className="t">{c.name}{c.rel && <span style={{ color: "var(--ink3)", fontWeight: 600 }}> · {c.rel}</span>}</span>
        <span className="st" style={{ whiteSpace: "normal" }}>{[c.age != null && `${c.age} años`, b && `Cumple ${b.label}`, c.allergies && `Alergia: ${c.allergies}`, R.phone && c.doc && `C.I. ${c.doc}`].filter(Boolean).join(" · ") || "Sin datos extra"}</span></span>
      {canEdit && <button className="icon-btn press" onClick={() => act(a => a.delAcomp(c.id), "Quitado de la ficha")} aria-label={`Quitar a ${c.name}`}><Icon n="close" c="s" /></button>}
    </div>; })}
    {!list.length && !open && <div className="row"><span className="st">Nadie anotado todavía.</span></div>}
    {canEdit && (open
      ? <form className="form comp-form" onSubmit={save}>
          <div className="row"><label className="k" htmlFor="cpName">Nombre</label><input id="cpName" className="field-in" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ej.: Sofía" autoFocus /></div>
          <div className="row"><label className="k" htmlFor="cpRel">Quién es</label><input id="cpRel" className="field-in" value={f.rel} onChange={e => setF({ ...f, rel: e.target.value })} placeholder="Ej.: hija, 8 años" /></div>
          <div className="row"><label className="k" htmlFor="cpBd">Cumpleaños</label><input id="cpBd" type="date" className="field-in" value={f.birthday} onChange={e => setF({ ...f, birthday: e.target.value })} /></div>
          <div className="row"><label className="k" htmlFor="cpAl">Alergias</label><input id="cpAl" className="field-in" value={f.allergies} onChange={e => setF({ ...f, allergies: e.target.value })} placeholder="Ninguna" /></div>
          <div className="row" style={{ gap: 10 }}><button type="button" className="btn small plain press" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn small press">Guardar</button></div>
        </form>
      : <button className="row press" onClick={() => setOpen(true)}><span className="ico"><Icon n="plus" c="s" /></span><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>Agregar a alguien que viene</span></span></button>)}
  </div>;
}
function NotesBox({ gid, initial, disabled }) {
  const { act } = useMC(); const [v, setV] = useState(initial || ""); const t = useRef();
  useEffect(() => setV(initial || ""), [initial]);
  return <textarea className="field-full" rows={3} disabled={disabled} value={v} placeholder="Lo que conviene saber para recibirles mejor. Se guarda solo."
    onChange={e => { setV(e.target.value); clearTimeout(t.current); const val = e.target.value; t.current = setTimeout(() => act(a => a.updateHuesped(gid, { notes: val }), null, { quiet: true }), 800); }} />;
}
export function GuestSheet({ id }) {
  const { S, role, R, act, toast } = useMC();
  const g = S.guests[id]; if (!g) return null;
  const stays = S.reservas.filter(r => r.g === id).sort((a, b) => a.in < b.in ? 1 : -1);
  const canFacts = can(role, "datosHuesped");
  const canNote = can(role, "notasHuesped");
  const save = (patch, msg = "Guardado en su ficha") => act(a => a.updateHuesped(id, patch), msg);
  const b = g.birthday && nextBirthday(g.birthday);
  const mc = {}; stays.filter(r => ["confirmada","casa","finalizada"].includes(r.state)).forEach(r => { const m = parse(r.in).getMonth(); mc[m] = (mc[m] || 0) + 1; });
  const months = Object.entries(mc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => +m).sort((x, y) => x - y);
  return <>
    <div className="res-hero" style={{ flexDirection: "column", textAlign: "center", alignItems: "center" }}><span className="avatar l" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>{initials(g.name)}</span>
      <div><h3>{g.name}</h3><div className="st">{[g.city, g.visits > 1 ? `ha venido ${g.visits} veces` : g.visits === 1 ? "vino 1 vez" : "primera vez"].filter(Boolean).join(" · ")}</div>
        <div className="tags" style={{ justifyContent: "center", marginTop: 10 }}>
          {b && <span className={`tag ${b.days <= 30 ? "gold" : ""}`}><Icon n="gift" c="xs" w="f" />Cumple {b.label}</span>}
          {g.kite && <span className="tag"><Icon n="wind" c="xs" />Hace kite</span>}
          {months.length > 0 && <span className="tag good"><Icon n="calendario" c="xs" w="f" />Suele venir en {months.map(m => MESL[m]).join(", ")}</span>}
        </div></div></div>
    {R.phone && g.phone && <div className="btns" style={{ gridTemplateColumns: "1fr 1fr" }}><a className="btn plain press" href={`https://wa.me/${g.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Icon n="chat" w="f" />WhatsApp</a><button className="btn plain press" onClick={() => copy(g.phone, toast)}><Icon n="phone" w="f" />Copiar</button></div>}

    <section className="sec"><div className="sec-h">Alergias y dietas</div>
      <TagList items={g.allergies || []} tone="warn" icon="alert" canEdit={canNote} label="Agregar alergia o dieta" placeholder="Ej.: maní, vegetariano, sin gluten" onChange={v => save({ allergies: v })} /></section>
    <section className="sec"><div className="sec-h">Le gusta</div>
      <TagList items={g.likes || []} tone="good" icon="heart" canEdit={canNote} label="Agregar algo que le gusta" placeholder="Ej.: jugo de parchita, desayuno a las 6:30" onChange={v => save({ likes: v })} /></section>
    <section className="sec"><div className="sec-h">No le gusta</div>
      <TagList items={g.dislikes || []} canEdit={canNote} label="Agregar algo que no le gusta" placeholder="Ej.: cilantro, música alta en la mañana" onChange={v => save({ dislikes: v })} />
      <p className="sec-f">Así, la próxima vez la casa ya sabe cómo recibirles.</p></section>

    <section className="sec"><div className="sec-h">Quiénes vienen</div><Companions gid={id} list={g.companions || []} canEdit={canNote} />
      <p className="sec-f">Familia, pareja o amigos: nombres, cumpleaños y alergias de cada quien.</p></section>

    <section className="sec"><div className="sec-h">Datos</div><div className="group form">
      <FactRow id="gName" label="Nombre" value={g.name} disabled={!canFacts} onSave={v => v && save({ name: v })} />
      {R.phone && <FactRow id="gPhone" label="WhatsApp" value={g.phone} disabled={!canFacts} placeholder="+58 …" onSave={v => save({ phone: v })} />}
      {R.phone && <FactRow id="gEmail" label="Correo" type="email" value={g.email} disabled={!canFacts} onSave={v => save({ email: v })} />}
      {R.phone && <FactRow id="gDoc" label="C.I. / Pasaporte" value={g.doc} disabled={!canFacts} onSave={v => save({ doc: v })} />}
      <FactRow id="gCity" label="Ciudad" value={g.city} disabled={!canFacts} onSave={v => save({ city: v })} />
      <FactRow id="gBd" label="Cumpleaños" type="date" value={g.birthday} disabled={!canFacts} onSave={v => save({ birthday: v })} />
      <FactRow id="gCel" label="Celebran" value={g.celebra} disabled={!canNote} placeholder="Ej.: aniversario" onSave={v => save({ celebra: v })} />
      <FactRow id="gPet" label="Mascota" value={g.pet} disabled={!canNote} placeholder="Ej.: Luna, salchicha" onSave={v => save({ pet: v })} />
      <div className="row"><label className="k" htmlFor="gKite">Hace kite</label><Switch id="gKite" checked={g.kite} disabled={!canNote} onChange={v => save({ kite: v }, v ? "Anotado: hace kite" : "Guardado")} /></div>
    </div></section>

    <section className="sec"><div className="sec-h">Notas internas</div><div className="group"><div className="row"><NotesBox gid={id} initial={g.notes} disabled={!canNote} /></div></div>
      <p className="sec-f">Solo las ve el equipo. El huésped nunca ve esta ficha.</p></section>

    {role !== "cocina" && stays.length > 0 && <section className="sec"><div className="sec-h">Estadías</div><div className="group res">{stays.map(r => <ResRow key={r.id} r={r} />)}</div></section>}
  </>;
}

/* ---------- Nuevo huésped (sin reserva) ---------- */
export function NewGuestSheet() {
  const { S, act, openSheet } = useMC();
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [err, setErr] = useState("");
  const known = findGuest(S, phone); const kg = known && S.guests[known];
  const submit = async e => { e.preventDefault();
    if (kg) return openSheet("guest", { id: known });
    if (!name.trim()) return setErr("Escribe el nombre.");
    let gid; const er = await act(async a => { gid = await a.crearHuesped(name.trim(), phone.trim()); }, "Ficha creada");
    if (er) setErr(er); else if (gid) openSheet("guest", { id: gid }); };
  return <form className="form" onSubmit={submit}>
    <p className="sec-f" style={{ padding: "4px 4px 0" }}>Para empezar la ficha de alguien antes de que reserve.</p>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="ngName">Nombre</label><input id="ngName" className="field-in" placeholder="Nombre del huésped" value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></div>
      <div className="row"><label className="k" htmlFor="ngPhone">WhatsApp</label><input id="ngPhone" className="field-in" placeholder="+58 …" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" /></div>
    </div>{kg && <div className="note"><Icon n="heart" c="s" w="f" /><span>Ese número ya es de <b>{kg.name}</b>. Toca el botón para abrir su ficha.</span></div>}</section>
    <Err msg={err} /><div className="btns"><button className="btn press" type="submit">{kg ? `Abrir la ficha de ${kg.name.split(" ")[0]}` : "Crear la ficha"}</button></div>
  </form>;
}

/* ---------- Nueva reserva (a mano) ---------- */
export function NewResSheet({ date }) {
  const { S, act, openSheet } = useMC();
  const din = date || day(7);
  const [f, setF] = useState({ name: "", phone: "", plan: "esencial", in: din, out: addDays(din, 2), people: 4, pet: false, channel: "Instagram", notes: "" });
  const [err, setErr] = useState("");
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const known = findGuest(S, f.phone); const kg = known && S.guests[known];
  const submit = async e => {
    e.preventDefault();
    if (!f.name.trim() && !kg) return setErr("Escribe el nombre del huésped.");
    if (!f.in || !f.out) return setErr("Elige la fecha de llegada y la de salida.");
    if (f.out <= f.in) return setErr("La salida tiene que ser después de la llegada.");
    let newId; const er = await act(async a => { newId = await a.crearReserva({ ...f, name: f.name.trim() || kg.name, guestId: known }); }, kg ? `Reserva anotada en la ficha de ${kg.name}` : "Reserva anotada");
    if (er) setErr(er); else if (newId) openSheet("res", { id: newId });
  };
  return <form className="form" onSubmit={submit}>
    <p className="sec-f" style={{ padding: "4px 4px 0" }}>Para anotar a alguien que escribió directo por WhatsApp o Instagram.</p>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="nrName">Nombre</label><input id="nrName" className="field-in" placeholder="Nombre del huésped" value={f.name} onChange={e => set("name", e.target.value)} autoComplete="off" /></div>
      <div className="row"><label className="k" htmlFor="nrPhone">WhatsApp</label><input id="nrPhone" className="field-in" placeholder="+58 …" inputMode="tel" value={f.phone} onChange={e => set("phone", e.target.value)} autoComplete="off" /></div>
    </div>{kg && <div className="note"><Icon n="heart" c="s" w="f" /><span>Es <b>{kg.name}</b>{kg.visits ? `, que ya vino ${kg.visits === 1 ? "1 vez" : `${kg.visits} veces`}` : ", que ya está en Huéspedes"}. La reserva se guarda en su ficha{(kg.allergies || []).length ? `. Alergias: ${kg.allergies.join(", ")}` : ""}.</span></div>}</section>
    <section className="sec"><div className="sec-h">Plan</div><Seg value={f.plan} onChange={v => set("plan", v)} label="Plan" options={[["esencial", "Esencial"], ["plena", "Plena"]]} /></section>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="nrIn">Llegada</label><input type="date" id="nrIn" className="field-in" value={f.in} min={TODAY} onChange={e => set("in", e.target.value)} /></div>
      <div className="row"><label className="k" htmlFor="nrOut">Salida</label><input type="date" id="nrOut" className="field-in" value={f.out} min={TODAY} onChange={e => set("out", e.target.value)} /></div>
      <div className="row"><span className="k" id="nrPeopleL">Personas</span><div className="stepper" role="group" aria-labelledby="nrPeopleL"><button type="button" onClick={() => set("people", Math.max(1, f.people - 1))} aria-label="Una persona menos">−</button><output>{f.people}</output><button type="button" onClick={() => set("people", Math.min(12, f.people + 1))} aria-label="Una persona más">+</button></div></div>
      <div className="row"><label className="k" htmlFor="nrPet">Viene con mascota</label><Switch id="nrPet" checked={f.pet} onChange={v => set("pet", v)} /></div>
    </div></section>
    <section className="sec"><div className="sec-h">Cómo nos encontró</div><Chips value={f.channel} onChange={v => set("channel", v)} label="Canal" options={CANALES.map(c => [c, c])} /></section>
    <section className="sec"><div className="group"><div className="row"><label htmlFor="nrNotes" className="sr">Notas</label><textarea id="nrNotes" className="field-full" rows={2} placeholder="¿Celebran algo? ¿Vienen a hacer kite? ¿Alguna alergia?" value={f.notes} onChange={e => set("notes", e.target.value)} /></div></div></section>
    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit">Guardar en conversación</button></div>
  </form>;
}

/* ---------- Nueva tarea / daño ---------- */
export function NewTaskSheet() {
  const { S, role, me, act, closeSheet } = useMC();
  const isDamage = role === "mantenimiento";
  const [f, setF] = useState({ title: "", area: AREAS_NUEVAS.includes(role) ? role : "operaciones", due: TODAY, res: "", who: "", file: null, preview: "" });
  const [err, setErr] = useState(""); const [sent, setSent] = useState(null);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const active = S.reservas.filter(r => ["pre","confirmada","casa"].includes(r.state));
  const people = S.team.filter(p => (p.roles || []).includes(f.area) && p.id !== me?.id);
  const submit = async e => {
    e.preventDefault(); if (!f.title.trim()) return setErr("Escribe qué hay que hacer.");
    const t = { area: f.area, title: f.title.trim(), due: f.due || TODAY, res: f.res, who: f.who || null };
    const er = await act(a => a.crearTarea({ ...t, file: f.file, damage: isDamage }), `Tarea enviada a ${AREAS[f.area].toLowerCase()}`);
    if (er) setErr(er); else setSent(t);
  };
  // Después de crearla: un toque para avisar por WhatsApp a quien le toca.
  if (sent) {
    const all = S.team.filter(p => (p.roles || []).includes(sent.area) && p.id !== me?.id);
    const list = sent.who ? all.filter(p => p.id === sent.who) : all;
    return <div className="form">
      <div className="res-hero"><span className="avatar l" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="check" c="l" w="b" /></span>
        <div><h3>Tarea creada</h3><div className="st">{AREAS[sent.area]} · para {fdate(sent.due)}</div></div></div>
      <section className="sec"><div className="sec-h">Avisar por WhatsApp</div><div className="group">
        {list.length ? list.map(p => p.phone
          ? <a key={p.id} className="row press" href={taskWa(S, sent, p)} target="_blank" rel="noreferrer"><span className="ico" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="chat" c="s" w="f" /></span><span className="grow"><span className="t">Avisar a {p.name}</span><span className="st">{p.phone}</span></span><Icon n="chev" c="s chev" /></a>
          : <div key={p.id} className="row"><span className="ico"><Icon n="chat" c="s" /></span><span className="grow"><span className="t">{p.name}</span><span className="st">No tiene WhatsApp anotado (Más › Equipo)</span></span></div>)
          : <div className="row"><span className="st">Nadie más tiene el rol de {AREAS[sent.area].toLowerCase()} todavía.</span></div>}
      </div>{list.length > 1 && <p className="sec-f">Toca a cada persona: WhatsApp abre el mensaje listo para enviar.</p>}</section>
      <div className="btns"><button className="btn plain press" onClick={closeSheet}>Listo</button></div>
    </div>;
  }
  return <form className="form" onSubmit={submit}>
    <section className="sec"><div className="group"><div className="row"><label htmlFor="tkTitle" className="sr">Qué hay que hacer</label><textarea id="tkTitle" className="field-full" rows={2} value={f.title} onChange={e => set("title", e.target.value)} placeholder={isDamage ? "Qué se dañó y dónde. Ej.: la ducha de Del Valle gotea" : "Qué hay que hacer. Ej.: hielo extra para la cava"} /></div></div></section>
    <section className="sec"><div className="sec-h">¿Para quién?</div><Chips value={f.area} onChange={v => setF(x => ({ ...x, area: v, who: "" }))} label="Área" options={AREAS_NUEVAS.map(k => [k, AREAS[k], <i className="dot" style={{ background: AREA_C[k] }} />])} /></section>
    {people.length > 0 && <section className="sec"><div className="sec-h">¿Quién la hace?</div><Chips value={f.who} onChange={v => set("who", v)} label="Persona" options={[["", "Quien la tome"], ...people.map(p => [p.id, p.name])]} /></section>}
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="tkDue">Para cuándo</label><input type="date" id="tkDue" className="field-in" value={f.due} onChange={e => set("due", e.target.value)} /></div>
      <div className="row"><label className="k" htmlFor="tkRes">Reserva</label><select id="tkRes" className="field-in" style={{ textAlignLast: "right" }} value={f.res} onChange={e => set("res", e.target.value)}><option value="">Ninguna</option>{active.map(r => <option key={r.id} value={r.id}>{S.guests[r.g]?.name}</option>)}</select></div>
    </div></section>
    <section className="sec"><div className="sec-h">Foto {isDamage ? "" : "(opcional)"}</div><div className="group"><label className="row press" htmlFor="tkPhoto" style={{ cursor: "pointer" }}><span className="ico"><Icon n="camera" c="s" w="f" /></span><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>{f.file ? "Cambiar la foto" : "Tomar o elegir una foto"}</span></span>
      <input type="file" id="tkPhoto" accept="image/*" capture="environment" className="sr" onChange={e => { const file = e.target.files[0]; if (file) setF(x => ({ ...x, file, preview: URL.createObjectURL(file) })); }} /></label></div>{f.preview && <img className="photo-prev" src={f.preview} alt="Foto adjunta" />}</section>
    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit">{isDamage ? "Enviar el reporte" : "Crear la tarea"}</button></div>
  </form>;
}

/* ---------- Bloqueo ---------- */
export function BlockSheet() {
  const { act, closeSheet } = useMC();
  const [f, setF] = useState({ from: day(1), to: day(2), reason: "" }); const [err, setErr] = useState("");
  const submit = async e => { e.preventDefault(); if (!f.from || !f.to || f.to <= f.from) return setErr("El final tiene que ser después del inicio.");
    const er = await act(a => a.addBloqueo({ ...f, reason: f.reason.trim() || "Mantenimiento" }), "Fechas bloqueadas"); if (er) setErr(er); else closeSheet(); };
  return <form className="form" onSubmit={submit}><p className="sec-f" style={{ padding: "4px 4px 0" }}>Mientras estén bloqueadas, nadie puede apartar esas noches.</p>
    <section className="sec"><div className="group"><div className="row"><label className="k" htmlFor="blFrom">Desde</label><input type="date" id="blFrom" className="field-in" value={f.from} min={TODAY} onChange={e => setF({ ...f, from: e.target.value })} /></div><div className="row"><label className="k" htmlFor="blTo">Hasta</label><input type="date" id="blTo" className="field-in" value={f.to} min={TODAY} onChange={e => setF({ ...f, to: e.target.value })} /></div></div></section>
    <section className="sec"><div className="group"><div className="row"><label htmlFor="blWhy" className="sr">Motivo</label><input id="blWhy" className="field-full" placeholder="Motivo. Ej.: arreglo del techo de caña" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div></div></section>
    <Err msg={err} /><div className="btns"><button className="btn press" type="submit"><Icon n="lock" w="f" />Bloquear</button></div></form>;
}

// Enlace de WhatsApp con el aviso de una tarea para una persona del equipo.
export function taskWa(S, t, p) {
  const r = t.res && S.reservas.find(x => x.id === t.res);
  const txt = `Hola ${p.name.split(" ")[0]}, tienes una tarea en Maracuyá Control:\n• ${t.title}\n📅 ${fdate(t.due)}${r ? `\n🏠 Reserva de ${S.guests[r.g]?.name} (${frange(r.in, r.out)})` : ""}\n\nEntra en casa-maracuya.com/admin para tomarla o marcarla.`;
  return `https://wa.me/${(p.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(txt)}`;
}

/* ---------- Detalle de tarea ---------- */
export const taskStatus = t => t.done ? "hecha" : t.doing ? "proceso" : "pendiente";
export function TaskSheet({ id }) {
  const { S, role, me, act, openSheet } = useMC();
  const t = S.tasks.find(x => x.id === id);
  if (!t) return <p className="sec-f">Esta tarea ya no existe.</p>;
  const r = t.res && S.reservas.find(x => x.id === t.res);
  const boss = can(role, "supervisar");
  const mine = me && t.who === me.id;
  const canWork = boss || role === t.area;
  const people = S.team.filter(p => (p.roles || []).includes(t.area));
  const who = S.team.find(p => p.id === t.who); const by = S.team.find(p => p.id === t.doneBy);
  const st = taskStatus(t);
  const setSt = v => act(a => v === "hecha" ? a.setTarea(t.id, true) : v === "proceso" ? a.enProceso(t.id, true) : (t.done ? a.setTarea(t.id, false) : a.enProceso(t.id, false)),
    v === "hecha" ? "¡Hecho!" : v === "proceso" ? "En proceso" : "Pendiente otra vez");
  return <>
    <div className="res-hero" style={{ alignItems: "flex-start" }}><span className="avatar l" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}><Icon n={t.damage ? "camera" : "tareas"} c="l" w="f" /></span>
      <div style={{ minWidth: 0 }}><h3 style={{ whiteSpace: "normal" }}>{t.title}</h3><div className="st">{AREAS[t.area]} · para {fdate(t.due)}{t.time ? ` · ${t.time}` : ""}</div></div></div>
    {t.photo && <a href={t.photo} target="_blank" rel="noreferrer"><img className="photo-prev" src={t.photo} alt="Foto del reporte" /></a>}

    <section className="sec"><div className="sec-h">Estado</div>
      {canWork ? <Seg value={st} onChange={setSt} label="Estado de la tarea" options={[["pendiente", "Pendiente"], ["proceso", "En proceso"], ["hecha", "Hecha"]]} />
        : <div className="group"><div className="row"><span className="t">{{ pendiente: "Pendiente", proceso: "En proceso", hecha: "Hecha" }[st]}</span></div></div>}
      {t.done && <p className="sec-f">Hecha{by ? ` por ${by.name}` : ""}{t.doneAt ? ` ${ago(t.doneAt)}` : ""}.</p>}</section>

    <section className="sec"><div className="sec-h">Quién la hace</div>
      {boss ? <Chips value={t.who || ""} onChange={v => act(a => a.asignarTarea(t.id, v || null), v ? `Asignada a ${S.team.find(p => p.id === v)?.name}` : "Sin asignar")} label="Asignar a"
          options={[["", "Sin asignar"], ...people.map(p => [p.id, p.name])]} />
        : <div className="group"><div className="row"><span className="grow"><span className="t">{who ? (mine ? "Tú" : who.name) : "Nadie todavía"}</span>{!who && <span className="st">Puedes tomarla si te toca hacerla.</span>}</span>
            {canWork && !t.done && !who && <button className="btn small press" onClick={() => act(a => a.asignarTarea(t.id, "me"), "La tomaste")}>Tomarla</button>}
            {canWork && !t.done && mine && <button className="btn small plain press" onClick={() => act(a => a.asignarTarea(t.id, null), "La soltaste")}>Soltarla</button>}</div></div>}
      {boss && !people.length && <p className="sec-f">Nadie tiene el rol de {AREAS[t.area].toLowerCase()} todavía. Asígnalo en Más › Equipo.</p>}
    </section>

    {boss && who && <section className="sec"><div className="group">
      {who.phone ? <a className="row press" href={taskWa(S, t, who)} target="_blank" rel="noreferrer"><span className="ico" style={{ background: "var(--good-bg)", color: "var(--good)" }}><Icon n="chat" c="s" w="f" /></span><span className="grow"><span className="t">Avisar a {who.name.split(" ")[0]} por WhatsApp</span></span><Icon n="chev" c="s chev" /></a>
        : <div className="row"><span className="st">{who.name} no tiene WhatsApp anotado. Dirección lo agrega en Más › Equipo.</span></div>}
    </div></section>}

    {r && <section className="sec"><div className="sec-h">Reserva</div><div className="group res"><ResRow r={r} /></div></section>}
  </>;
}

/* ---------- Rol (qué ve / hace / recibe) ---------- */
export function RoleSheet({ id }) {
  const { S } = useMC(); const r = ROLES[id]; const people = S.team.filter(p => (p.roles || []).includes(id));
  return <>
    <div className="res-hero" style={{ flexDirection: "column", alignItems: "center", textAlign: "center" }}><span className="avatar l" style={{ background: `var(--r-${id})`, color: `var(--r-${id}-ink)` }}><Icon n={r.icon} c="l" w="d" /></span><div><h3>{r.name}</h3><div className="st">{r.sub}</div></div></div>
    <section className="sec"><div className="group kv"><KV k="Reporta a" v={r.jefe ? ROLES[r.jefe].name : "Nadie: es la máxima autoridad"} />
      {Object.entries(ROLES).some(([, x]) => x.jefe === id && !x.legacy) && <KV k="Le reportan" v={Object.entries(ROLES).filter(([, x]) => x.jefe === id && !x.legacy).map(([, x]) => x.name).join(", ")} />}</div></section>
    <section className="sec"><div className="sec-h">Ve</div><div className="group"><div className="row"><span className="grow" style={{ whiteSpace: "normal" }}>{r.ve}</span></div></div></section>
    <section className="sec"><div className="sec-h">Hace</div><div className="group">{r.hace.map(h => <div key={h} className="row"><span className="ico"><Icon n="check" c="s" w="b" /></span><span className="grow" style={{ whiteSpace: "normal" }}>{h}</span></div>)}</div></section>
    <section className="sec"><div className="sec-h">Recibe</div><div className="group"><div className="row"><span className="grow" style={{ whiteSpace: "normal" }}>{r.recibe}</span></div></div></section>
    <section className="sec"><div className="sec-h">Personas</div><div className="group">{people.length ? people.map(p => <div key={p.id} className="row"><span className="grow"><span className="t">{p.name}</span></span></div>) : <div className="row"><span className="st">Nadie todavía</span></div>}</div></section>
    <section className="sec"><div className="group kv"><KV k="Ve montos y pagos" v={r.money ? "Sí" : "No"} /><KV k="Ve teléfonos" v={r.phone ? "Sí" : "No"} /></div></section>
  </>;
}

/* ---------- Persona: roles ---------- */
export function PersonSheet({ id }) {
  const { S, act, closeSheet } = useMC();
  const p = S.team.find(x => x.id === id);
  const [roles, setRoles] = useState(p ? p.roles || [] : []); const [tel, setTel] = useState(p ? p.phone || "" : ""); const [err, setErr] = useState("");
  const toggle = (k, v) => setRoles(rs => v ? [...new Set([...rs, k])] : rs.filter(x => x !== k));
  if (!p) return null;
  const submit = async e => { e.preventDefault();
    const er = await act(async a => { await a.setRoles(p.id, roles); if (tel.trim() !== (p.phone || "")) await a.setTelefono(p.id, tel.trim()); }, "Guardado");
    if (er) setErr(er); else closeSheet(); };
  return <form className="form" onSubmit={submit}>
    <div className="res-hero"><div><h3>{p.name}</h3><div className="st">Elige qué puede ver y hacer en el panel.</div></div></div>
    <section className="sec"><div className="group"><div className="row"><label className="k" htmlFor="psTel">WhatsApp</label><input id="psTel" className="field-in" inputMode="tel" placeholder="+58 …" value={tel} onChange={e => setTel(e.target.value)} autoComplete="off" /></div></div><p className="sec-f">Para avisarle por WhatsApp cuando le asignes una tarea.</p></section>
    <section className="sec"><div className="sec-h">Roles</div><div className="group">{Object.entries(ROLES).filter(([k, r]) => !r.legacy || (p.roles || []).includes(k)).map(([k, r]) =>
      <div key={k} className="row"><span className="avatar" style={{ background: `var(--r-${k})`, color: `var(--r-${k}-ink)` }}><Icon n={r.icon} c="s" w="d" /></span><label className="k" htmlFor={`ps-${k}`}>{r.name}</label><Switch id={`ps-${k}`} checked={roles.includes(k)} onChange={v => toggle(k, v)} /></div>)}</div><p className="sec-f">Una persona puede tener dos roles. Sin ningún rol, no puede entrar al panel.</p></section>
    <Err msg={err} /><div className="btns"><button className="btn press" type="submit">Guardar</button></div>
  </form>;
}

/* ---------- Perfil ---------- */
export function ProfileSheet() {
  const { me, role, setRole, signOut, closeSheet, openTour } = useMC();
  const roles = me?.roles || [];
  return <>
    {me && <div className="res-hero"><span className="avatar l" style={{ background: "var(--accent-bg)", color: "var(--accent-ink)" }}>{initials(me.name)}</span><div><h3>{me.name}</h3><div className="st">{me.email}</div></div></div>}
    {roles.length > 1 && <><p className="sec-f" style={{ padding: "14px 4px 0" }}>Tienes más de un rol. Elige con cuál quieres trabajar ahora.</p>
      <section className="sec"><div className="group inset-av">{roles.map(k => { const r = ROLES[k]; return (
        <button key={k} className="row press" onClick={() => { setRole(k); closeSheet(); }}><span className="avatar m" style={{ background: `var(--r-${k})`, color: `var(--r-${k}-ink)` }}><Icon n={r.icon} c="s" w="d" /></span><span className="grow"><span className="t">{r.name}</span><span className="st">{r.sub}</span></span>{k === role && <span style={{ color: "var(--accent-ink)" }}><Icon n="check" w="b" /></span>}</button>); })}</div></section></>}
    <section className="sec"><div className="group">
      <button className="row press" onClick={openTour}><span className="grow"><span className="t">Cómo funciona el panel</span><span className="st">El recorrido de bienvenida, paso a paso</span></span><Icon n="chev" c="s chev" /></button>
      <a className="row press" href="/" ><span className="grow"><span className="t">Ver la página web</span></span><Icon n="chev" c="s chev" /></a>
      <button className="row press" onClick={signOut}><span className="grow"><span className="t" style={{ color: "var(--accent-ink)" }}>Cerrar sesión</span></span></button>
    </div></section>
  </>;
}

import { BudgetSheet } from "./docs.jsx";
export const SHEETS = {
  budget: ["Presupuesto", BudgetSheet],
  res: ["Reserva", ResSheet], pay: ["Registrar pago", PaySheet], guest: ["Huésped", GuestSheet], newRes: ["Nueva reserva", NewResSheet],
  newTask: ["Nueva tarea", NewTaskSheet], block: ["Bloquear fechas", BlockSheet], task: ["Tarea", TaskSheet], newGuest: ["Nuevo huésped", NewGuestSheet],
  role: ["Rol", RoleSheet], person: ["Persona", PersonSheet], profile: ["Perfil", ProfileSheet], ficha: ["Ficha de registro", FichaSheet], total: ["Total y concepto", TotalSheet]
};
