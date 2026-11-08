import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Llave publishable (sb_publishable_…) o, en proyectos antiguos, la llave anon. Ambas son públicas por diseño.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Los enlaces de invitación y de «olvidé mi contraseña» llegan con #type=invite o #type=recovery.
// Se lee antes de crear el cliente, porque el cliente limpia la dirección al iniciar la sesión.
const linkParams = new URLSearchParams(typeof location !== "undefined" ? location.hash.slice(1) : "");
export const LINK_TYPE = linkParams.get("type");
// Enlace vencido o ya usado: Supabase devuelve #error_code=otp_expired (u otro error).
export const LINK_ERROR = linkParams.get("error_code");

// Sin VITE_SUPABASE_URL y la llave el panel muestra un aviso de configuración.
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
// Número de reservas. Si falta VITE_WHATSAPP, usa el de la casa.
export const WHATSAPP = (import.meta.env.VITE_WHATSAPP || "584242215166").replace(/\D/g, "");
