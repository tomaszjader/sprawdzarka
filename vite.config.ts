import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendPort = process.env.BACKEND_PORT ?? process.env.PORT ?? "8765";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": `http://127.0.0.1:${backendPort}`
    }
  }
});
