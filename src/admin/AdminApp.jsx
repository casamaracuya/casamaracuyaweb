import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./admin.css";
import { api } from "../lib/api.js";
import { supabase, LINK_TYPE } from "../lib/supabase.js";
import { Login, SetPassword, NoRole, NotConfigured, Splash } from "./Access.jsx";
import { Tour, tourSeen } from "./Tour.jsx";
import { Ctx, Icon } from "./ui.jsx";
import { VIEW_CMP } from "./views.jsx";
import { SHEETS } from "./sheets.jsx";
import { ROLES, VIEWS, TODAY } from "./util.js";

const ROLE_KEY = "mc-role";
const getSaved = () => { try { return localStorage.getItem(ROLE_KEY); } catch { return null; } };
const setSaved = r => { try { localStorage.setItem(ROLE_KEY, r); } catch { /* sin almacenamiento */ } };

export default function AdminApp() {
  useEffect(() => { document.title = "Maracuyá Control"; }, []);
  if (!supabase) return <NotConfigured />;
  return <Panel />;
}

function Panel() {
  const [session, setSession] = useState(undefined);
  // Quien llega desde el correo de invitación o de «olvidé mi contraseña» primero crea su contraseña.
  const [mustSetPw, setMustSetPw] = useState(LINK_TYPE === "invite" || LINK_TYPE === "recovery");
  const [me, setMe] = useState(null);
  const [role, setRoleState] = useState(null);
  const [S, setS] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.session().then(s => setSession(s || null)).catch(e => { setErr(e.message); setSession(null); });
    return api.onAuth((s, event) => {
      setSession(s || null);
      if (event === "PASSWORD_RECOVERY") setMustSetPw(true);
      if (event === "SIGNED_OUT") { setRoleState(null); setS(null); }
    });
  }, []);
  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) { setMe(null); return; }
    api.me().then(m => {
      setMe(m);
      const saved = getSaved();
      setRoleState(m && m.roles.length ? (m.roles.includes(saved) ? saved : m.roles[0]) : null);
    }).catch(e => setErr(e.message));
  }, [uid]);

  const reload = useCallback(async () => {
    try { setS(await api.load()); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { if (role) reload(); }, [role, reload]);
  useEffect(() => { if (!role) return; const off = api.subscribe(reload); const t = setInterval(reload, 60000); return () => { off(); clearInterval(t); }; }, [role, reload]);

  const setRole = r => { setSaved(r); setRoleState(r); };

  // La pantalla de carga se queda encima del panel y se desvanece, en vez de cortar de golpe.
  const ready = !!(session && !mustSetPw && me?.roles.length && role && S);
  const [veil, setVeil] = useState("on");
  useEffect(() => {
    if (!ready) { setVeil("on"); return; }
    setVeil("leaving");
    const t = setTimeout(() => setVeil("off"), 700);
    return () => clearTimeout(t);
  }, [ready]);

  // Pantallas que reemplazan todo (entrar, crear contraseña, sin rol).
  if (session === null) return <Login />;
  if (session && mustSetPw) return <SetPassword invite={LINK_TYPE === "invite"} email={session.user?.email} onDone={() => { history.replaceState(null, "", location.pathname); setMustSetPw(false); }} />;
  if (me && !me.roles.length) return <NoRole me={me} />;

  // Mientras carga, la misma pantalla de carga (sin reiniciar su animación) hasta que el panel aparece debajo.
  const label = me ? "Preparando tu día" : "Abriendo la casa";
  return <>
    {ready && <Shell S={S} role={role} setRole={setRole} me={me} reload={reload} />}
    {!ready && err ? <Splash key="splash" msg={err} />
      : veil !== "off" && <Splash key="splash" label={label} leaving={veil === "leaving"} />}
  </>;
}

function Shell({ S, role, setRole, me, reload }) {
  const R = ROLES[role];
  const nav = useNavigate();
  const params = useParams();
  const allowed = [...R.tabs, ...R.more];
  const view = allowed.includes(params.view) ? params.view : "hoy";
  const [bandEl, setBandEl] = useState(null);
  const [sheet, setSheet] = useState(null); const [sheetOpen, setSheetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(""); const toastT = useRef();
  const [scrolled, setScrolled] = useState(false);
  const lastFocus = useRef(null);
  // Recorrido de bienvenida: se abre solo la primera vez que esta persona entra.
  const [tour, setTour] = useState(() => !!me && !tourSeen(me.id));

  useEffect(() => { const f = () => setScrolled(window.scrollY > 44); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);
  useEffect(() => { const f = e => { if (e.key === "Escape") closeSheet(); }; document.addEventListener("keydown", f); return () => document.removeEventListener("keydown", f); });

  const toast = useCallback(m => { if (!m) return; setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(""), 2600); }, []);
  const openSheet = (type, props = {}) => { if (!sheetOpen) lastFocus.current = document.activeElement; setSheet({ type, props, k: Date.now() }); setSheetOpen(true); };
  const closeSheet = () => { setSheetOpen(false); setTimeout(() => setSheet(null), 450); lastFocus.current?.focus?.(); };

  // Ejecuta una acción de datos, recarga y avisa. Devuelve el mensaje de error (o nada).
  const bound = useMemo(() => new Proxy({}, { get: (_t, k) => (...args) => api[k](S, ...args) }), [S]);
  const act = useCallback(async (fn, msg, opt = {}) => {
    try { await fn(bound); await reload(); if (msg) toast(msg); return null; }
    catch (e) { if (!opt.quiet) toast(e.message); await reload(); return e.message; }
  }, [bound, reload, toast]);

  const badge = v => v === "reservas" ? S.reservas.filter(r => r.state === "nueva").length : v === "tareas" ? S.tasks.filter(t => t.area === role && !t.done && t.due <= TODAY).length : 0;
  const canMove = ["direccion","recepcion","admin"].includes(role), canMoney = !!R.money;
  // «Nueva reserva» tiene su propio botón fijo, así que el + de la barra queda para lo demás.
  const plus = { tareas: "newTask", casa: ["mantenimiento","direccion"].includes(role) ? "block" : "" }[view];
  const ctx = { S, role, R, me, setRole, act, toast, openSheet, closeSheet, bandEl, canMove, canMoney,
    openTour: () => { closeSheet(); setTour(true); },
    signOut: async () => { await api.signOut(); location.href = "/admin"; } };
  const V = VIEW_CMP[view];
  const sheetDef = sheet && SHEETS[sheet.type];
  const items = [...R.tabs.filter(t => t !== "mas"), ...R.more];

  return (
    <Ctx.Provider value={ctx}>
      <div className={`app mc ${canMove ? "has-fab" : ""}`}>
        <aside className="side" aria-label="Menú">
          <div className="side-brand"><img src="/logo/logo-claro.svg" alt="Maracuyá" width="110" height="44" /><span>Control</span></div>
          {canMove && <button className="side-new press" onClick={() => openSheet("newRes")}><Icon n="plus" c="s" w="b" />Nueva reserva</button>}
          {items.map(t => { const b = badge(t); return <Link key={t} to={`/admin/${t}`} aria-current={t === view ? "page" : undefined}><Icon n={t} w={t === view ? "f" : "r"} /><span>{VIEWS[t]}</span>{b > 0 && <span className="badge">{b}</span>}</Link>; })}
          <div className="side-foot">
            <button className="me press" onClick={() => openSheet("profile")}><span className="avatar m" style={{ background: `var(--r-${role})`, color: `var(--r-${role}-ink)` }}><Icon n={R.icon} w="d" /></span><span><b>{me?.name || R.name}</b><small>{me ? R.name : "Cambiar de perfil"}</small></span></button></div>
        </aside>
        <div className="main">
          <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
            <div className="nb">
              <div className="nb-left">{R.more.includes(view) && <button className="back" onClick={() => nav("/admin/mas")}><Icon n="chevL" c="s" />Más</button>}</div>
              <div className="nb-title">{VIEWS[view]}</div>
              <div className="nb-right">
                {plus && <button className="icon-btn press" onClick={() => openSheet(plus)} aria-label="Agregar"><Icon n="plus" c="s" /></button>}
                <button className="avatar-btn press" onClick={() => openSheet("profile")} aria-label={`Perfil: ${R.name}`}><span className="avatar" style={{ background: `var(--r-${role})`, color: `var(--r-${role}-ink)` }}><Icon n={R.icon} c="s" w="d" /></span></button>
              </div>
            </div>
          </header>
          <section className="band" ref={setBandEl} />
          <main className="content wrap"><div className="lift enter" key={view}><V /></div></main>
        </div>
        <nav className="dock" aria-label="Secciones">
          {R.tabs.map(t => { const b = badge(t); const on = t === view || (t === "mas" && R.more.includes(view)); return <Link key={t} className="tab press" to={`/admin/${t}`} aria-current={on ? "page" : undefined}><Icon n={t} w={on ? "f" : "r"} /><span>{VIEWS[t]}</span>{b > 0 && <span className="badge">{b}</span>}</Link>; })}
        </nav>
        {canMove && <button className="fab press" onClick={() => openSheet("newRes")}><Icon n="plus" c="s" w="b" />Nueva reserva</button>}
      </div>
      {tour && <Tour uid={me?.id || "anon"} role={role} name={me?.name} onClose={() => setTour(false)} />}
      <div className={`scrim ${sheetOpen ? "open" : ""}`} onClick={closeSheet} />
      <section className={`sheet ${sheetOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-bar"><div className="l"><button onClick={closeSheet}>Cerrar</button></div><h2 id="sheetTitle">{sheetDef ? sheetDef[0] : ""}</h2><div className="r" /></div>
        <div className="sheet-body">{sheetDef && (() => { const C = sheetDef[1]; return <C key={sheet.k} {...sheet.props} />; })()}</div>
      </section>
      <div className={`toast ${toastMsg ? "show" : ""}`} role="status" aria-live="polite"><Icon n="check" w="b" /><span>{toastMsg}</span></div>
    </Ctx.Provider>
  );
}

