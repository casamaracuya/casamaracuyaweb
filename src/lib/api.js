// Capa de datos del panel: todas las consultas a Supabase.
import { supabase } from "./supabase.js";

const friendly = (e) => {
  const m = (e && (e.message || e.details)) || String(e);
  if (e && e.code === "23P01") return "Esas noches ya están tomadas por otra reserva.";
  if (/row-level security|permission/i.test(m)) return "Tu rol no tiene permiso para hacer esto.";
  return m;
};
const ok = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };
const ms = t => (t ? new Date(t).getTime() : null);
const myId = async () => (await supabase.auth.getSession()).data.session?.user?.id || null;
// Reconoce a un huésped por los últimos 10 dígitos de su teléfono.
export const telNorm = p => (p || "").replace(/\D/g, "").slice(-10);
export const findGuest = (S, phone) => {
  const n = telNorm(phone); if (n.length < 7) return null;
  const hit = Object.entries(S.guests).find(([, g]) => (g.telNorm || telNorm(g.phone)) === n);
  return hit ? hit[0] : null;
};

/* ===================== Supabase ===================== */
const real = {
  async session() { const { data } = await supabase.auth.getSession(); return data.session; },
  onAuth(cb) { const { data } = supabase.auth.onAuthStateChange((e, s) => cb(s, e)); return () => data.subscription.unsubscribe(); },
  async signIn(email, password) { ok(await supabase.auth.signInWithPassword({ email, password })); },
  async resetPassword(email) { ok(await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin` })); },
  async updatePassword(password) { ok(await supabase.auth.updateUser({ password })); },
  async signOut() { await supabase.auth.signOut(); },
  // Cada persona escribe su propio nombre (al aceptar la invitación o desde Perfil).
  async setMiNombre(_S, name) {
    const n = name.trim().replace(/s+/g, " ");
    await supabase.auth.updateUser({ data: { nombre: n } });
    ok(await supabase.rpc("fijar_mi_nombre", { p_nombre: n }));
  },
  async me() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const p = ok(await supabase.from("perfiles").select("*").eq("id", user.id).maybeSingle());
    // Si el perfil todavía tiene el nombre sacado del correo, usa el que la persona escribió al entrar.
    const auto = !p?.nombre || p.nombre === user.email.split("@")[0];
    return { id: user.id, email: user.email, name: (auto && user.user_metadata?.nombre) || p?.nombre || user.email, roles: p?.roles || [] };
  },
  async load() {
    await supabase.rpc("liberar_vencidas");
    const q = t => supabase.from(t).select("*");
    const [hu, ac, re, ta, ha, ex, bl, pa, co, me, tf, pr, pe] = await Promise.all([
      q("huespedes"), q("acompanantes").order("creado"), q("reservas"), q("tareas").order("creado"), q("habitaciones").order("orden"), q("exteriores").order("orden"),
      q("bloqueos").order("desde"), q("pagos"), q("compras").order("creado", { ascending: false }),
      q("menus"), q("tarifas"), q("promociones").order("nombre"), q("perfiles").order("nombre")
    ]);
    // Semáforo de calidad: la base de datos solo se lo entrega a Dirección y Calidad.
    const au = await q("auditorias");
    // Cartas de menú (0013). Si la tabla aún no existe, el editor funciona pero no guarda.
    const ca = await q("cartas").order("creado");
    const S = {
      guests: {}, reservas: [], tasks: [], rooms: [], outside: [], blocks: [], payments: [], shopping: [], menus: {}, rates: {}, promos: [], team: [], audits: [], cartas: null
    };
    (hu.data || []).forEach(g => S.guests[g.id] = { name: g.nombre, city: g.ciudad, phone: g.telefono, telNorm: g.tel_norm || "", email: g.email || "", doc: g.documento || "", birthday: g.cumple,
      allergies: g.alergias || [], likes: g.gustos || [], dislikes: g.no_le_gusta || [], notes: g.notas || "", pet: g.mascota, visits: g.visitas, kite: g.kite, celebra: g.celebra, companions: [] });
    (ac.data || []).forEach(a => S.guests[a.huesped_id]?.companions.push({ id: a.id, name: a.nombre, rel: a.relacion, birthday: a.cumple, allergies: a.alergias, notes: a.notas, doc: a.documento || "", age: a.edad }));
    S.reservas = (re.data || []).map(r => ({ id: r.id, code: r.codigo, g: r.huesped_id, plan: r.plan, people: r.personas, pet: r.mascota, in: r.llegada, out: r.salida, state: r.estado, channel: r.canal, lang: r.idioma || "es", created: ms(r.creado), hold: ms(r.vence_en), notes: r.notas,
      // Ficha de registro: la llena el huésped en papel y el equipo la pasa al panel.
      total: +r.total || 0, concept: r.concepto || "", receiptToken: r.comprobante_token, receiptSent: ms(r.comprobante_enviado), receiptTo: r.comprobante_correo || "",
      ficha: { filled: !!r.ficha_en, at: ms(r.ficha_en), by: r.ficha_por, signed: ms(r.ficha_firmada), firma: r.ficha_firma || "", arrival: r.hora_llegada || "", adults: r.adultos, kids: r.ninos,
        vehicles: r.vehiculos || [], drinks: r.bebidas || "", needs: r.requerimientos || "", reason: r.motivo || "", petName: r.mascota_nombre || "", petBreed: r.mascota_raza || "", people: r.ocupantes || [] } }));
    S.tasks = (ta.data || []).map(t => ({ id: t.id, area: t.area, title: t.titulo, res: t.reserva_id, due: t.para, time: t.hora, done: t.hecha, damage: t.dano, photoPath: t.foto_url,
      who: t.asignada_a, doing: !!t.en_proceso && !t.hecha, doneBy: t.hecha_por, doneAt: ms(t.hecha_en) }));
    const withPhoto = S.tasks.filter(t => t.photoPath);
    if (withPhoto.length) {
      const { data } = await supabase.storage.from("danos").createSignedUrls(withPhoto.map(t => t.photoPath), 3600);
      (data || []).forEach((d, i) => { withPhoto[i].photo = d.signedUrl; });
    }
    S.rooms = (ha.data || []).map(h => ({ id: h.id, name: h.nombre, note: h.nota, img: h.foto, state: h.estado }));
    S.outside = (ex.data || []).map(e => ({ id: e.id, name: e.nombre, ok: e.al_dia }));
    S.blocks = (bl.data || []).map(b => ({ id: b.id, from: b.desde, to: b.hasta, reason: b.motivo }));
    S.payments = (pa.data || []).map(p => ({ id: p.id, res: p.reserva_id, amount: +p.monto, method: p.metodo, date: p.fecha, kind: p.tipo }));
    const paid = {}; S.payments.forEach(p => { paid[p.res] = (paid[p.res] || 0) + p.amount; });
    S.reservas.forEach(r => { r.paid = paid[r.id] || 0; });
    S.shopping = (co.data || []).map(c => ({ id: c.id, text: c.texto, done: c.hecho }));
    (me.data || []).forEach(m => S.menus[m.reserva_id] = m.texto);
    (tf.data || []).forEach(t => S.rates[t.clave] = t.monto == null ? "" : String(t.monto));
    S.promos = (pr.data || []).map(p => ({ id: p.id, name: p.nombre, on: p.activa }));
    S.team = (pe.data || []).map(p => ({ id: p.id, name: p.nombre, roles: p.roles || [], phone: p.telefono || "" }));
    S.audits = (au.data || []).map(a => ({ id: a.id, res: a.reserva_id, area: a.ambito, level: a.nivel, note: a.nota, at: ms(a.creado) }));
    if (!ca.error) S.cartas = (ca.data || []).map(c => ({ id: c.id, name: c.nombre, data: c.datos || {}, updated: ms(c.actualizado) }));
    return S;
  },
  subscribe(onChange) {
    let t; const ping = () => { clearTimeout(t); t = setTimeout(onChange, 400); };
    const ch = supabase.channel("cambios");
    ["reservas","tareas","habitaciones","exteriores","bloqueos","pagos","compras","menus","huespedes","acompanantes","auditorias"].forEach(table =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, ping));
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  },
  async cambiarEstado(_S, id, to) { ok(await supabase.rpc("cambiar_estado", { p_reserva: id, p_estado: to })); },
  async registrarPago(_S, id, amount, method, total = null, concept = null) { ok(await supabase.rpc("registrar_pago", { p_reserva: id, p_monto: amount, p_metodo: method, p_total: total, p_concepto: concept })); },
  async fijarTotal(_S, id, total, concept) { ok(await supabase.rpc("fijar_total", { p_reserva: id, p_total: total, p_concepto: concept })); },
  // Correo con el comprobante (función enviar-comprobante en Supabase). Devuelve { ok, to } o { sinCorreo: true }.
  async enviarComprobante(_S, id) {
    const { data, error } = await supabase.functions.invoke("enviar-comprobante", { body: { reserva: id } });
    if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch { /* sin detalle */ } throw new Error(m); }
    return data;
  },
  // Si el teléfono ya existe, usa la ficha de ese huésped en vez de crear otra.
  async crearReserva(S, d) {
    let gid = d.guestId || findGuest(S, d.phone);
    if (!gid) gid = ok(await supabase.from("huespedes").insert({ nombre: d.name, telefono: d.phone }).select("id").single()).id;
    const r = ok(await supabase.from("reservas").insert({ huesped_id: gid, plan: d.plan, personas: d.people, mascota: d.pet, llegada: d.in, salida: d.out, estado: "conversacion", canal: d.channel, notas: d.notes }).select("id").single());
    return r.id;
  },
  async crearHuesped(S, name, phone) {
    const found = findGuest(S, phone); if (found) return found;
    return ok(await supabase.from("huespedes").insert({ nombre: name, telefono: phone || "" }).select("id").single()).id;
  },
  async crearTarea(_S, d) {
    let foto_url = null;
    if (d.file) {
      const path = `${crypto.randomUUID()}.${(d.file.name.split(".").pop() || "jpg").toLowerCase()}`;
      ok(await supabase.storage.from("danos").upload(path, d.file, { contentType: d.file.type }));
      foto_url = path;
    }
    ok(await supabase.from("tareas").insert({ area: d.area, titulo: d.title, reserva_id: d.res || null, para: d.due, dano: !!d.damage, foto_url, asignada_a: d.who || null }));
  },
  async setTarea(_S, id, done) {
    const me = await myId();
    ok(await supabase.from("tareas").update(done ? { hecha: true, en_proceso: false, hecha_por: me, hecha_en: new Date().toISOString() } : { hecha: false, hecha_por: null, hecha_en: null }).eq("id", id));
  },
  // Empezar una tarea: si nadie la tenía, queda a nombre de quien la empieza.
  async enProceso(S, id, on) {
    const t = S.tasks.find(x => x.id === id); const me = await myId();
    ok(await supabase.from("tareas").update(on ? { en_proceso: true, hecha: false, asignada_a: t?.who || me } : { en_proceso: false }).eq("id", id));
  },
  async asignarTarea(_S, id, who) { ok(await supabase.from("tareas").update({ asignada_a: who === "me" ? await myId() : who }).eq("id", id)); },
  async setCompra(_S, id, done) { ok(await supabase.from("compras").update({ hecho: done }).eq("id", id)); },
  async addCompra(_S, text) { ok(await supabase.from("compras").insert({ texto: text })); },
  async guardarCarta(_S, c) {
    const row = { nombre: c.name || "Menú", datos: c.data || {} };
    if (c.id) { ok(await supabase.from("cartas").update(row).eq("id", c.id)); return c.id; }
    return ok(await supabase.from("cartas").insert(row).select("id").single()).id;
  },
  async borrarCarta(_S, id) { ok(await supabase.from("cartas").delete().eq("id", id)); },
  async setMenu(_S, resId, text) { ok(await supabase.from("menus").upsert({ reserva_id: resId, texto: text })); },
  async nextRoom(_S, id) { ok(await supabase.rpc("siguiente_estado_habitacion", { p_id: id })); },
  async setExterior(_S, id, v) { ok(await supabase.from("exteriores").update({ al_dia: v }).eq("id", id)); },
  async addBloqueo(_S, b) { ok(await supabase.from("bloqueos").insert({ desde: b.from, hasta: b.to, motivo: b.reason })); },
  async delBloqueo(_S, id) { ok(await supabase.from("bloqueos").delete().eq("id", id)); },
  async setTarifa(_S, k, v) { ok(await supabase.from("tarifas").upsert({ clave: k, monto: v === "" ? null : Number(v.replace(",", ".")) })); },
  async setPromo(_S, id, on) { ok(await supabase.from("promociones").update({ activa: on }).eq("id", id)); },
  async addPromo(_S, name) { ok(await supabase.from("promociones").insert({ nombre: name, activa: false })); },
  // Ficha del huésped
  async updateHuesped(_S, gid, patch) {
    const col = { name: "nombre", city: "ciudad", phone: "telefono", email: "email", doc: "documento", birthday: "cumple", pet: "mascota", celebra: "celebra", kite: "kite", notes: "notas", allergies: "alergias", likes: "gustos", dislikes: "no_le_gusta" };
    const row = {}; Object.entries(patch).forEach(([k, v]) => { row[col[k]] = k === "birthday" ? (v || null) : v; });
    ok(await supabase.from("huespedes").update(row).eq("id", gid));
  },
  async addAcomp(_S, gid, a) { ok(await supabase.from("acompanantes").insert({ huesped_id: gid, nombre: a.name, relacion: a.rel || "", cumple: a.birthday || null, alergias: a.allergies || "", notas: a.notes || "" })); },
  async delAcomp(_S, id) { ok(await supabase.from("acompanantes").delete().eq("id", id)); },
  async setAuditoria(_S, resId, ambito, nivel, nota) { ok(await supabase.from("auditorias").upsert({ reserva_id: resId, ambito, nivel, nota: nota || "" }, { onConflict: "reserva_id,ambito" })); },
  async guardarFicha(_S, resId, data) { ok(await supabase.rpc("guardar_ficha", { p_reserva: resId, p: data })); },
  async setRoles(_S, uid, roles) { ok(await supabase.from("perfiles").update({ roles }).eq("id", uid)); },
  async setTelefono(_S, uid, tel) { ok(await supabase.from("perfiles").update({ telefono: tel }).eq("id", uid)); },
};

export const api = real;

/* ===================== Web pública ===================== */
export async function crearSolicitud(d) {
  if (!supabase) return null;
  return ok(await supabase.rpc("crear_solicitud", {
    p_nombre: d.name, p_telefono: d.phone || "", p_plan: d.plan, p_personas: d.people, p_mascota: d.pet,
    p_llegada: d.in, p_salida: d.out, p_notas: d.notes || "", p_canal: d.channel || "Web", p_idioma: d.lang || "es"
  }));
}
export async function nochesOcupadas(from, to) {
  if (!supabase) return [];
  const { data } = await supabase.rpc("noches_ocupadas", { p_desde: from, p_hasta: to });
  return data || [];
}

/* ===================== Comprobante (enlace privado, solo lectura) ===================== */
export async function leerComprobante(token) {
  if (!supabase) throw new Error("Sin conexión con la base de datos");
  return ok(await supabase.rpc("leer_comprobante", { p_token: token }));
}
