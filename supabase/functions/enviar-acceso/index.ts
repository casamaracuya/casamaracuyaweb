// Envía por correo el acceso a «Mi reserva» (el enlace con el código CM-) al titular de
// una reserva pagada. La llama el panel cuando Recepción toca «Enviar acceso por correo».
// Dirección, Administración y Recepción. Queda anotado con registrar_acceso (0020).
//
// Secretos (los mismos de enviar-comprobante, Supabase › Edge Functions › Secrets):
//   RESEND_API_KEY  llave de https://resend.com (el dominio casa-maracuya.com verificado ahí)
//   MAIL_FROM       opcional · por defecto «Casa Maracuyá <reservas@casa-maracuya.com>»
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Publicar: supabase functions deploy enviar-acceso
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { correoAcceso, TEXTOS } from "./correo.js";

const FROM = Deno.env.get("MAIL_FROM") || "Casa Maracuyá <reservas@casa-maracuya.com>";
const REPLY = "reservas@casa-maracuya.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // ¿Quién llama? La sesión del panel (el rol lo vuelve a revisar registrar_acceso).
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return json({ error: "Inicia sesión en el panel" }, 401);
    const { data: perfil } = await user.from("perfiles").select("roles").eq("id", u.id).maybeSingle();
    if (!(perfil?.roles || []).some((r: string) => ["direccion", "admin", "recepcion"].includes(r))) return json({ error: "Tu rol no envía accesos a clientes" }, 403);

    const { reserva } = await req.json();
    if (!reserva || !/^[0-9a-f-]{36}$/i.test(String(reserva))) return json({ error: "Falta la reserva" }, 400);
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r } = await db.from("reservas").select("id, localizador, estado, idioma, llegada, salida, personas, plan, huespedes(nombre, email)").eq("id", reserva).maybeSingle();
    if (!r) return json({ error: "Reserva no encontrada" }, 404);
    if (!r.localizador || !["confirmada", "casa", "finalizada"].includes(r.estado)) return json({ error: "La reserva todavía no está pagada: no tiene código para entrar" }, 400);
    const to = String(r.huespedes?.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ ok: false, sinCorreo: true });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "Falta configurar el correo (RESEND_API_KEY)" }, 500);

    const lang = r.idioma === "en" ? "en" : "es";
    const enlace = `https://casa-maracuya.com${lang === "en" ? "/en/my-booking" : "/mi-reserva"}?c=${r.localizador}`;
    const d = { nombre: r.huespedes?.nombre || "", codigo: r.localizador, llegada: r.llegada, salida: r.salida, personas: r.personas, plan: r.plan, enlace };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY, subject: TEXTOS[lang].subject(r.localizador), html: correoAcceso(d, lang, REPLY) })
    });
    if (!res.ok) return json({ error: `El servicio de correo respondió: ${(await res.text()).slice(0, 200)}` }, 502);
    // Ya salió: se anota con la sesión de quien lo pidió (así queda quién fue).
    const { error: accErr } = await user.rpc("registrar_acceso", { p_reserva: r.id });
    if (accErr) return json({ ok: true, to, aviso: "Se envió, pero no quedó anotado: " + accErr.message });
    return json({ ok: true, to });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
