import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Bind to every interface so the dev site is reachable from a phone on the
    // same network. `npm run dev:client -- --host` does the same thing.
    host: true,
    proxy: {
      // The client always calls /api and /webhooks as same-origin paths, which
      // keeps it working on localhost, on a LAN IP, and in production where
      // one Hono process serves both. These forward that to the backend in dev.
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/webhooks": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
