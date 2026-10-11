import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  cacheDir:
    process.env.VITE_APP_MODE === "live"
      ? "node_modules/.vite-live"
      : "node_modules/.vite",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": process.env.NSUT_API_PROXY || "http://127.0.0.1:3001" },
  },
});
