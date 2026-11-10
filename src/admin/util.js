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

// Roles: uno por puesto del organigrama («Desglose de funciones por miembro del equipo»).
// jefe: a quién reporta. money: ve dinero. phone: ve teléfonos y documentos de los huéspedes.
export const ROLES = {
  direccion: { name: "Dirección", sub: "CEO & Founder · reservas y estrategia", icon: "crown", money: true, phone: true, jefe: null,
    tabs: ["hoy","reservas","calendario","huespedes","mas"], more: ["tareas","casa","cocina","pagos","tarifas","reportes","equipo"],
    ve: "Todo: reservas, ingresos, fichas de los huéspedes, el trabajo de cada área y el semáforo de calidad de cada estadía.",
    hace: ["Vende las fechas y cobra el 100% para confirmar","Ficha de registro de cada grupo: el titular la firma en papel y se pasa al panel","Tarifas, promociones y quién entra al panel","Revisa los informes de Calidad y los balances de Administración"],
    recibe: "Las solicitudes nuevas, cada semáforo en rojo y el informe de Calidad al final de cada estadía." },
  admin: { name: "Administración y Finanzas", sub: "Faby · contabilidad, nómina y caja chica", icon: "money", money: true, phone: true, jefe: "direccion",
    tabs: ["hoy","reservas","pagos","calendario","reportes"], more: [],
    ve: "Reservas, pagos recibidos e ingresos del mes y del año.",
    hace: ["Registra los pagos de cada reserva","Revisa los ingresos de cada mes y temporada","Contabilidad, nómina, caja chica e inventarios (en su sistema contable)"],
    recibe: "Aviso cuando una reserva apartada está por vencer sin pago." },
  operaciones: { name: "Operaciones", sub: "Robert · técnica, logística y check-in", icon: "bell", phone: true, jefe: "direccion",
    tabs: ["hoy","tareas","casa","calendario","mas"], more: ["huespedes","cocina"],
    ve: "Las tareas de todo el equipo, la casa, quién llega y cuándo, y la lista de compras.",
    hace: ["Planta eléctrica, agua dulce, calentadores y anti-salitre","Recibe y despide al grupo: recorrido, normas y llaves","Compras y logística de insumos","Supervisa a Gabriel, Victoria, Odely y Zai"],
    recibe: "«Planta, agua y calentadores listos» el día antes y «Recibir al grupo» el día de llegada." },
  mantenimiento: { name: "Áreas verdes y equipos", sub: "Gabriel · jardín, piscina y caminería", icon: "wrench", jefe: "operaciones",
    tabs: ["hoy","tareas","casa","calendario"], more: [],
    ve: "Sus tareas, los daños reportados y el estado de piscina, jardín y muelle.",
    hace: ["Riego y cuidado diario de jardines","Piscina: aspirado, cepillado y químicos","Lavado anti-salitre de la caminería y apoyo con bombas y planta"],
    recibe: "«Piscina, jardín y caminería» el día antes de cada llegada y cada daño con foto." },
  cocina: { name: "Cocina", sub: "Victoria · chef ejecutiva", icon: "chef", jefe: "operaciones",
    tabs: ["hoy","cocina","huespedes","tareas"], more: [],
    ve: "Quién llega, cuántos son, su plan, alergias, dietas, bebidas y gustos.",
    hace: ["Planifica el menú con el grupo 24 horas antes","Lista de compras para Robert (PEPS en cavas y despensa)","Adapta las recetas a las alergias de la ficha"],
    recibe: "La ficha de cocina 7 días antes de cada llegada." },
  servicio: { name: "Servicio y protocolo", sub: "Odely · bienvenida, mesa y sala", icon: "sparkle", jefe: "operaciones",
    tabs: ["hoy","huespedes","casa","tareas"], more: [],
    ve: "Quién llega, qué celebran, sus gustos y alergias, y el estado de las habitaciones.",
    hace: ["Bienvenida oficial con bebidas de cortesía","Montaje de mesa y servicio de comidas","Tendido de camas junto a Zai y Yanely"],
    recibe: "«Bienvenida y montaje de mesa» el día de llegada, con la hora estimada." },
  calidad: { name: "Calidad y auditoría", sub: "Yanely · semáforo, Yeti y apoyo en sala", icon: "check", jefe: "direccion",
    tabs: ["hoy","tareas","casa","huespedes","mas"], more: ["calendario","cocina"],
    ve: "Las tareas de todo el equipo, la casa, los huéspedes y el semáforo de cada estadía.",
    hace: ["Revisa cada área antes de que entre el huésped","Entrega y cuenta los vasos Yeti","Semáforo de calidad e informe a la CEO al final de cada estadía","Apoya a Odely en sala y en el tendido de camas"],
    recibe: "La revisión de detalle el día antes de cada llegada y el semáforo al cerrar cada estadía." },
  limpieza: { name: "Housekeeping y patrimonio", sub: "Zai · limpieza profunda y lencería", icon: "broom", jefe: "operaciones",
    tabs: ["hoy","casa","tareas"], more: [],
    ve: "El estado de cada habitación: sucia, en limpieza, lista y revisada.",
    hace: ["Limpieza y desinfección profunda con presencia invisible","Lidera el tendido de camas con Odely y Yanely","Cuida las antigüedades y controla la lencería"],
    recibe: "«Preparar habitaciones y tendido de camas» el día antes de cada llegada." },
  // Rol anterior: sus funciones pasaron a Dirección, Operaciones y Servicio. Solo sigue
  // funcionando para quien ya lo tenía; ya no se ofrece al asignar roles.
  recepcion: { name: "Recepción (anterior)", sub: "Ya no se usa: asigna Dirección, Operaciones o Servicio", icon: "bell", phone: true, legacy: true, jefe: "direccion",
    tabs: ["hoy","reservas","calendario","huespedes","tareas"], more: [],
    ve: "Solicitudes, calendario, fichas de huéspedes y llegadas y salidas de la semana.",
    hace: ["Rol anterior al organigrama actual"],
    recibe: "Aviso de cada solicitud nueva." }
};
// Quién puede hacer qué en el panel (la base de datos lo vuelve a comprobar).
export const CAN = {
  vender: ["direccion","recepcion","admin"],                           // mover reservas y crear nuevas
  recibir: ["direccion","recepcion","admin","operaciones"],            // «Ya llegaron» y «Cerrar la cuenta»
  supervisar: ["direccion","recepcion","operaciones","calidad"],       // ven y marcan tareas de todas las áreas
  habitaciones: ["direccion","limpieza","servicio","calidad","operaciones"],
  afuera: ["direccion","mantenimiento","operaciones"],                 // piscina, jardín, muelle y fechas bloqueadas
  datosHuesped: ["direccion","recepcion"],
  notasHuesped: ["direccion","recepcion","cocina","servicio","calidad"],
  compras: ["direccion","cocina","operaciones"],
  semaforo: ["direccion","calidad"]
};
export const can = (role, what) => CAN[what].includes(role);
// Semáforo de calidad: los cuatro ámbitos que revisa Calidad en cada estadía.
export const AMBITOS = {
  tecnica: { name: "Operatividad técnica", who: "Robert y Gabriel", check: "Planta eléctrica lista, bombas con presión, calentadores, piscina cristalina y caminería sin salitre." },
  cocina: { name: "Experiencia culinaria", who: "Victoria", check: "Menú planificado 24 horas antes, ingredientes frescos, tiempos de salida e higiene en cocina." },
  servicio: { name: "Servicio y protocolo", who: "Odely y Yanely", check: "Bienvenida cálida, mesa impecable, atención continua en piscina y vasos Yeti completos." },
  limpieza: { name: "Housekeeping y limpieza", who: "Zai, Odely y Yanely", check: "Habitaciones y baños impecables, camas armadas en equipo, cuidado de las antigüedades y presencia invisible." }
};
export const NIVEL = { verde: "Excelente", amarillo: "Detalle a corregir", rojo: "Fallo en estándar" };
export const VIEWS = { hoy:"Hoy", reservas:"Reservas", calendario:"Calendario", huespedes:"Huéspedes", tareas:"Tareas", cocina:"Cocina", casa:"La casa", pagos:"Ingresos", tarifas:"Tarifas", reportes:"Reportes", equipo:"Equipo", mas:"Más" };
// Áreas de las tareas, en el orden del organigrama. «recepcion» solo para tareas viejas.
export const AREAS = { direccion:"Dirección", admin:"Administración", operaciones:"Operaciones", calidad:"Calidad", mantenimiento:"Áreas verdes", cocina:"Cocina", servicio:"Servicio", limpieza:"Housekeeping", recepcion:"Recepción" };
export const AREAS_NUEVAS = Object.keys(AREAS).filter(k => k !== "recepcion");
export const AREA_C = { direccion:"var(--alga)", admin:"var(--nocturna)", operaciones:"var(--melon)", calidad:"var(--arena)", mantenimiento:"var(--verde-tabla)", cocina:"var(--sol)", servicio:"var(--laguna)", limpieza:"var(--aguacate)", recepcion:"var(--merey)" };
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
// Tarifas: cada plan tiene precio de semana y de fin de semana (por noche, casa completa).
// Fin de semana: noches de viernes, sábado y domingo, y feriados con sus vísperas.
// En temporada alta no hay precio de semana: todas las noches van a precio de fin de semana.
export const RATE_KIND = { semana: "Días de semana", finde: "Fines de semana" };
export const rateKind = s => { const k = season(s); return k === "alta" || k === "media" || parse(s).getDay() === 0 ? "finde" : "semana"; };
export const rateKey = (plan, s) => `${plan}-${rateKind(s)}`;
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
