// Datos de contacto de la casa. Van aparte de supabase.js para que las páginas
// que no usan la base de datos (privacidad, 404) no descarguen su librería.
// Número de reservas. Si falta VITE_WHATSAPP, usa el de la casa.
export const WHATSAPP = (import.meta.env.VITE_WHATSAPP || "584242215166").replace(/\D/g, "");
export const EMAIL = "reservas@casa-maracuya.com";
// Ficha de Google (Perfil de Negocio «Posada Casa Maracuyá»).
export const PLACE_ID = "ChIJrblpUxWvhY4RAvRES0r0ETE";
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=Posada%20Casa%20Maracuy%C3%A1&query_place_id=${PLACE_ID}`;
export const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;
