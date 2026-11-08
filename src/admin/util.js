// Fechas, textos y reglas compartidas del panel.
export const pad = n => String(n).padStart(2, "0");
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const T0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
export const TODAY = isoOf(T0);
export const day = n => { const d = new Date(T0); d.setDate(d.getDate() + n); return isoOf(d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoOf(d); };
export const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
export const MESL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
export const DIA = ["dom","lun","mar","mié","jue","vie","sáb"];
export const DIAL = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
export const fdate = s => { const d = parse(s); return `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
export const frange = (a, b) => { const A = parse(a), B = parse(b); return A.getMonth() === B.getMonth() ? `${A.getDate()}–${B.getDate()} ${MES[B.getMonth()]}` : `${A.getDate()} ${MES[A.getMonth()]} – ${B.getDate()} ${MES[B.getMonth()]}`; };
export const rel = s => { const n = diff(TODAY, s); if (n === 0) return "hoy"; if (n === 1) return "mañana"; if (n === -1) return "ayer"; if (n > 1 && n < 7) return `en ${n} días`; if (n < 0) return `hace ${-n} días`; return fdate(s); };
export const money = n => "$" + Math.round(n || 0).toLocaleString("es-VE");
export const ago = t => { const m = Math.round((Date.now() - t) / 6e4); if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`; const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`; return `hace ${Math.round(h / 24)} d`; };
export const left = t => { const m = Math.max(0, Math.round((t - Date.now()) / 6e4)); const h = Math.floor(m / 60); return h ? `${h} h ${pad(m % 60)} min` : `${m} min`; };
export const initials = s => (s || "").replace(/^(Familia|Grupo)\s+/i, "").split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map(w => w[0]).join("") || "·";
export const nights = r => diff(r.in, r.out);

// Roles (del documento «Sistema Casa Maracuyá»)
export const ROLES = {
  direccion: { name: "Dirección", sub: "La dueña", icon: "crown", money: true, phone: true,
    tabs: ["hoy","reservas","calendario","huespedes","mas"], more: ["tareas","casa","pagos","tarifas","reportes","equipo"],
    ve: "Todo: ocupación, ingresos, reservas, huéspedes y el trabajo de cada área.",
    hace: ["Tarifas por temporada y promociones","Descuentos especiales","Quién entra al panel y con qué permisos"],
    recibe: "Un resumen semanal: ocupación, ingresos y lo que necesita su atención." },
  admin: { name: "Administración", sub: "Pagos y compras", icon: "money", money: true, phone: true,
    tabs: ["hoy","reservas","pagos","calendario","reportes"], more: [],
    ve: "Reservas, pagos recibidos e ingresos del mes y del año.",
    hace: ["Registra anticipos y pagos finales","Revisa los ingresos de cada mes","Ve qué temporadas y días se llenan"],
    recibe: "Aviso cuando una pre-reserva está por vencer sin pago." },
  recepcion: { name: "Recepción", sub: "La anfitriona del huésped", icon: "bell", phone: true,
    tabs: ["hoy","reservas","calendario","huespedes","tareas"], more: [],
    ve: "Solicitudes, calendario, fichas de huéspedes y llegadas y salidas de la semana.",
    hace: ["Responde WhatsApp y mueve los estados de la reserva","Recibe y despide a los huéspedes","Convierte pedidos en tareas para el área correcta"],
    recibe: "Aviso de cada solicitud nueva y la ficha de llegada el día antes." },
  cocina: { name: "Cocina", sub: "El chef y su equipo", icon: "chef",
    tabs: ["hoy","cocina","huespedes","tareas"], more: [],
    ve: "Quién llega, cuántos son, su plan (Esencial o Plena), alergias, dietas y gustos.",
    hace: ["Arma el menú de cada estadía","Lista de compras e insumos","Anota lo que más le gustó a cada huésped"],
    recibe: "La ficha de cocina 7 días antes y el recordatorio 48 horas antes." },
  limpieza: { name: "Limpieza", sub: "Habitaciones y lencería", icon: "broom",
    tabs: ["hoy","casa","tareas"], more: [],
    ve: "Estado de cada habitación: sucia, en limpieza, lista, revisada.",
    hace: ["Prepara la casa con lista de verificación","Pone los detalles de bienvenida (toallas, bolsos)","Lavandería y reposición"],
    recibe: "Las tareas de preparación según la hora de llegada." },
  mantenimiento: { name: "Mantenimiento", sub: "Piscina, jardín y casa", icon: "wrench",
    tabs: ["hoy","tareas","casa","calendario"], more: [],
    ve: "Tareas pendientes, reportes de daños y el calendario de mantenimiento.",
    hace: ["Piscina y jardín antes de cada llegada","Arregla lo que se reporta","Bloquea fechas si algo no está listo"],
    recibe: "Cada daño reportado como tarea con foto." }
};
export const VIEWS = { hoy:"Hoy", reservas:"Reservas", calendario:"Calendario", huespedes:"Huéspedes", tareas:"Tareas", cocina:"Cocina", casa:"La casa", pagos:"Ingresos", tarifas:"Tarifas", reportes:"Reportes", equipo:"Equipo", mas:"Más" };
export const AREAS = { recepcion:"Recepción", cocina:"Cocina", limpieza:"Limpieza", mantenimiento:"Mantenimiento", admin:"Administración" };
export const AREA_C = { recepcion:"var(--melon)", cocina:"var(--arena)", limpieza:"var(--aguacate)", mantenimiento:"var(--verde-tabla)", admin:"var(--nocturna)" };
export const FLOW = ["nueva","conversacion","pre","confirmada","casa","finalizada"];
export const STATE = { nueva:"Nueva", conversacion:"En conversación", pre:"Pre-reservada", confirmada:"Confirmada", casa:"En casa", finalizada:"Finalizada", rechazada:"Rechazada", vencida:"Vencida", cancelada:"Cancelada" };
export const STATE_SHORT = { nueva:"Nueva", conversacion:"Conversa", pre:"Apartada", confirmada:"Confirmada", casa:"En casa", finalizada:"Salió" };
export const HOLDS = ["pre","confirmada","casa"];
export const PLAN = { esencial:{ name:"Experiencia Esencial", short:"Esencial", meals:["Desayunos gourmet","Café de la tía"] }, plena:{ name:"Experiencia Plena", short:"Plena", meals:["Desayunos","Almuerzos","Cenas","Postres","Snacks y cava"] } };
export const ROOM_ST = ["sucia","limpiando","lista","revisada"];
export const ROOM_LB = { sucia:"Sucia", limpiando:"En limpieza", lista:"Lista", revisada:"Revisada" };
export const METODOS = ["Zelle","Pago móvil","Transferencia","Efectivo USD"];
export const CANALES = ["Instagram","WhatsApp","Google","Recomendación","Web"];

export function monthStats(S, y, mo) {
  const days = new Date(y, mo + 1, 0).getDate(); let n = 0;
  for (let d = 1; d <= days; d++) { const s = `${y}-${pad(mo + 1)}-${pad(d)}`; if (S.reservas.some(r => ["confirmada","casa","finalizada"].includes(r.state) && r.in <= s && s < r.out)) n++; }
  const pre = `${y}-${pad(mo + 1)}`;
  return { days, nights: n, occ: Math.round(n / days * 100), cash: S.payments.filter(p => p.date.startsWith(pre)).reduce((s, p) => s + p.amount, 0) };
}
export function conflict(S, r, from = r.in, to = r.out) {
  const o = S.reservas.find(x => x.id !== r.id && HOLDS.includes(x.state) && x.in < to && from < x.out);
  if (o) return `Esas noches ya están tomadas por ${(S.guests[o.g] || {}).name} (${frange(o.in, o.out)}).`;
  const b = S.blocks.find(x => x.from < to && from < x.to);
  if (b) return `La casa está bloqueada del ${frange(b.from, b.to)}: ${b.reason}.`;
  return null;
}

// Temporadas. Alta: Carnaval, Semana Santa, julio, agosto y diciembre (Carnaval y Semana Santa se calculan con la Pascua).
// Media: noches de viernes y sábado, y noches de feriado o víspera de feriado. Baja: el resto.
export const SEASONS = { alta: "Temporada alta", media: "Temporada media", baja: "Temporada baja" };
export const SEASON_DESC = {
  alta: "Carnaval, Semana Santa, julio, agosto y diciembre.",
  media: "Viernes, sábados, feriados y sus vísperas.",
  baja: "Domingo a jueves, el resto del año."
};
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return isoOf(new Date(y, mo - 1, da));
}
const HOLY = {};
function highDates(y) {
  if (HOLY[y]) return HOLY[y];
  const e = easter(y);
  const fixed = ["01-01", "04-19", "05-01", "06-24", "07-05", "07-24", "10-12", "12-24", "12-25", "12-31"].map(x => `${y}-${x}`);
  return (HOLY[y] = { carnaval: [addDays(e, -51), addDays(e, -46)], santa: [addDays(e, -7), addDays(e, 1)], fixed: new Set(fixed) });
}
// Temporada de la NOCHE que empieza en la fecha s.
export function season(s) {
  const d = parse(s), y = d.getFullYear(), mo = d.getMonth(); const H = highDates(y);
  if (mo === 6 || mo === 7 || mo === 11) return "alta";
  if ((s >= H.carnaval[0] && s < H.carnaval[1]) || (s >= H.santa[0] && s < H.santa[1])) return "alta";
  const dow = d.getDay();
  if (dow === 5 || dow === 6 || H.fixed.has(s) || H.fixed.has(addDays(s, 1))) return "media";
  return "baja";
}
// Cada noche de una reserva: [fecha, reserva].
export const nightsList = r => { const out = []; for (let s = r.in; s < r.out; s = addDays(s, 1)) out.push(s); return out; };
export const SOLD = ["confirmada", "casa", "finalizada"];

// Cumpleaños: cuántos días faltan y cómo decirlo («hoy», «en 5 días», «12 de marzo»).
export function nextBirthday(iso) {
  if (!iso) return null; const b = parse(iso); let d = new Date(T0.getFullYear(), b.getMonth(), b.getDate());
  if (d < T0) d = new Date(T0.getFullYear() + 1, b.getMonth(), b.getDate());
  const days = Math.round((d - T0) / 864e5);
  const label = days === 0 ? "hoy" : days === 1 ? "mañana" : days < 30 ? `en ${days} días` : `el ${b.getDate()} de ${MESL[b.getMonth()]}`;
  return { days, label, date: isoOf(d) };
}
// Quiénes de la ficha cumplen años entre la llegada y la salida.
export function birthdaysIn(g, from, to) {
  const hit = (iso) => { if (!iso) return false; const b = parse(iso); for (let s = from; s <= to; s = addDays(s, 1)) { const d = parse(s); if (d.getMonth() === b.getMonth() && d.getDate() === b.getDate()) return true; } return false; };
  return [hit(g.birthday) && g.name.split(" ")[0], ...(g.companions || []).filter(c => hit(c.birthday)).map(c => c.name)].filter(Boolean);
}
