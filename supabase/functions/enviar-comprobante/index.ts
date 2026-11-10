// Envía por correo el comprobante de reserva y pago de una reserva confirmada.
// La llama el panel justo después de registrar el pago que confirma la reserva
// (y cuando alguien toca «Reenviar por correo»). Solo Dirección y Administración.
//
// Secretos (Supabase › Edge Functions › Secrets):
//   RESEND_API_KEY  llave de https://resend.com (el dominio casa-maracuya.com verificado ahí)
//   MAIL_FROM       opcional · por defecto «Casa Maracuyá <reservas@casa-maracuya.com>»
//   SITE_URL        opcional · por defecto https://casa-maracuya.com
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Publicar: supabase functions deploy enviar-comprobante
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SITE = Deno.env.get("SITE_URL") || "https://casa-maracuya.com";
const FROM = Deno.env.get("MAIL_FROM") || "Casa Maracuyá <reservas@casa-maracuya.com>";
const REPLY = "reservas@casa-maracuya.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const T = {
  es: {
    subject: (c: string) => `Tu reserva en Casa Maracuyá está confirmada · ${c}`,
    hi: (n: string) => `¡Hola, ${n}!`,
    intro: "Tu reserva está confirmada. Te esperamos en Adícora, frente al faro. Aquí tienes el comprobante de tu reserva y de tu pago.",
    title: "Comprobante de reserva y pago", n: "N°", emitido: "Emitido",
    llegada: "Llegada", salida: "Salida", desde: "desde las 3:00 PM", hasta: "hasta las 11:00 AM", noches: "Noches", personas: "Personas", plan: "Plan",
    concepto: "Concepto", total: "Total de la estadía", pagado: "Pagado", saldo: "Saldo pendiente", pagos: "Pagos recibidos",
    ver: "Ver y guardar el comprobante (PDF)", normas: "Normas de la casa",
    fiscal: "Este comprobante no sustituye una factura fiscal. Si necesitas factura, respóndenos este correo.",
    poli: "La tarifa no es reembolsable. Puedes cambiar la fecha avisando con al menos 15 días de anticipación, sujeto a disponibilidad.",
    motto: "Viento, mar y cero prisa.",
    plans: { esencial: "Experiencia Esencial", plena: "Experiencia Plena" } as Record<string, string>,
    locale: "es-VE"
  },
  en: {
    subject: (c: string) => `Your stay at Casa Maracuyá is confirmed · ${c}`,
    hi: (n: string) => `Hello, ${n}!`,
    intro: "Your booking is confirmed. We look forward to welcoming you in Adícora, by the lighthouse. Here is the receipt for your booking and payment.",
    title: "Booking and payment receipt", n: "No.", emitido: "Issued",
    llegada: "Check-in", salida: "Check-out", desde: "from 3:00 PM", hasta: "by 11:00 AM", noches: "Nights", personas: "Guests", plan: "Plan",
    concepto: "Description", total: "Total for the stay", pagado: "Paid", saldo: "Balance due", pagos: "Payments received",
    ver: "View and save the receipt (PDF)", normas: "House rules",
    fiscal: "This receipt is not a tax invoice. If you need one, just reply to this email.",
    poli: "Rates are non-refundable. Dates can be changed with at least 15 days' notice, subject to availability.",
    motto: "Wind, sea and no rush.",
    plans: { esencial: "Essential Experience", plena: "Full Experience" } as Record<string, string>,
    locale: "en-US"
  }
};

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Correo en tablas y con estilos en línea: así se ve igual en Gmail, Outlook y el teléfono.
// Mismos colores de la web; Cormorant y Manrope con respaldo en Georgia y Arial.
function emailHtml(d: Record<string, any>, lang: "es" | "en") {
  const t = T[lang];
  const money = (n: number) => "$" + Number(n || 0).toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const nights = Math.round((Date.parse(d.salida) - Date.parse(d.llegada)) / 864e5);
  const saldo = Math.max(0, Number(d.total) - Number(d.pagado));
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif", sans = "Manrope,'Segoe UI',Arial,sans-serif";
  const row = (k: string, v: string, strong = false) => `<tr><td style="padding:8px 0;border-bottom:1px solid #D4C7BE;font:600 11px/1.4 ${sans};letter-spacing:.12em;text-transform:uppercase;color:#5f604f">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #D4C7BE;font:${strong ? 700 : 500} 15px/1.4 ${sans};color:#2E2E24">${v}</td></tr>`;
  const pagos = (d.pagos || []).map((p: any) => `<tr><td style="padding:6px 0;font:500 14px/1.4 ${sans};color:#3D3D2A">${esc(date(p.fecha))} · ${esc(p.metodo)}</td><td align="right" style="padding:6px 0;font:600 14px/1.4 ${sans};color:#2E2E24">${money(p.monto)}</td></tr>`).join("");
  const url = `${SITE}/comprobante?c=${d.token}`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#E8DCCD">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8DCCD"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden">
  <tr><td style="padding:30px 32px 6px;text-align:center">
    <div style="font:500 28px/1 ${serif};letter-spacing:.08em;color:#2E2E24">CASA MARACUYÁ</div>
    <div style="font:700 10px/1 ${sans};letter-spacing:.24em;text-transform:uppercase;color:#C4A56C;margin-top:8px">Relaxing Getaway · Adícora, Falcón</div>
  </td></tr>
  <tr><td style="padding:22px 32px 4px">
    <p style="margin:0;font:500 26px/1.15 ${serif};color:#2E2E24">${esc(t.hi(String(d.nombre).split(" ")[0]))}</p>
    <p style="margin:10px 0 0;font:500 15px/1.6 ${sans};color:#3D3D2A">${esc(t.intro)}</p>
  </td></tr>
  <tr><td style="padding:20px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FFF4;border:1px solid #D4C7BE;border-radius:16px"><tr><td style="padding:20px 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:500 italic 22px/1.1 ${serif};color:#778B63">${esc(t.title)}</td>
        <td align="right" style="font:600 12px/1.4 ${sans};color:#5f604f">${t.n} <b style="color:#2E2E24">${esc(d.codigo)}</b><br>${t.emitido}: ${esc(date(d.emitido))}</td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
        ${row(t.llegada, `${esc(date(d.llegada))}<br><span style="color:#5f604f;font-size:13px">${t.desde}</span>`)}
        ${row(t.salida, `${esc(date(d.salida))}<br><span style="color:#5f604f;font-size:13px">${t.hasta}</span>`)}
        ${row(t.noches, String(nights))}${row(t.personas, String(d.personas))}${row(t.plan, esc(t.plans[d.plan] || d.plan))}
        ${d.concepto ? row(t.concepto, esc(d.concepto)) : ""}
        ${row(t.total, money(d.total), true)}${row(t.pagado, money(d.pagado))}${row(t.saldo, money(saldo), true)}
      </table>
      ${pagos ? `<p style="margin:16px 0 4px;font:700 11px/1 ${sans};letter-spacing:.14em;text-transform:uppercase;color:#778B63">${t.pagos}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pagos}</table>` : ""}
    </td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:24px 32px 6px">
    <a href="${url}" style="display:inline-block;padding:15px 28px;border-radius:999px;background:#C4A56C;color:#2E2E24;font:700 12px/1 ${sans};letter-spacing:.14em;text-transform:uppercase;text-decoration:none">${esc(t.ver)}</a>
    <p style="margin:14px 0 0;font:500 13px/1.5 ${sans}"><a href="${SITE}${lang === "en" ? "/en/house-rules" : "/normas"}" style="color:#3D3D2A">${esc(t.normas)}</a></p>
  </td></tr>
  <tr><td style="padding:14px 32px 26px;font:500 12px/1.6 ${sans};color:#5f604f">${esc(t.poli)}<br>${esc(t.fiscal)}</td></tr>
  <tr><td style="padding:22px 32px;background:#2E352A;color:#E8DCCD">
    <p style="margin:0;font:500 italic 20px/1.2 ${serif}">${esc(t.motto)}</p>
    <p style="margin:8px 0 0;font:500 12px/1.6 ${sans};color:#B8B89C">Adícora, Falcón, Venezuela · ${REPLY} · casa-maracuya.com</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // ¿Quién llama? Solo Dirección y Administración.
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return json({ error: "Inicia sesión en el panel" }, 401);
    const { data: perfil } = await user.from("perfiles").select("roles").eq("id", u.id).maybeSingle();
    if (!(perfil?.roles || []).some((r: string) => r === "direccion" || r === "admin")) return json({ error: "Solo Dirección y Administración envían comprobantes" }, 403);

    const { reserva } = await req.json();
    if (!reserva) return json({ error: "Falta la reserva" }, 400);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r } = await db.from("reservas").select("*, huespedes(nombre, documento, email)").eq("id", reserva).maybeSingle();
    if (!r) return json({ error: "Reserva no encontrada" }, 404);
    if (!["confirmada", "casa", "finalizada"].includes(r.estado)) return json({ error: "La reserva todavía no está confirmada" }, 400);
    const to = (r.huespedes?.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ ok: false, sinCorreo: true });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "Falta configurar el correo (RESEND_API_KEY)" }, 500);
    const { data: pagos } = await db.from("pagos").select("fecha, metodo, monto, tipo").eq("reserva_id", r.id).order("fecha");
    const lang = r.idioma === "en" ? "en" : "es";
    const d = { codigo: r.codigo, emitido: pagos?.[0]?.fecha || String(r.creado).slice(0, 10), llegada: r.llegada, salida: r.salida, personas: r.personas, plan: r.plan,
      nombre: r.huespedes?.nombre || "", concepto: r.concepto, total: r.total, pagado: r.pagado, pagos: pagos || [], token: r.comprobante_token };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY, subject: T[lang].subject(r.codigo), html: emailHtml(d, lang) })
    });
    if (!res.ok) return json({ error: `El servicio de correo respondió: ${(await res.text()).slice(0, 200)}` }, 502);
    await db.from("reservas").update({ comprobante_enviado: new Date().toISOString(), comprobante_correo: to }).eq("id", r.id);
    return json({ ok: true, to });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
