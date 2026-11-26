// El correo con el acceso a «Mi reserva». Lo usa index.ts (Supabase) y, para ver cómo
// queda, scripts/vista-correo-acceso.mjs. Tablas y estilos en línea: se ve igual en
// Gmail, Outlook y el teléfono. Mismos colores y letras que el correo del comprobante.
// Sin precios: los montos están en el comprobante.

export const TEXTOS = {
  es: {
    subject: c => `Tu reserva en Casa Maracuyá · ${c} · llena tu ficha antes de llegar`,
    hi: n => `¡Hola, ${n}!`,
    intro: "Tu reserva está confirmada y ya tienes tu apartado en Casa Maracuyá. Antes de llegar, llena la ficha de registro: te toma unos 5 minutos y te ahorra el papeleo en la casa.",
    codigo: "Tu código de reserva", llegada: "Llegada", salida: "Salida", desde: "desde las 3:00 PM", hasta: "hasta las 11:00 AM",
    personas: "Personas", plan: "Plan", plans: { esencial: "Experiencia Esencial", plena: "Experiencia Plena" },
    boton: "Entrar a mi reserva", como: "Entras con tu código y tu apellido.",
    pasos: "Cómo funciona",
    p1: ["Llena la ficha", "Los datos de quienes se quedan en la casa, un contacto de emergencia, la comida y si traes mascota."],
    p2: ["Lee las normas y firma", "Con el dedo, desde el celular. Sin imprimir nada."],
    p3: ["Todo de tu estadía en un solo lugar", "Horarios, cómo llegar, tu comprobante y las normas de la casa."],
    ayuda: "¿Dudas? Responde este correo o escríbenos por WhatsApp.",
    copia: "Si el botón no abre, copia este enlace en tu navegador:",
    motto: "Viento, mar y cero prisa.", locale: "es-VE"
  },
  en: {
    subject: c => `Your stay at Casa Maracuyá · ${c} · fill in your form before you arrive`,
    hi: n => `Hello, ${n}!`,
    intro: "Your booking is confirmed and your guest page at Casa Maracuyá is ready. Before you arrive, please fill in the registration form: it takes about 5 minutes and saves you the paperwork at the house.",
    codigo: "Your booking code", llegada: "Check-in", salida: "Check-out", desde: "from 3:00 PM", hasta: "by 11:00 AM",
    personas: "Guests", plan: "Plan", plans: { esencial: "Essential Experience", plena: "Full Experience" },
    boton: "Open my booking", como: "You sign in with your code and your last name.",
    pasos: "How it works",
    p1: ["Fill in the form", "Who's staying at the house, an emergency contact, food preferences and whether you're bringing a pet."],
    p2: ["Read the rules and sign", "With your finger, from your phone. Nothing to print."],
    p3: ["Everything about your stay in one place", "Times, directions, your receipt and the house rules."],
    ayuda: "Questions? Just reply to this email or message us on WhatsApp.",
    copia: "If the button doesn't open, copy this link into your browser:",
    motto: "Wind, sea and no rush.", locale: "en-US"
  }
};

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// d: { nombre, codigo, llegada, salida, personas, plan, enlace }
export function correoAcceso(d, lang, reply) {
  const t = TEXTOS[lang] || TEXTOS.es;
  const date = s => new Date(s + "T00:00:00Z").toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const serif = "'Cormorant Garamond',Georgia,'Times New Roman',serif", sans = "Manrope,'Segoe UI',Arial,sans-serif";
  const row = (k, v) => `<tr><td style="padding:8px 0;border-bottom:1px solid #D4C7BE;font:600 11px/1.4 ${sans};letter-spacing:.12em;text-transform:uppercase;color:#5f604f">${k}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #D4C7BE;font:500 15px/1.4 ${sans};color:#2E2E24">${v}</td></tr>`;
  const paso = (n, [h, p]) => `<tr><td valign="top" width="40" style="padding:8px 0"><div style="width:30px;height:30px;border-radius:15px;background:#C4A56C;color:#2E2E24;font:700 14px/30px ${sans};text-align:center">${n}</div></td>
    <td style="padding:8px 0"><div style="font:700 15px/1.3 ${sans};color:#2E2E24">${esc(h)}</div><div style="font:500 14px/1.5 ${sans};color:#3D3D2A;margin-top:2px">${esc(p)}</div></td></tr>`;
  const nombre = String(d.nombre || "").trim().split(/\s+/)[0];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.subject(d.codigo))}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#E8DCCD">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8DCCD"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden">
  <tr><td style="padding:30px 32px 6px;text-align:center">
    <div style="font:500 28px/1 ${serif};letter-spacing:.08em;color:#2E2E24">CASA MARACUYÁ</div>
    <div style="font:700 10px/1 ${sans};letter-spacing:.24em;text-transform:uppercase;color:#C4A56C;margin-top:8px">Relaxing Getaway · Adícora, Falcón</div>
  </td></tr>
  <tr><td style="padding:22px 32px 4px">
    <p style="margin:0;font:500 26px/1.15 ${serif};color:#2E2E24">${esc(t.hi(nombre))}</p>
    <p style="margin:10px 0 0;font:500 15px/1.6 ${sans};color:#3D3D2A">${esc(t.intro)}</p>
  </td></tr>
  <tr><td style="padding:20px 32px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FFF4;border:1px solid #D4C7BE;border-radius:16px"><tr><td style="padding:20px 22px">
      <div style="font:700 11px/1 ${sans};letter-spacing:.16em;text-transform:uppercase;color:#778B63">${esc(t.codigo)}</div>
      <div style="font:800 28px/1.2 ${sans};letter-spacing:.08em;color:#2E2E24;margin-top:6px">${esc(d.codigo)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
        ${row(t.llegada, `${esc(date(d.llegada))}<br><span style="color:#5f604f;font-size:13px">${t.desde}</span>`)}
        ${row(t.salida, `${esc(date(d.salida))}<br><span style="color:#5f604f;font-size:13px">${t.hasta}</span>`)}
        ${row(t.personas, esc(d.personas))}${row(t.plan, esc(t.plans[d.plan] || d.plan))}
      </table>
    </td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:26px 32px 4px">
    <a href="${esc(d.enlace)}" style="display:inline-block;padding:16px 30px;border-radius:999px;background:#C4A56C;color:#2E2E24;font:700 13px/1 ${sans};letter-spacing:.14em;text-transform:uppercase;text-decoration:none">${esc(t.boton)}</a>
    <p style="margin:12px 0 0;font:500 13px/1.5 ${sans};color:#5f604f">${esc(t.como)}</p>
  </td></tr>
  <tr><td style="padding:22px 32px 6px">
    <div style="font:500 italic 22px/1.1 ${serif};color:#778B63;margin-bottom:6px">${esc(t.pasos)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${paso(1, t.p1)}${paso(2, t.p2)}${paso(3, t.p3)}</table>
  </td></tr>
  <tr><td style="padding:12px 32px 26px;font:500 13px/1.6 ${sans};color:#5f604f">${esc(t.ayuda)}<br><span style="font-size:12px">${esc(t.copia)} <a href="${esc(d.enlace)}" style="color:#3D3D2A">${esc(d.enlace)}</a></span></td></tr>
  <tr><td style="padding:22px 32px;background:#2E352A;color:#E8DCCD">
    <p style="margin:0;font:500 italic 20px/1.2 ${serif}">${esc(t.motto)}</p>
    <p style="margin:8px 0 0;font:500 12px/1.6 ${sans};color:#B8B89C">Adícora, Falcón, Venezuela · ${esc(reply)} · casa-maracuya.com</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
