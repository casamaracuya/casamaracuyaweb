// Cada página tiene una dirección por idioma: así Google guarda las dos versiones por separado.
export const PATHS = {
  home: { es: "/", en: "/en/" },
  privacy: { es: "/privacidad", en: "/en/privacy" },
  normas: { es: "/normas", en: "/en/house-rules" }
};
export const SITE_URL = "https://casa-maracuya.com";

const LANG_KEY = "maracuya-idioma";
export const saveLang = l => { try { localStorage.setItem(LANG_KEY, l); } catch { /* sin almacenamiento */ } };
export const savedLang = () => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } };
