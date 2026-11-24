// Cobros (migración 0017): código de reserva, pago con comprobante, cotización con código,
// cobros en espera de aprobación e historial de cada cliente.
import { useState, useEffect } from "react";
import { useMC, Icon, Seg, Chips, Switch, Err, KV, copy } from "./ui.jsx";
import { TODAY, PLAN, METODOS, METODO_MONEDA, CANALES, addDays, diff, day, fdate, frange, money, ago, nights } from "./util.js";
import { findGuest } from "../lib/api.js";

// Código de reserva CM-XXXXXX: la llave del huésped para todo lo demás (0017).
export function LocCard({ r, first, wa }) {
  const { toast } = useMC();
  const msg = r.lang === "en"
    ? `Hi ${first}! Your stay at Casa Maracuyá is confirmed ✨\nYour booking code is *${r.loc}*. Keep it: you will need it for everything during your stay.`
    : `¡Hola ${first}! Tu reserva en Casa Maracuyá está confirmada ✨\nTu código de reserva es *${r.loc}*. Guárdalo: lo vas a necesitar para todo durante tu estadía.`;
  return <div className="loc-card">
    <span className="loc-k">Código de reserva</span>
    <span className="loc-v" aria-label={`Código de reserva ${r.loc.split("").join(" ")}`}>{r.loc}</span>
    <div className="loc-b">
      <button className="btn small plain press" onClick={() => copy(r.loc, toast)}><Icon n="copy" w="f" />Copiar</button>
      <a className="btn small plain press" href={`${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><Icon n="chat" w="f" />Enviar por WhatsApp</a>
    </div>
  </div>;
}


// Un pago con su prueba: método, referencia o quién tiene el efectivo, y el comprobante.
export function PayRow({ p }) {
  const { act, toast } = useMC();
  const open = async () => { const w = window.open("", "_blank"); let url = null; await act(async a => { url = await a.verComprobante(p.proof); }, null, { quiet: true });
    if (url && w) w.location = url; else { w?.close(); toast("No se pudo abrir el comprobante"); } };
  const det = [p.method, p.currency === "Bs" && p.orig ? `Bs. ${p.orig.toLocaleString("es-VE")} a ${p.rate}` : "", p.ref ? `Ref. ${p.ref}` : "", p.cashWith ? `lo tiene ${p.cashWith}` : "", fdate(p.date)].filter(Boolean).join(" · ");
  return <div className="row"><span className="ico"><Icon n="check" c="s" w="b" /></span><span className="grow"><span className="t">{p.kind} · {money(p.amount)}</span><span className="st">{det}</span></span>
    {p.proof && <button type="button" className="btn small plain press" onClick={open}>Ver comprobante</button>}</div>;
}

// Campos del pago (método, monto, Bs. con tasa, referencia o efectivo, comprobante). Los usan
// «Registrar pago» y «Reserva pagada». tot: total de la estadía; before: lo ya pagado.
// La cotización: el código trae lo que se cobra. ctx: { plan, in, out, quoteId } de la reserva.
const normCot = c => { const x = c.toUpperCase().replace(/[^A-Z0-9]/g, ""); return x ? (x.startsWith("COT") ? `COT-${x.slice(3)}` : `COT-${x}`) : ""; };
function useQuote(ctx, totIn, after) {
  const { S } = useMC();
  const linked = ctx.quoteId && (S.quotes || []).find(q => q.id === ctx.quoteId);
  const [code, setCode] = useState(linked ? linked.code : "");
  const [ok, setOk] = useState(!!linked);
  const [reason, setReason] = useState("");
  const q = code.trim() ? (S.quotes || []).find(x => x.code === normCot(code)) : null;
  const qTotal = q ? q.totals[ctx.plan] : null;
  const tot = ok && qTotal ? qTotal : totIn;
  const diffs = [];
  if (!code.trim()) diffs.push("No tiene cotización");
  else if (!q) diffs.push(`No encuentro la cotización ${normCot(code)}`);
  else {
    if (q.until < TODAY && q.id !== ctx.quoteId) diffs.push(`La cotización venció el ${fdate(q.until)}`);
    if (q.in && (q.in !== ctx.in || q.out !== ctx.out)) diffs.push(`La cotización es del ${frange(q.in, q.out)}`);
    if (qTotal == null) diffs.push(`La cotización no incluye el plan ${PLAN[ctx.plan]?.short || ctx.plan}`);
    else { if (tot > 0 && tot !== qTotal) diffs.push(`El total cotizado es ${money(qTotal)}`); if (after > qTotal) diffs.push(`Con este pago se cobraría ${money(after)}, más que los ${money(qTotal)} cotizados`); }
  }
  const view = <section className="sec"><div className="sec-h">Cotización</div>
    <div className="group"><div className="row"><label className="k" htmlFor="payCot">Código</label><input id="payCot" className="field-in" value={code} onChange={e => { setCode(e.target.value); setOk(false); }} placeholder="COT-48K2" autoComplete="off" autoCapitalize="characters" style={{ textTransform: "uppercase" }} /></div></div>
    {q && qTotal != null && <div className={`quote ${ok ? "ok" : ""}`}>
      <div className="q-h"><b>{q.code}</b><span>{q.name} · {q.in ? frange(q.in, q.out) : `${q.nights} noches`}{q.people ? ` · ${q.people} personas` : ""} · vence {fdate(q.until)}</span></div>
      <div className="q-t"><span>Se cobra · {PLAN[ctx.plan]?.short}</span><b>{money(qTotal)}</b></div>
      {ok ? <span className="q-ok"><Icon n="check" c="s" w="b" />Confirmado: el total es el de la cotización</span>
        : <button type="button" className="btn small press" onClick={() => setOk(true)}><Icon n="check" w="b" />Confirmar lo que se cobra</button>}
    </div>}
    {diffs.length > 0 && <div className="quote warn"><div className="q-h"><Icon n="alert" c="s" w="f" /><b>El cobro no coincide</b></div>
      <ul>{diffs.map(d => <li key={d}>{d}</li>)}</ul>
      <label htmlFor="payWhy" className="q-l">Motivo para Administración</label>
      <textarea id="payWhy" className="field-full" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej.: precio especial acordado por teléfono" />
      <p className="q-f">El pago queda en espera hasta que Administración lo apruebe.</p></div>}
  </section>;
  return { view, tot, diffs, reason, code: q ? q.code : normCot(code), locked: ok && qTotal != null };
}

function usePay(tot, before, opens) {
  const { me } = useMC();
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState(METODOS[0]);
  const [cur, setCur] = useState("Bs");                 // solo para Transferencia
  const [rate, setRate] = useState("");
  const [ref, setRef] = useState("");
  const [cashWith, setCashWith] = useState(me?.name || "");
  const [file, setFile] = useState(null); const [preview, setPreview] = useState("");
  const num = v => { const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? NaN : n; };
  const numUsd = v => Number(String(v).replace(",", "."));
  const moneda = METODO_MONEDA[method] || cur; const bs = moneda === "Bs"; const cash = method.startsWith("Efectivo");
  const usd = bs ? (num(amt) > 0 && numUsd(rate) > 0 ? Math.round(num(amt) / numUsd(rate) * 100) / 100 : NaN) : numUsd(amt);
  const after = before + (usd > 0 ? usd : 0); const falta = tot > 0 ? Math.max(tot - after, 0) : NaN;
  const confirms = opens && tot > 0 && after >= tot;
  const pick = e => { const f = e.target.files[0]; if (!f) return; setFile(f); setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : ""); };
  const check = () => {
    if (!(tot > 0)) return "Escribe el total de la estadía.";
    if (bs && !(num(amt) > 0)) return "Escribe el monto en bolívares.";
    if (bs && !(numUsd(rate) > 0)) return "Escribe la tasa del día (Bs. por cada dólar).";
    if (!(usd > 0)) return "Escribe el monto que recibiste.";
    if (!cash && ref.trim().length < 4) return "Escribe la referencia del pago.";
    if (cash && cashWith.trim().length < 2) return "Anota quién tiene el dinero en efectivo.";
    if (!file) return cash ? "Sube la foto del recibo firmado por el cliente." : "Sube el comprobante del pago.";
    return "";
  };
  const payload = path => ({ monto: bs ? null : usd, metodo: method, moneda, monto_original: bs ? num(amt) : null, tasa: bs ? numUsd(rate) : null,
    referencia: cash ? "" : ref.trim(), comprobante: path, efectivo_lo_tiene: cash ? cashWith.trim() : "", total: tot });
  const summary = <div className="pay-sum" aria-live="polite">
    <div><span>Total</span><b>{tot > 0 ? money(tot) : "—"}</b></div>
    <div><span>Pagado</span><b>{money(after)}</b></div>
    <div className={falta > 0 ? "due" : "ok"}><span>{falta > 0 ? "Falta" : "Completo"}</span><b>{falta > 0 ? money(falta) : tot > 0 ? "100 %" : "—"}</b></div>
  </div>;
  const fields = <>
    <section className="sec"><div className="sec-h">Cómo pagó</div><Chips value={method} onChange={setMethod} label="Método de pago" options={METODOS.map(m => [m, m])} />
      {method === "Transferencia" && <div style={{ marginTop: 10 }}><Seg value={cur} onChange={setCur} label="Moneda" options={[["Bs", "En bolívares"], ["USD", "En dólares"]]} /></div>}</section>
    <section className="sec"><div className="group">
      <div className="row"><label className="k" htmlFor="payAmt">{bs ? "Monto en Bs." : "Monto recibido"}</label><span style={{ color: "var(--ink3)" }}>{bs ? "Bs." : "$"}</span><input id="payAmt" className="field-in" inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} style={{ maxWidth: 140, color: "var(--ink)" }} /></div>
      {bs && <div className="row"><label className="k" htmlFor="payRate">Tasa del día</label><span style={{ color: "var(--ink3)" }}>Bs./$</span><input id="payRate" className="field-in" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} style={{ maxWidth: 140, color: "var(--ink)" }} /></div>}
      {bs && <div className="row"><span className="k">Equivale a</span><span className="val">{usd > 0 ? money(usd) : "—"}</span></div>}
      {!cash && <div className="row"><label className="k" htmlFor="payRef">Referencia</label><input id="payRef" className="field-in" value={ref} onChange={e => setRef(e.target.value)} autoComplete="off" placeholder={method === "Binance (USDT)" ? "ID de la orden" : "Número de referencia"} /></div>}
      {cash && <div className="row"><label className="k" htmlFor="payCash">Quién tiene el dinero</label><input id="payCash" className="field-in" value={cashWith} onChange={e => setCashWith(e.target.value)} autoComplete="off" /></div>}
    </div></section>
    <section className="sec"><div className="sec-h">{cash ? "Recibo firmado por el cliente" : "Comprobante"}</div>
      <label className="proof press" htmlFor="payProof">
        {preview ? <img src={preview} alt="Comprobante adjunto" /> : <span className="ico"><Icon n={file ? "check" : "camera"} c="s" /></span>}
        <span className="grow"><span className="t">{file ? (preview ? "Cambiar la foto" : file.name) : cash ? "Foto del recibo firmado" : "Subir foto o PDF del comprobante"}</span>
          <span className="st">{cash ? "El cliente firma el recibo de caja y le tomas una foto" : "Captura de la transferencia, pago móvil, Zelle o Binance"}</span></span>
        <input type="file" id="payProof" accept="image/*,application/pdf" className="sr" onChange={pick} /></label></section>
  </>;
  return { summary, fields, check, payload, file, confirms, falta, after };
}

// Después de confirmar: el comprobante sale solo por correo y se avisa el código.
async function afterConfirm(act, toast, id, res) {
  await act(async a => { const c = await a.enviarComprobante(id);
    toast(`Confirmada · ${res.localizador || ""}. ${c?.sinCorreo ? "No tiene correo anotado: envíale el código por WhatsApp" : `Comprobante enviado a ${c.to}`}`); }, null);
}

/* ---------- Historial del cliente (solo Dirección): la bitácora que nadie puede borrar ---------- */
const H_STATE = { nueva: "Nueva", conversacion: "En conversación", pre: "Apartada", confirmada: "Confirmada", casa: "En casa", finalizada: "Salió", rechazada: "Sin cupo", vencida: "Vencida", cancelada: "Cancelada" };
export function histLine(e, S) {
  const c = e.cambios || {}; const ch = k => Array.isArray(c[k]) ? c[k] : null; const m = v => money(+v || 0);
  const res = e.reserva_id && S.reservas.find(r => r.id === e.reserva_id); const tag = res ? ` · ${res.loc || res.code}` : "";
  if (e.tabla === "reservas") {
    if (e.accion === "insert") return { t: `Reserva creada${tag}`, s: `${frange(c.llegada, c.salida)} · ${c.personas} personas · llegó por ${c.canal}` };
    if (e.accion === "delete") return { t: `Reserva borrada${tag}`, s: `${frange(c.llegada, c.salida)}`, raro: true };
    const out = []; let raro = false;
    if (ch("estado")) { out.push(`${H_STATE[ch("estado")[0]] || ch("estado")[0]} → ${H_STATE[ch("estado")[1]] || ch("estado")[1]}`); if (ch("estado")[1] === "cancelada") raro = true; }
    if (ch("localizador") && ch("localizador")[1]) out.push(`código ${ch("localizador")[1]}`);
    if (ch("total")) { out.push(`total ${m(ch("total")[0])} → ${m(ch("total")[1])}`); if (+ch("total")[0] > 0) raro = true; }
    if (ch("pagado")) out.push(`pagado ${m(ch("pagado")[0])} → ${m(ch("pagado")[1])}`);
    if (ch("llegada") || ch("salida")) out.push("cambiaron las fechas");
    if (ch("personas")) out.push(`personas ${ch("personas")[0]} → ${ch("personas")[1]}`);
    if (ch("plan")) out.push(`plan ${ch("plan")[0]} → ${ch("plan")[1]}`);
    if (ch("cotizacion_id")) out.push("se unió a su cotización");
    return out.length ? { t: `Reserva${tag}`, s: out.join(" · "), raro } : null;
  }
  if (e.tabla === "pagos") {
    if (e.accion === "insert") return { t: `Pago ${m(c.monto)}${tag}`, s: [c.metodo, c.moneda === "Bs" ? `Bs. ${c.monto_original} a ${c.tasa}` : "", c.referencia ? `Ref. ${c.referencia}` : "", c.efectivo_lo_tiene ? `efectivo con ${c.efectivo_lo_tiene}` : ""].filter(Boolean).join(" · ") };
    return { t: e.accion === "delete" ? `Pago borrado${tag}` : `Pago modificado${tag}`, s: Object.keys(c).join(", "), raro: true };
  }
  if (e.tabla === "cotizaciones") {
    if (e.accion === "insert") return { t: `Cotización ${c.codigo}`, s: `${Object.entries(c.totales || {}).map(([k, v]) => `${PLAN[k]?.short || k} ${m(v)}`).join(" · ")}${c.llegada ? ` · ${frange(c.llegada, c.salida)}` : ""} · vence ${fdate(c.vence)}` };
    if (ch("reserva_id")) return { t: "Cotización unida a la reserva" + tag, s: "" };
    return { t: "Cotización modificada", s: Object.keys(c).join(", "), raro: true };
  }
  if (e.tabla === "aprobaciones") {
    if (e.accion === "insert") return { t: `Cobro fuera de lo normal${tag}`, s: `${c.detalle} · motivo: ${c.motivo}`, raro: true };
    if (ch("estado")) return { t: `Cobro ${ch("estado")[1] === "aprobada" ? "aprobado" : ch("estado")[1] === "rechazada" ? "rechazado" : ch("estado")[1]}${tag}`, s: c.nota ? (Array.isArray(c.nota) ? c.nota[1] : c.nota) : "", raro: ch("estado")[1] === "rechazada" };
    return null;
  }
  if (e.tabla === "huespedes") {
    if (e.accion === "insert") return { t: "Cliente registrado", s: [c.telefono, c.email].filter(Boolean).join(" · ") };
    const k = Object.keys(c).map(x => ({ nombre: "nombre", telefono: "teléfono", email: "correo", documento: "documento" }[x] || x));
    return { t: "Cambiaron sus datos", s: k.join(", "), raro: Object.keys(c).some(x => Array.isArray(c[x]) && (x === "documento" ? c[x][0] === "anterior" : ["telefono","email"].includes(x) && c[x][0])) };
  }
  return null;
}
export function HistorySheet({ id }) {
  const { S, act } = useMC();
  const g = S.guests[id] || { name: "Cliente" };
  const [rows, setRows] = useState(null); const [only, setOnly] = useState("todo");
  useEffect(() => { let on = true; act(async a => { const d = await a.historial(id); if (on) setRows(d); }, null, { quiet: true }).then(er => { if (er && on) setRows([]); }); return () => { on = false; }; }, [id]);
  const who = uid => uid ? ((S.team.find(p => p.id === uid) || {}).name || "Alguien del equipo") : "El sistema";
  const items = (rows || []).map(e => ({ e, l: histLine(e, S) })).filter(x => x.l && (only === "todo" || x.l.raro));
  return <div className="form">
    <div className="res-hero" style={{ paddingBottom: 6 }}><div><h3>{g.name}</h3><div className="st">Todo lo que pasó con este cliente. Nadie puede borrar ni cambiar este historial.</div></div></div>
    <Seg value={only} onChange={setOnly} label="Mostrar" options={[["todo", "Todo"], ["raro", "Fuera de lo normal"]]} />
    <section className="sec">{rows == null ? <p className="sec-f">Cargando…</p> : items.length ? <div className="group hist">{items.map(({ e, l }) => <div key={e.id} className={`row ${l.raro ? "raro" : ""}`}>
      <span className="ico">{l.raro ? <Icon n="alert" c="s" w="f" /> : <Icon n="check" c="s" w="b" />}</span>
      <span className="grow"><span className="t">{l.t}</span>{l.s && <span className="st">{l.s}</span>}<span className="st">{who(e.quien)} · {new Date(e.cuando).toLocaleString("es-VE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></span></div>)}</div>
      : <p className="sec-f">{only === "raro" ? "Nada fuera de lo normal con este cliente." : "Todavía no hay movimientos anotados."}</p>}</section>
  </div>;
}

/* ---------- Cobro en espera: Administración o Dirección lo aprueba o lo rechaza ---------- */
export function ApprovalSheet({ id }) {
  const { S, act, toast, openSheet, me, role } = useMC();
  const a = (S.approvals || []).find(x => x.id === id);
  const [note, setNote] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  if (!a) return <p className="sec-f">Esta solicitud ya no existe.</p>;
  const r = S.reservas.find(x => x.id === a.res); const g = r ? S.guests[r.g] || {} : {};
  const q = a.quoteId && (S.quotes || []).find(x => x.id === a.quoteId);
  const who = id => (S.team.find(p => p.id === id) || {}).name || "Alguien del equipo";
  const p = a.pay; const usd = p.monto || (p.monto_original && p.tasa ? Math.round(p.monto_original / p.tasa * 100) / 100 : 0);
  const mine = a.by === me?.id && role !== "direccion";
  const decide = async ok => { setErr(""); if (!ok && note.trim().length < 3) return setErr("Escribe por qué se rechaza.");
    setBusy(true); let res = null; const er = await act(async x => { res = await x.resolverAprobacion(a.id, ok, note.trim()); }, null);
    setBusy(false); if (er) return setErr(er);
    if (ok && res?.confirmada) await afterConfirm(act, toast, a.res, res); else toast(ok ? "Cobro aprobado y registrado" : "Cobro rechazado");
    if (r) openSheet("res", { id: r.id }); };
  const proof = async () => { const w = window.open("", "_blank"); let url = null; await act(async x => { url = await x.verComprobante(p.comprobante); }, null, { quiet: true }); if (url && w) w.location = url; else w?.close(); };
  return <div className="form">
    <div className="res-hero" style={{ paddingBottom: 6 }}><div><h3>{g.name || "Reserva"}</h3><div className="st">{r ? `${frange(r.in, r.out)} · ${PLAN[r.plan]?.name} · ${r.people} personas` : ""}</div></div></div>
    <div className="quote warn"><div className="q-h"><Icon n="alert" c="s" w="f" /><b>Lo que no coincide</b></div><p className="q-f" style={{ color: "var(--ink)", fontSize: 14.5 }}>{a.detail}</p>
      <span className="q-l">Motivo de {who(a.by)}</span><p className="q-f" style={{ color: "var(--ink)", fontSize: 14.5 }}>{a.reason}</p></div>
    <section className="sec"><div className="sec-h">El pago</div><div className="group kv">
      <KV k="Monto" v={money(usd)} />{p.moneda === "Bs" && <KV k="En bolívares" v={`Bs. ${Number(p.monto_original).toLocaleString("es-VE")} a ${p.tasa}`} />}
      <KV k="Método" v={p.metodo} />{p.referencia ? <KV k="Referencia" v={p.referencia} /> : <KV k="Tiene el efectivo" v={p.efectivo_lo_tiene} />}
      <KV k="Total que quedaría" v={p.total ? money(p.total) : "—"} /><KV k="Cotización" v={q ? `${q.code} · ${money(q.totals[r?.plan])}` : "Sin cotización"} />
      <KV k="Pedido" v={`${who(a.by)} · ${ago(a.at)}`} /></div>
      {p.comprobante && <div className="btns" style={{ marginTop: 10 }}><button type="button" className="btn plain press" onClick={proof}><Icon n="receipt" w="f" />Ver comprobante</button></div>}</section>
    {a.state === "pendiente" ? <>
      <section className="sec"><div className="group"><div className="row"><label htmlFor="apNote" className="sr">Nota</label><textarea id="apNote" className="field-full" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (obligatoria para rechazar)" /></div></div></section>
      <Err msg={err} />
      {mine ? <p className="sec-f">Tú pediste este cobro: lo aprueba otra persona de Administración o Dirección.</p>
        : <div className="btns"><button className="btn press" disabled={busy} onClick={() => decide(true)}><Icon n="check" w="b" />Aprobar y registrar el pago</button><button className="btn danger press" disabled={busy} onClick={() => decide(false)}>Rechazar</button></div>}
    </> : <div className="note"><Icon n={a.state === "aprobada" ? "check" : "alert"} c="s" w="f" /><span>{a.state === "aprobada" ? "Aprobado" : "Rechazado"} por {who(a.doneBy)} {ago(a.doneAt)}{a.note ? `: ${a.note}` : "."}</span></div>}
  </div>;
}

export function PaySheet({ id }) {
  const { S, act, openSheet, toast } = useMC();
  const r = S.reservas.find(x => x.id === id); const g = S.guests[r.g] || {};
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(r.total ? String(r.total) : "");
  const [concept, setConcept] = useState(r.concept || `${nights(r)} noches · ${PLAN[r.plan].name} · ${r.people} personas`);
  const totIn = total === "" ? NaN : Number(String(total).replace(",", "."));
  const [afterAmt, setAfterAmt] = useState(r.paid || 0);
  const Q = useQuote({ plan: r.plan, in: r.in, out: r.out, quoteId: r.quoteId }, totIn, afterAmt);
  const tot = Q.tot;
  const P = usePay(tot, r.paid || 0, ["nueva","conversacion","pre"].includes(r.state));
  useEffect(() => { setAfterAmt(P.after); }, [P.after]);
  const pend = Q.diffs.length > 0;
  const submit = async e => {
    e.preventDefault(); setErr("");
    const bad = P.check(); if (bad) return setErr(bad);
    if (pend && Q.reason.trim().length < 5) return setErr("El cobro no coincide con la cotización: escribe el motivo para pedir la aprobación.");
    setBusy(true); let res = null;
    const er = await act(async a => { const path = await a.subirComprobante(r.id, P.file);
      res = await a.registrarPago(r.id, { ...P.payload(path), total: Q.locked ? null : tot, cotizacion: Q.code, motivo: Q.reason.trim(), concepto: concept.trim() }); }, null);
    if (er) { setBusy(false); return setErr(er); }
    if (res?.pendiente) toast("Enviado a Administración. El pago queda en espera de aprobación");
    else if (res?.confirmada) await afterConfirm(act, toast, r.id, res); else toast(`Pago registrado. Faltan ${money(res?.falta)} para confirmar`);
    setBusy(false); openSheet("res", { id: r.id });
  };
  return <form className="form" onSubmit={submit}>
    <div className="res-hero" style={{ paddingBottom: 6 }}><div><h3>{g.name}</h3><div className="st">{frange(r.in, r.out)} · {nights(r)} noches · {r.people} personas</div></div></div>
    {Q.view}{P.summary}{P.fields}
    <section className="sec"><div className="sec-h">Para el comprobante del huésped</div><div className="group">
      <div className="row"><label className="k" htmlFor="payTot">Total de la estadía</label><span style={{ color: "var(--ink3)" }}>$</span><input id="payTot" className="field-in" inputMode="decimal" value={Q.locked ? String(tot) : total} disabled={Q.locked} onChange={e => setTotal(e.target.value)} style={{ maxWidth: 140, color: "var(--ink)" }} /></div>
      <div className="row"><label className="k" htmlFor="payCon">Concepto</label><input id="payCon" className="field-in" value={concept} onChange={e => setConcept(e.target.value)} autoComplete="off" /></div>
    </div><p className="sec-f">{P.confirms ? "Con este pago se completa el 100 %: la reserva se confirma, recibe su código y el huésped recibe el comprobante por correo." : "La reserva se confirma cuando lo pagado llega al 100 % del total."}</p></section>
    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit" disabled={busy}><Icon n="check" w="b" />{busy ? "Guardando…" : pend ? "Pedir aprobación del cobro" : P.confirms ? "Registrar y confirmar la reserva" : "Registrar el pago"}</button></div>
  </form>;
}

/* ---------- Reserva pagada: cliente + estadía + pago del 100 % en un solo paso ---------- */
export function PaidSheet({ date }) {
  const { S, act, openSheet, toast } = useMC();
  const din = date || day(7);
  const [f, setF] = useState({ name: "", phone: "", email: "", lang: "es", plan: "esencial", in: din, out: addDays(din, 2), people: 4, pet: false, channel: "WhatsApp", notes: "", total: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const known = findGuest(S, f.phone); const kg = known && S.guests[known];
  const n = f.in && f.out && f.out > f.in ? diff(f.in, f.out) : 0;
  const totIn = f.total === "" ? NaN : Number(String(f.total).replace(",", "."));
  const [afterAmt, setAfterAmt] = useState(0);
  const Q = useQuote({ plan: f.plan, in: f.in, out: f.out, quoteId: null }, totIn, afterAmt);
  const tot = Q.tot;
  const P = usePay(tot, 0, true);
  useEffect(() => { setAfterAmt(P.after); }, [P.after]);
  const pend = Q.diffs.length > 0;
  const submit = async e => {
    e.preventDefault(); setErr("");
    if (!f.name.trim() && !kg) return setErr("Escribe el nombre del cliente.");
    if (f.phone.replace(/\D/g, "").length < 7) return setErr("Escribe el WhatsApp del cliente.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return setErr("Escribe el correo del cliente: ahí le llega su código y su comprobante.");
    if (!n) return setErr("Revisa las fechas: la salida tiene que ser después de la llegada.");
    const bad = P.check(); if (bad) return setErr(bad);
    if (!P.confirms) return setErr(`Una reserva pagada necesita el 100 %. Faltan ${money(P.falta)}.`);
    if (pend && Q.reason.trim().length < 5) return setErr("El cobro no coincide con la cotización: escribe el motivo para pedir la aprobación.");
    setBusy(true); const id = crypto.randomUUID(); let res = null;
    const er = await act(async a => { const path = await a.subirComprobante(id, P.file);
      res = await a.crearReservaPagada(id, { nombre: f.name.trim() || kg.name, telefono: f.phone, email: f.email.trim(), idioma: f.lang, plan: f.plan, personas: f.people, mascota: f.pet,
        llegada: f.in, salida: f.out, canal: f.channel, notas: f.notes, ...P.payload(path), total: Q.locked ? null : tot, cotizacion: Q.code, motivo: Q.reason.trim(), concepto: `${n} ${n === 1 ? "noche" : "noches"} · ${PLAN[f.plan].name} · ${f.people} personas` }); }, null);
    if (er) { setBusy(false); return setErr(er); }
    if (res?.pendiente) toast("Reserva anotada. El pago queda en espera de que Administración lo apruebe");
    else await afterConfirm(act, toast, id, res);
    setBusy(false); openSheet("res", { id });
  };
  return <form className="form" onSubmit={submit}>
    <p className="sec-f" style={{ padding: "4px 4px 0" }}>Para el cliente que ya acordó por WhatsApp y pagó el 100 %. Al guardar, la reserva queda confirmada con su código y el cliente recibe el correo.</p>
    <section className="sec"><div className="sec-h">Cliente</div><div className="group">
      <div className="row"><label className="k" htmlFor="rpName">Nombre</label><input id="rpName" className="field-in" placeholder="Nombre y apellido" value={f.name} onChange={e => set("name", e.target.value)} autoComplete="off" /></div>
      <div className="row"><label className="k" htmlFor="rpPhone">WhatsApp</label><input id="rpPhone" className="field-in" placeholder="+58 …" inputMode="tel" value={f.phone} onChange={e => set("phone", e.target.value)} autoComplete="off" /></div>
      <div className="row"><label className="k" htmlFor="rpMail">Correo</label><input id="rpMail" type="email" className="field-in" placeholder="Para su código y comprobante" value={f.email} onChange={e => set("email", e.target.value)} autoComplete="off" /></div>
    </div>{kg && <div className="note"><Icon n="heart" c="s" w="f" /><span>Es <b>{kg.name}</b>{kg.visits ? `, que ya vino ${kg.visits === 1 ? "1 vez" : `${kg.visits} veces`}` : ", que ya está en Huéspedes"}. La reserva se guarda en su ficha.</span></div>}
      <div style={{ marginTop: 10 }}><Seg value={f.lang} onChange={v => set("lang", v)} label="Idioma de los mensajes" options={[["es", "Español"], ["en", "English"]]} /></div></section>
    <section className="sec"><div className="sec-h">Estadía</div><Seg value={f.plan} onChange={v => set("plan", v)} label="Plan" options={[["esencial", "Esencial"], ["plena", "Plena"]]} />
      <div className="group" style={{ marginTop: 10 }}>
        <div className="row"><label className="k" htmlFor="rpIn">Llegada</label><input type="date" id="rpIn" className="field-in" value={f.in} min={TODAY} onChange={e => set("in", e.target.value)} /></div>
        <div className="row"><label className="k" htmlFor="rpOut">Salida</label><input type="date" id="rpOut" className="field-in" value={f.out} min={TODAY} onChange={e => set("out", e.target.value)} /></div>
        <div className="row"><span className="k" id="rpPeopleL">Personas</span><div className="stepper" role="group" aria-labelledby="rpPeopleL"><button type="button" onClick={() => set("people", Math.max(1, f.people - 1))} aria-label="Una persona menos">−</button><output>{f.people}</output><button type="button" onClick={() => set("people", Math.min(12, f.people + 1))} aria-label="Una persona más">+</button></div></div>
        <div className="row"><label className="k" htmlFor="rpPet">Viene con mascota</label><Switch id="rpPet" checked={f.pet} onChange={v => set("pet", v)} /></div>
        <div className="row"><label className="k" htmlFor="rpTot">Total de la estadía</label><span style={{ color: "var(--ink3)" }}>$</span><input id="rpTot" className="field-in" inputMode="decimal" value={Q.locked ? String(tot) : f.total} disabled={Q.locked} onChange={e => set("total", e.target.value)} style={{ maxWidth: 140, color: "var(--ink)" }} /></div>
      </div></section>
    <section className="sec"><div className="sec-h">Por dónde llegó</div><Chips value={f.channel} onChange={v => set("channel", v)} label="Canal" options={CANALES.map(c => [c, c])} /></section>
    {Q.view}{P.summary}{P.fields}
    <section className="sec"><div className="group"><div className="row"><label htmlFor="rpNotes" className="sr">Notas</label><textarea id="rpNotes" className="field-full" rows={2} placeholder="¿Celebran algo? ¿Alguna alergia? ¿Hora de llegada?" value={f.notes} onChange={e => set("notes", e.target.value)} /></div></div></section>
    <Err msg={err} />
    <div className="btns"><button className="btn press" type="submit" disabled={busy}><Icon n="check" w="b" />{busy ? "Guardando…" : pend ? "Anotar y pedir aprobación del cobro" : "Confirmar la reserva pagada"}</button></div>
  </form>;
}
