import { Routes, Route } from "react-router-dom";

// Rutas de toda la app. El navegador las usa con componentes que cargan por partes (lazy);
// la compilación las usa con los componentes directos para escribir cada página en HTML.
export function AppRoutes({ C }) {
  return (
    <Routes>
      <Route path="/admin" element={<C.AdminApp />} />
      <Route path="/admin/:view" element={<C.AdminApp />} />
      <Route path="/" element={<C.Site lang="es" />} />
      <Route path="/index.html" element={<C.Site lang="es" />} />
      <Route path="/en" element={<C.Site lang="en" />} />
      <Route path="/privacidad" element={<C.Privacy lang="es" />} />
      <Route path="/en/privacy" element={<C.Privacy lang="en" />} />
      <Route path="/normas" element={<C.Normas lang="es" />} />
      <Route path="/en/house-rules" element={<C.Normas lang="en" />} />
      <Route path="/comprobante" element={<C.Comprobante />} />
      <Route path="/en/*" element={<C.NotFound lang="en" />} />
      <Route path="*" element={<C.NotFound lang="es" />} />
    </Routes>
  );
}
