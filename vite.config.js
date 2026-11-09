import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // manifest: lo usa scripts/prerender.mjs para saber qué CSS y JS necesita cada página.
  build: { target: "es2020", sourcemap: false, manifest: true }
});
