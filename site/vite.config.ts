import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: funciona no GitHub Pages em /site-estatisticas/ sem configuração extra
export default defineConfig({
  base: "./",
  plugins: [react()],
});
