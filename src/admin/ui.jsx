import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { PH } from "./icons-data.js";
import { STATE, PLAN, AREAS, AREA_C, TODAY, MES, parse, nights, ago, rel, can } from "./util.js";

export const Ctx = createContext(null);
export const useMC = () => useContext(Ctx);

// Íconos Phosphor: w = r (normal), f (relleno), d (duotono), b (negrita = check)
export function Icon({ n, c = "", w = "r" }) {
  const set = PH[n] || PH.check;
  return <svg className={`i ${c}`} viewBox="0 0 256 256" aria-hidden="true" dangerouslySetInnerHTML={{ __html: set[w === "b" ? "f" : w] || set.r }} />;
}
export const Pill = ({ s }) => <span className={`pill ${s}`}>{STATE[s]}</span>;
export function Empty({ icon, children }) {
  return <div className="empty"><Icon n={icon} c="xl" w="d" /><div>{children}</div></div>;
}

// Banda de encabezado: cada vista la «pinta» arriba con un portal.
export function Head({ title, lead, eyebrow, children }) {
  const { bandEl } = useMC();
  if (!bandEl) return null;
  return createPortal(
    <div className="wrap">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1 className="large">{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </div>, bandEl);
}

export function ResRow({ r, extra }) {
  const { S, openSheet } = useMC();
  const g = S.guests[r.g] || { name: "Huésped" }; const n = nights(r); const d = parse(r.in);
  return (
    <button className="row press" onClick={() => openSheet("res", { id: r.id })}>
      <span className={`dbox st-${r.state}`}><b>{d.getDate()}</b><span>{MES[d.getMonth()]}</span></span>
      <span className="grow">
        <span className="t">{g.name}</span>
        <span className="st">{n} {n === 1 ? "noche" : "noches"} · {PLAN[r.plan].short} · {r.people} pers.{r.pet && <> · <Icon n="paw" c="xs" /></>}</span>
        {extra}
      </span>
      {r.state === "nueva"
        ? <span style={{ display: "grid", justifyItems: "end", gap: 4 }}><Pill s={r.state} /><small style={{ color: "var(--ink3)", fontSize: 12, fontWeight: 600 }}>{ago(r.created)}</small></span>
        : <Pill s={r.state} />}
    </button>
  );
}

export function TaskRow({ t }) {
  const { S, role, me, act, openSheet } = useMC();
  const [pop, setPop] = useState(false);
  const r = t.res && S.reservas.find(x => x.id === t.res);
  const late = !t.done && t.due < TODAY;
  const showArea = can(role, "supervisar");
  const who = t.who && S.team.find(p => p.id === t.who);
  const mine = me && t.who === me.id;
  const canTake = !t.done && !t.who && role === t.area;
  const subs = [r && S.guests[r.g]?.name, t.time, !late && t.due !== TODAY ? rel(t.due) : ""].filter(Boolean);
  const toggle = () => { setPop(true); setTimeout(() => setPop(false), 400); act(a => a.setTarea(t.id, !t.done), !t.done ? "¡Hecho!" : null); };
  return (
    <div className={`row task ${t.done ? "done" : ""} ${t.doing ? "doing" : ""}`} style={{ "--inset": "62px" }}>
      <button className={`check press ${pop ? "pop" : ""}`} role="checkbox" aria-checked={t.done} aria-label={`Marcar como hecha: ${t.title}`} onClick={toggle} style={{ "--c": AREA_C[t.area] }}><Icon n="check" w="b" /></button>
      <button className="grow task-open" onClick={() => openSheet("task", { id: t.id })} aria-label={`Ver la tarea: ${t.title}`}>
        {showArea && <span className="area-lb"><i className="dot" style={{ background: AREA_C[t.area], marginRight: 6 }} />{AREAS[t.area]}</span>}
        <span className="t" style={{ whiteSpace: "normal" }}>{t.damage && <span style={{ color: "var(--danger)" }}><Icon n="camera" c="xs" w="f" /> </span>}{t.title}</span>
        {(subs.length > 0 || late) && <span className="st">{subs.join(" · ")}{late && <span style={{ color: "var(--danger)", fontWeight: 700 }}>{subs.length ? " · " : ""}Atrasada · {rel(t.due)}</span>}</span>}
        {!t.done && (t.doing || who) && <span className="who-lb">{t.doing && <span className="doing-pill">En proceso</span>}{who && <span>{mine ? "Tú" : who.name.split(" ")[0]}</span>}</span>}
      </button>
      {canTake && <button className="btn small plain press take" onClick={() => act(a => a.asignarTarea(t.id, "me"), "La tomaste")}>Tomar</button>}
      {t.photo && <a href={t.photo} target="_blank" rel="noreferrer"><img src={t.photo} alt="Foto del reporte" style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover" }} /></a>}
    </div>
  );
}

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}
export function Chips({ value, onChange, options, label, form }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([k, l, extra]) => <button key={k} type="button" className="chip press" aria-pressed={value === k} onClick={() => onChange(k)}>{extra}{l}</button>)}
    </div>
  );
}
export function Switch({ id, checked, onChange, label, disabled }) {
  return <label className="switch"><input type="checkbox" id={id} checked={!!checked} disabled={disabled} aria-label={label} onChange={e => onChange(e.target.checked)} /><span /></label>;
}
// Dirección, Operaciones y Calidad supervisan: ven las tareas de todas las áreas.
export const myTasks = (S, role) => can(role, "supervisar") ? S.tasks : S.tasks.filter(t => t.area === role);
