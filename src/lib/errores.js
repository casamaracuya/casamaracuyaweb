// Monitoreo de errores: lo que falle en el navegador (web o panel) se anota en la tabla
// «errores» de Supabase (ver supabase/migrations/0008_registro_errores.sql).
// Usa fetch directo en vez de la librería de Supabase para no cargarla en páginas que no la usan.
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ruido que no viene de nuestro código: extensiones del navegador, avisos inofensivos.
const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection|chrome-extension:|moz-extension:|safari-extension:|AbortError/i;
// Después de publicar una versión nueva, quien tenía la página abierta pide archivos que ya no existen.
const STALE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

const seen = new Set(); let sent = 0;

// Token de la sesión del panel (si hay), para saber quién vio el error.
function sessionToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.*-auth-token$/.test(k)) return JSON.parse(localStorage.getItem(k))?.access_token || null;
    }
  } catch { /* sin almacenamiento */ }
  return null;
}

export function reportError(err, where = "") {
  try {
    const message = String(err?.message || err || "Error").slice(0, 500);
    if (NOISE.test(message)) return;
    if (STALE.test(message)) {
      // Una versión vieja abierta: se recarga una sola vez para tomar la nueva.
      try { if (!sessionStorage.getItem("mc-recarga")) { sessionStorage.setItem("mc-recarga", "1"); location.reload(); return; } } catch { /* */ }
    }
    if (!URL_ || !KEY || sent >= 10 || seen.has(message)) return;
    seen.add(message); sent++;
    const token = sessionToken();
    fetch(`${URL_}/rest/v1/rpc/registrar_error`, {
      method: "POST", keepalive: true,
      headers: { apikey: KEY, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        p_origen: location.pathname.startsWith("/admin") ? "panel" : "web",
        p_mensaje: message,
        p_detalle: [where, err?.stack || ""].filter(Boolean).join("\n").slice(0, 4000),
        p_pagina: location.pathname + location.search,
        p_navegador: navigator.userAgent
      })
    }).catch(() => {});
  } catch { /* el monitoreo nunca debe romper la página */ }
}

export function watchErrors() {
  addEventListener("error", e => {
    // Solo errores de nuestros archivos (o sin archivo, como los de React).
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    reportError(e.error || e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : "");
  });
  addEventListener("unhandledrejection", e => reportError(e.reason, "promesa sin manejar"));
}
