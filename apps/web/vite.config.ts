import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The separate Next.js project in apps/ has its own Tailwind PostCSS config.
  css: { postcss: { plugins: [] } },
  server: {
    proxy: { "/v1": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
