import { StrictMode, Suspense, lazy } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes.jsx";
import { savedLang } from "./site/paths.js";
import { watchErrors, reportError } from "./lib/errores.js";

watchErrors();

// Si un enlace de Supabase (invitación, contraseña nueva o enlace vencido) cae en otra página,
// se manda al panel conservando los datos del enlace, para que ahí se cree la contraseña.
if (!location.pathname.startsWith("/admin") && /(^#|&)(access_token|error_code)=/.test(location.hash)) {
  location.replace("/admin" + location.hash);
}

// Idioma automático: quien entra a la portada con el navegador en inglés (y no eligió español)
// pasa a /en/. Los buscadores no se redirigen, para que guarden cada versión en su dirección.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless/i;
if (location.pathname === "/" && !BOT.test(navigator.userAgent)) {
  const saved = savedLang();
  if (saved ? saved === "en" : (navigator.language || "").toLowerCase().startsWith("en")) location.replace("/en/" + location.search + location.hash);
}

// Cada parte carga su propio código y estilos: la web pública no descarga el panel.
const C = {
  Site: lazy(() => import("./site/Site.jsx")),
  AdminApp: lazy(() => import("./admin/AdminApp.jsx")),
  Privacy: lazy(() => import("./site/Privacy.jsx")),
  NotFound: lazy(() => import("./site/NotFound.jsx"))
};

const app = (
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <AppRoutes C={C} />
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);

// Las páginas públicas llegan ya escritas en el HTML: React se engancha a ellas sin volver a dibujarlas.
const root = document.getElementById("root");
if (root.hasChildNodes()) hydrateRoot(root, app, { onRecoverableError: e => reportError(e, "hidratación") });
else createRoot(root).render(app);
