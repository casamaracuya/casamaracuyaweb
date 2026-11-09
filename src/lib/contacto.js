// Datos de contacto de la casa. Van aparte de supabase.js para que las páginas
// que no usan la base de datos (privacidad, 404) no descarguen su librería.
// Número de reservas. Si falta VITE_WHATSAPP, usa el de la casa.
export const WHATSAPP = (import.meta.env.VITE_WHATSAPP || "584242215166").replace(/\D/g, "");
export const EMAIL = "reservas@casa-maracuya.com";
