import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { FICHA, OPCIONES, NORMAS_VERSION } from "./ficha-data.js";
import { WHATSAPP } from "../lib/contacto.js";

// La ficha de registro en «Mi reserva» (SPEC-portal-huesped.md). Es la misma ficha de
// papel (ficha-data.js), en partes cortas. Cada parte se guarda al tocar «Guardar y
// seguir» (portal_guardar_ficha, 0020), así el cliente puede terminarla otro día.
// Las opciones se guardan en español, igual que la ficha del panel (sheets.jsx).

const TX = {
  es: {
    volver: "Volver a mi reserva", parte: "Parte", de: "de", guardar: "Guardar y seguir", guardando: "Guardando…", atras: "Atrás",
    p: ["Tus datos", "Tu llegada", "Quiénes se quedan", "Comida", "Mascota y celebración", "Normas y firma"],
    emergencia: "Contacto de emergencia", emergenciaNota: "Alguien que no viaje con el grupo, por si necesitamos avisarle algo.",
    emNombre: "Nombre y apellido", emParentesco: "Parentesco", emTel: "Teléfono", parentescos: ["Madre", "Padre", "Hermano(a)", "Pareja", "Hijo(a)", "Amigo(a)", "Otro"],
    docMask: "Ya lo tenemos: termina en", cambiar: "Cambiar",
    horaPh: "Elige una hora", horas: ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "Después de las 8:00 PM", "Todavía no sé"],
    otroVehiculo: "Agregar otro vehículo", sinVehiculo: "Si no vienen en carro, déjalo en blanco.",
    menor: "Es menor de edad", edad: "Edad", tu: "Tú (titular)", persona: "Persona",
    tuGrupo: "Tu reserva es para", personas: "personas", persona1: "persona", grupoNota: "Es lo que anotamos al confirmar tu reserva.",
    cambio: "¿Tienes dudas? Escríbenos", cambioMsg: "Hola, soy {n}, de la reserva {c}. Tengo una duda sobre mi reserva.",
    quienes: "Escribe a cada persona de tu reserva. Si es menor de edad, marca la casilla y pon su edad.",
    bebeT: "Bebé (menor de 3 años)", y: "y", bebe1: "bebé", bebes: "bebés", bebeNota: "Los bebés menores de 3 años los anotamos al confirmar tu reserva.",
    otras: "Otras", choose: "Elige", si: "Sí", no: "No",
    acepto: "Leí y acepto las normas de la casa", firmaAqui: "Firma aquí con el dedo", borrar: "Borrar", firmar: "Firmar y terminar", firmando: "Firmando…",
    sinFirma: "Falta tu firma en el recuadro.", sinAcepto: "Marca que aceptas las normas.",
    tuNombre: "Tu nombre completo", tuDoc: "Tu C.I. o pasaporte",
    listoT: "¡Listo, {n}!", listoD: "Tu ficha quedó firmada. Ya tienes abierto todo lo de tu estadía.", verEstadia: "Ver mi estadía", firmadaEl: "Firmada el",
    error: "No se pudo guardar. Revisa tu internet y vuelve a probar."
  },
  en: {
    volver: "Back to my booking", parte: "Part", de: "of", guardar: "Save and continue", guardando: "Saving…", atras: "Back",
    p: ["Your details", "Your arrival", "Who's staying", "Food", "Pet and celebration", "Rules and signature"],
    emergencia: "Emergency contact", emergenciaNota: "Someone who isn't travelling with the group, in case we need to reach them.",
    emNombre: "Full name", emParentesco: "Relationship", emTel: "Phone", parentescos: ["Mother", "Father", "Sibling", "Partner", "Son / daughter", "Friend", "Other"],
    docMask: "We already have it: ends in", cambiar: "Change",
    horaPh: "Pick a time", horas: ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "After 8:00 PM", "Not sure yet"],
    otroVehiculo: "Add another vehicle", sinVehiculo: "If you're not coming by car, leave it blank.",
    menor: "Under 18", edad: "Age", tu: "You (main guest)", persona: "Guest",
    tuGrupo: "Your booking is for", personas: "guests", persona1: "guest", grupoNota: "This is what we noted when your booking was confirmed.",
    cambio: "Any questions? Message us", cambioMsg: "Hi, I'm {n}, booking {c}. I have a question about my booking.",
    quienes: "Add each guest on your booking. If they're under 18, tick the box and add their age.",
    bebeT: "Baby (under 3)", y: "and", bebe1: "baby", bebes: "babies", bebeNota: "We noted babies under 3 when your booking was confirmed.",
    otras: "Other", choose: "Choose", si: "Yes", no: "No",
    acepto: "I have read and accept the house rules", firmaAqui: "Sign here with your finger", borrar: "Clear", firmar: "Sign and finish", firmando: "Signing…",
    sinFirma: "Please sign in the box.", sinAcepto: "Please tick that you accept the rules.",
    tuNombre: "Your full name", tuDoc: "Your ID or passport",
    listoT: "All set, {n}!", listoD: "Your form is signed. Everything about your stay is now open.", verEstadia: "See my stay", firmadaEl: "Signed on",
    error: "We couldn't save. Check your internet and try again."
  }
};

const vals = k => OPCIONES[k].map(o => o.v);
const separar = (k, lista) => {
  const partes = (Array.isArray(lista) ? lista : String(lista || "").split(",")).map(x => x.trim()).filter(Boolean);
  return [partes.filter(x => vals(k).includes(x)), partes.filter(x => !vals(k).includes(x)).join(", ")];
};
const juntar = (set, otro) => [...set, ...String(otro || "").split(",").map(x => x.trim()).filter(Boolean)];

// La primera parte que falta (o la 6 si están las 5).
export const parteInicial = f => { if (f.firmada) return 1; const hechas = f.partes || []; for (let i = 1; i <= 5; i++) if (!hechas.includes(i)) return i; return 6; };

export default function Ficha({ lang, d, guardarParte, volver }) {
  const t = TX[lang] || TX.es, F = FICHA[lang] || FICHA.es;
  const f = d.ficha;
  const [parte, setParte] = useState(() => parteInicial(f));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const top = useRef();
  useEffect(() => { top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [parte]);

  const guardar = async datos => {
    setEnviando(true); setError("");
    try {
      const r = await guardarParte(parte, datos);
      if (r?.ok) setParte(p => Math.min(p + 1, 7)); else setError(r?.error || t.error);
    } catch { setError(t.error); }
    setEnviando(false);
  };
  const props = { t, F, lang, f, r: d.reserva, guardar, enviando, error, atras: parte > 1 ? () => { setError(""); setParte(parte - 1); } : null };

  return (
    <section className="mr-ficha" ref={top}>
      <button type="button" className="mr-link mr-back" onClick={volver}>← {t.volver}</button>
      <ol className="mr-progress" aria-label={`${t.parte} ${parte} ${t.de} 6`}>
        {t.p.map((x, i) => <li key={x} className={i + 1 < parte || (f.partes || []).includes(i + 1) ? "done" : i + 1 === parte ? "now" : ""}><span>{i + 1}</span><b>{x}</b></li>)}
      </ol>
      {parte <= 6 && <><p className="eyebrow">{t.parte} {parte} {t.de} 6</p>
      <h2>{t.p[parte - 1]}</h2></>}
      {parte === 1 && <P1 key={1} {...props} />}
      {parte === 2 && <P2 key={2} {...props} />}
      {parte === 3 && <P3 key={3} {...props} />}
      {parte === 4 && <P4 key={4} {...props} />}
      {parte === 5 && <P5 key={5} {...props} />}
      {parte === 6 && <P6 key={6} {...props} />}
      {parte === 7 && <div className="mr-card mr-done"><div className="mr-step-n" aria-hidden="true">✓</div>
        <h3>{t.listoT.replace("{n}", String(f.nombre || "").split(/\s+/)[0])}</h3><p>{t.listoD}</p>
        <button type="button" className="btn btn-primary" onClick={volver}>{t.verEstadia}</button></div>}
    </section>
  );
}

// ---------- Piezas ----------
const Campo = ({ id, label, children, ancho }) => <div className={`field ${ancho ? "wide" : ""}`}><label htmlFor={id}>{label}</label>{children}</div>;
function Pie({ t, enviando, error, atras }) {
  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="mr-actions wide">
      {atras && <button type="button" className="btn btn-ghost" onClick={atras}>{t.atras}</button>}
      <button type="submit" className="btn btn-primary" disabled={enviando}>{enviando ? t.guardando : t.guardar}</button>
    </div>
  </>;
}
const Form = ({ onSubmit, children }) => <form className="mr-card mr-form" noValidate onSubmit={e => { e.preventDefault(); onSubmit(); }}>{children}</form>;
function Chips({ name, opciones, lang, value, onChange, multiple = true }) {
  const toggle = v => onChange(multiple ? (value.includes(v) ? value.filter(x => x !== v) : [...value, v]) : (value[0] === v ? [] : [v]));
  return <div className="mr-chips" role="group" aria-label={name}>
    {opciones.map(o => <button key={o.v} type="button" aria-pressed={value.includes(o.v)} className="mr-chip" onClick={() => toggle(o.v)}>{lang === "en" ? o.en : o.v}</button>)}
  </div>;
}

// 1 · Titular y contacto de emergencia
function P1({ t, F, f, guardar, ...rest }) {
  const [v, setV] = useState({ nombre: f.nombre || "", documento: f.documento || "", telefono: f.telefono || "", email: f.email || "", ciudad: f.ciudad || "",
    emergencia_nombre: f.emergencia_nombre || "", emergencia_parentesco: f.emergencia_parentesco || "", emergencia_telefono: f.emergencia_telefono || "" });
  const [cambiaDoc, setCambiaDoc] = useState(!String(f.documento || "").startsWith("•"));
  const s = k => e => setV({ ...v, [k]: e.target.value });
  return <Form onSubmit={() => guardar(v)}>
    <Campo id="f-nombre" label={F.nombre} ancho><input id="f-nombre" autoComplete="name" value={v.nombre} onChange={s("nombre")} maxLength={120} /></Campo>
    <Campo id="f-doc" label={F.documento}>
      {cambiaDoc ? <input id="f-doc" value={v.documento.startsWith("•") ? "" : v.documento} onChange={s("documento")} maxLength={40} autoComplete="off" />
        : <p className="mr-mask">{t.docMask} <b>{f.documento.replace(/•/g, "")}</b> <button type="button" className="mr-link" onClick={() => { setCambiaDoc(true); setV({ ...v, documento: "" }); }}>{t.cambiar}</button></p>}
    </Campo>
    <Campo id="f-tel" label={F.telefono}><input id="f-tel" type="tel" autoComplete="tel" value={v.telefono} onChange={s("telefono")} maxLength={40} /></Campo>
    <Campo id="f-email" label={F.email}><input id="f-email" type="email" autoComplete="email" value={v.email} onChange={s("email")} maxLength={120} /></Campo>
    <Campo id="f-ciudad" label={F.ciudad}><input id="f-ciudad" autoComplete="address-level2" value={v.ciudad} onChange={s("ciudad")} maxLength={80} /></Campo>
    <div className="wide mr-sub"><h3>{t.emergencia}</h3><p>{t.emergenciaNota}</p></div>
    <Campo id="f-emn" label={t.emNombre}><input id="f-emn" value={v.emergencia_nombre} onChange={s("emergencia_nombre")} maxLength={120} /></Campo>
    <Campo id="f-emp" label={t.emParentesco}>
      <select id="f-emp" value={v.emergencia_parentesco} onChange={s("emergencia_parentesco")}>
        <option value="">{t.choose}</option>{t.parentescos.map(x => <option key={x}>{x}</option>)}
        {v.emergencia_parentesco && !t.parentescos.includes(v.emergencia_parentesco) && <option>{v.emergencia_parentesco}</option>}
      </select>
    </Campo>
    <Campo id="f-emt" label={t.emTel}><input id="f-emt" type="tel" value={v.emergencia_telefono} onChange={s("emergencia_telefono")} maxLength={40} /></Campo>
    <Pie t={t} {...rest} />
  </Form>;
}

// 2 · Llegada y vehículos. El número de personas es el de la reserva (lo anotó Recepción
// al registrar el pago): se muestra, no se cambia aquí. Para dudas, WhatsApp a Recepción (0021).
const waCambio = (t, f, r) => `https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(t.cambioMsg.replace("{n}", String(f.nombre || "").trim()).replace("{c}", r.codigo))}`;
function P2({ t, F, f, r, guardar, ...rest }) {
  const [hora, setHora] = useState(f.hora_llegada || "");
  const [veh, setVeh] = useState(f.vehiculos?.length ? f.vehiculos : [""]);
  return <Form onSubmit={() => guardar({ hora_llegada: hora, vehiculos: veh })}>
    <div className="wide mr-group">
      <p><span className="mr-label">{t.tuGrupo}</span><b>{r.personas} {r.personas === 1 ? t.persona1 : t.personas}{r.bebes > 0 && <> {t.y} {r.bebes} {r.bebes === 1 ? t.bebe1 : t.bebes}</>}</b></p>
      <p className="hint">{t.grupoNota}</p>
      <a className="mr-link" href={waCambio(t, f, r)} target="_blank" rel="noopener noreferrer">{t.cambio} →</a>
    </div>
    <Campo id="f-hora" label={F.hora} ancho>
      <select id="f-hora" value={hora} onChange={e => setHora(e.target.value)}>
        <option value="">{t.horaPh}</option>{t.horas.map(x => <option key={x}>{x}</option>)}
        {hora && !t.horas.includes(hora) && <option>{hora}</option>}
      </select>
    </Campo>
    <div className="wide mr-sub"><h3>{F.vehiculos}</h3><p>{t.sinVehiculo}</p></div>
    {veh.map((x, i) => <Campo key={i} id={`f-veh${i}`} label={`${i + 1}.`}><input id={`f-veh${i}`} placeholder={F.vehiculoPh} value={x} maxLength={80} onChange={e => setVeh(veh.map((y, j) => j === i ? e.target.value : y))} /></Campo>)}
    {veh.length < 4 && <div className="wide"><button type="button" className="mr-link" onClick={() => setVeh([...veh, ""])}>+ {t.otroVehiculo}</button></div>}
    <Pie t={t} {...rest} />
  </Form>;
}

// 3 · Quiénes se quedan (titular primero): una casilla por persona de la reserva y una por cada
// bebé menor de 3 años que anotó Recepción (0022). Adultos y niños se cuentan solos con las edades.
function P3({ t, F, f, r, guardar, ...rest }) {
  const total = Math.max(1, r.personas || 1);
  const prev = f.ocupantes || [];
  const esBebe = o => o.edad !== null && o.edad !== undefined && o.edad !== "" && Number(o.edad) < 3;
  const nBebes = Math.min(2, Math.max(0, r.bebes || 0));
  const prevBebes = prev.filter(esBebe).slice(0, nBebes), prevResto = prev.filter(o => !prevBebes.includes(o));
  const fila = (o, i) => ({ nombre: o.nombre || (i === 0 ? f.nombre : "") || "", documento: o.documento || (i === 0 ? f.documento : "") || "",
    menor: o.edad != null && o.edad !== "", edad: o.edad ?? "" });
  const [filas, setFilas] = useState(() => Array.from({ length: total }, (_, i) => fila(prevResto[i] || {}, i)));
  const [bebes, setBebes] = useState(() => Array.from({ length: nBebes }, (_, i) => ({ nombre: prevBebes[i]?.nombre || "", edad: String(prevBebes[i]?.edad ?? "0") })));
  const s = (i, k, val) => setFilas(filas.map((x, j) => j === i ? { ...x, [k]: val } : x));
  const sb = (i, k, val) => setBebes(bebes.map((x, j) => j === i ? { ...x, [k]: val } : x));
  return <Form onSubmit={() => guardar({ ocupantes: [...filas.map(x => ({ nombre: x.nombre, documento: x.documento, edad: x.menor ? x.edad : "" })),
    ...bebes.map(x => ({ nombre: x.nombre, documento: "", edad: x.edad === "" ? "0" : x.edad }))] })}>
    <p className="hint wide">{t.quienes}</p>
    {filas.map((x, i) => <fieldset key={i} className="mr-person wide">
      <legend>{i === 0 ? t.tu : `${t.persona} ${i + 1}`}</legend>
      <Campo id={`o-n${i}`} label={F.acNombre}><input id={`o-n${i}`} value={x.nombre} maxLength={120} onChange={e => s(i, "nombre", e.target.value)} /></Campo>
      <Campo id={`o-d${i}`} label={F.acDoc}><input id={`o-d${i}`} value={x.documento} maxLength={40} autoComplete="off"
        onFocus={e => e.target.select()} onChange={e => s(i, "documento", e.target.value)} /></Campo>
      {i > 0 && <label className="mr-check"><input type="checkbox" checked={x.menor} onChange={e => s(i, "menor", e.target.checked)} /> {t.menor}</label>}
      {x.menor && <Campo id={`o-e${i}`} label={t.edad}><input id={`o-e${i}`} inputMode="numeric" value={x.edad} maxLength={2} onChange={e => s(i, "edad", e.target.value.replace(/\D/g, ""))} /></Campo>}
    </fieldset>)}
    {bebes.map((x, i) => <fieldset key={`b${i}`} className="mr-person wide">
      <legend>{t.bebeT}</legend>
      <Campo id={`b-n${i}`} label={F.acNombre}><input id={`b-n${i}`} value={x.nombre} maxLength={120} onChange={e => sb(i, "nombre", e.target.value)} /></Campo>
      <Campo id={`b-e${i}`} label={t.edad}>
        <select id={`b-e${i}`} value={x.edad} onChange={e => sb(i, "edad", e.target.value)}><option value="0">0</option><option value="1">1</option><option value="2">2</option></select>
      </Campo>
    </fieldset>)}
    {bebes.length > 0 && <p className="hint wide">{t.bebeNota}</p>}
    <Pie t={t} {...rest} />
  </Form>;
}

// 4 · Comida: alergias, bebidas y requerimientos
function P4({ t, F, lang, f, guardar, ...rest }) {
  const [al, setAl] = useState(() => separar("alergias", f.alergias)[0]);
  const [alO, setAlO] = useState(() => separar("alergias", f.alergias)[1]);
  const [be, setBe] = useState(() => separar("bebidas", f.bebidas)[0]);
  const [beO, setBeO] = useState(() => separar("bebidas", f.bebidas)[1]);
  const [rq, setRq] = useState(() => separar("requerimientos", f.requerimientos)[0]);
  const [rqO, setRqO] = useState(() => separar("requerimientos", f.requerimientos)[1]);
  const [ninguna, setNinguna] = useState(false);
  return <Form onSubmit={() => guardar({ alergias: ninguna ? [] : al, alergias_detalle: ninguna ? "" : alO, bebidas: juntar(be, beO).join(", "), requerimientos: juntar(rq, rqO).join(", ") })}>
    <div className="field wide"><span className="mr-label">{F.alergias}</span>
      <Chips name={F.alergias} opciones={[...OPCIONES.alergias, { v: "Ninguna", en: F.ninguna }]} lang={lang} value={ninguna ? ["Ninguna"] : al}
        onChange={x => { if (x.includes("Ninguna") && !ninguna) { setNinguna(true); setAl([]); } else { setNinguna(false); setAl(x.filter(y => y !== "Ninguna")); } }} /></div>
    {!ninguna && <Campo id="f-alO" label={F.detalle} ancho><input id="f-alO" value={alO} maxLength={120} onChange={e => setAlO(e.target.value)} /></Campo>}
    <div className="field wide"><span className="mr-label">{F.bebidas}</span><Chips name={F.bebidas} opciones={OPCIONES.bebidas} lang={lang} value={be} onChange={setBe} /></div>
    <Campo id="f-beO" label={F.otrasBebidas} ancho><input id="f-beO" value={beO} maxLength={200} onChange={e => setBeO(e.target.value)} /></Campo>
    <div className="field wide"><span className="mr-label">{F.req}</span><Chips name={F.req} opciones={OPCIONES.requerimientos} lang={lang} value={rq} onChange={setRq} /></div>
    <Campo id="f-rqO" label={F.otrosReq} ancho><input id="f-rqO" value={rqO} maxLength={200} onChange={e => setRqO(e.target.value)} /></Campo>
    <Pie t={t} {...rest} />
  </Form>;
}

// 5 · Mascota y motivo de la visita
function P5({ t, F, lang, f, guardar, ...rest }) {
  const [mascota, setMascota] = useState(!!(f.mascota_nombre || f.mascota_raza));
  const [nom, setNom] = useState(f.mascota_nombre || "");
  const [raza, setRaza] = useState(f.mascota_raza || "");
  const [mo, setMo] = useState(() => separar("motivo", f.motivo)[0]);
  const [moO, setMoO] = useState(() => separar("motivo", f.motivo)[1]);
  return <Form onSubmit={() => guardar({ mascota, mascota_nombre: nom, mascota_raza: raza, motivo: juntar(mo, moO).join(", ") })}>
    <div className="field wide"><span className="mr-label">{F.mascota}</span>
      <div className="mr-chips">
        <button type="button" className="mr-chip" aria-pressed={!mascota} onClick={() => setMascota(false)}>{F.noMascota}</button>
        <button type="button" className="mr-chip" aria-pressed={mascota} onClick={() => setMascota(true)}>{F.siMascota}</button>
      </div></div>
    {mascota && <>
      <Campo id="f-mn" label={F.mascotaNombre}><input id="f-mn" value={nom} maxLength={60} onChange={e => setNom(e.target.value)} /></Campo>
      <Campo id="f-mr" label={F.mascotaRaza}><input id="f-mr" value={raza} maxLength={60} onChange={e => setRaza(e.target.value)} /></Campo>
    </>}
    <div className="field wide"><span className="mr-label">{F.motivo}</span><Chips name={F.motivo} opciones={OPCIONES.motivo} lang={lang} value={mo} onChange={setMo} /></div>
    <Campo id="f-moO" label={F.otro} ancho><input id="f-moO" value={moO} maxLength={200} onChange={e => setMoO(e.target.value)} /></Campo>
    <Pie t={t} {...rest} />
  </Form>;
}

// 6 · Normas y firma con el dedo (signature_pad). La firma se manda como PNG de 600 px de
// ancho; la base revisa que sea PNG, que el nombre y el C.I. sean los de la ficha, y guarda
// la huella de la ficha (portal_firmar, 0020).
function P6({ t, F, f, guardar, ...rest }) {
  const [acepto, setAcepto] = useState(false);
  const [nombre, setNombre] = useState(f.nombre || "");
  const [doc, setDoc] = useState(f.documento || "");
  const [hay, setHay] = useState(false);
  const [aviso, setAviso] = useState("");
  const pad = useRef();
  const firmar = () => {
    if (!acepto) { setAviso(t.sinAcepto); return; }
    if (!hay || pad.current.vacia()) { setAviso(t.sinFirma); return; }
    setAviso("");
    guardar({ acepto, nombre, documento: doc, firma: pad.current.png(), normas: NORMAS_VERSION });
  };
  return <Form onSubmit={firmar}>
    <div className="wide mr-rules">
      <p>{F.declara}</p>
      <ol>{F.normas.map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ol>
    </div>
    <label className="mr-check wide"><input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} /> {t.acepto}</label>
    <Campo id="s-nombre" label={t.tuNombre}><input id="s-nombre" autoComplete="name" value={nombre} maxLength={120} onChange={e => setNombre(e.target.value)} /></Campo>
    <Campo id="s-doc" label={t.tuDoc}><input id="s-doc" value={doc} maxLength={40} autoComplete="off" onFocus={e => e.target.select()} onChange={e => setDoc(e.target.value)} /></Campo>
    <div className="wide mr-sign">
      <div className="mr-sign-head"><span className="mr-label">{F.firmaPdf}</span><button type="button" className="mr-link" onClick={() => { pad.current.borrar(); setHay(false); }}>{t.borrar}</button></div>
      <Lienzo ref={pad} etiqueta={t.firmaAqui} onTrazo={() => { setHay(true); setAviso(""); }} />
    </div>
    {aviso && <p className="form-error" role="alert">{aviso}</p>}
    <Pie t={{ ...t, guardar: t.firmar, guardando: t.firmando }} {...rest} />
  </Form>;
}

const Lienzo = forwardRef(function Lienzo({ etiqueta, onTrazo }, ref) {
  const lienzo = useRef(); const sp = useRef();
  useEffect(() => {
    const c = lienzo.current;
    sp.current = new SignaturePad(c, { penColor: "#2E2E24", backgroundColor: "#ffffff", minWidth: 0.9, maxWidth: 2.8 });
    // El lienzo se ajusta a la pantalla (y a su densidad) sin perder lo ya firmado.
    const ajustar = () => {
      const r = Math.max(window.devicePixelRatio || 1, 1), datos = sp.current.toData();
      c.width = c.offsetWidth * r; c.height = c.offsetHeight * r; c.getContext("2d").scale(r, r);
      sp.current.clear(); if (datos.length) sp.current.fromData(datos);
    };
    ajustar();
    const fin = () => onTrazo();
    sp.current.addEventListener("endStroke", fin);
    window.addEventListener("resize", ajustar);
    return () => { window.removeEventListener("resize", ajustar); sp.current.removeEventListener("endStroke", fin); sp.current.off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    vacia: () => sp.current.isEmpty(),
    borrar: () => sp.current.clear(),
    // PNG de 600 px de ancho (más liviano que el lienzo en pantallas de alta densidad).
    png: () => {
      const c = lienzo.current, w = 600, h = Math.round(600 * c.offsetHeight / c.offsetWidth);
      const o = document.createElement("canvas"); o.width = w; o.height = h;
      const g = o.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(c, 0, 0, w, h);
      return o.toDataURL("image/png");
    }
  }));
  return <div className="mr-canvas"><canvas ref={lienzo} aria-label={etiqueta} role="img" /><span aria-hidden="true">{etiqueta}</span></div>;
});
