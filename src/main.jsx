import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Si un enlace de Supabase (invitación, contraseña nueva o enlace vencido) cae en otra página,
// se manda al panel conservando los datos del enlace, para que ahí se cree la contraseña.
if (!location.pathname.startsWith("/admin") && /(^#|&)(access_token|error_code)=/.test(location.hash)) {
  location.replace("/admin" + location.hash);
}

// Cada parte carga su propio código y estilos: la web pública no descarga el panel.
const Site = lazy(() => import("./site/Site.jsx"));
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const Privacy = lazy(() => import("./site/Privacy.jsx"));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/admin" element={<AdminApp />} />
          <Route path="/admin/:view" element={<AdminApp />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="*" element={<Site />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);
