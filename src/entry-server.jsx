// Solo se usa al compilar: escribe cada página pública en HTML (ver scripts/prerender.mjs).
import { StrictMode, Suspense } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AppRoutes } from "./routes.jsx";
import Site from "./site/Site.jsx";
import Privacy from "./site/Privacy.jsx";
import Normas from "./site/Normas.jsx";
import NotFound from "./site/NotFound.jsx";

// El comprobante solo existe en el navegador (depende del enlace privado de cada reserva).
const C = { Site, Privacy, Normas, NotFound, Comprobante: () => null, AdminApp: () => null };

export function render(url) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <Suspense fallback={null}>
          <AppRoutes C={C} />
        </Suspense>
      </StaticRouter>
    </StrictMode>
  );
}
