import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Without this, Vite's default host ("localhost") binds only to
    // whatever that resolves to locally (often just IPv6 ::1) - reachable
    // via localhost:5173 but not 127.0.0.1:5173. Binding all interfaces
    // makes both work, which matters for SameSite cookie testing against a
    // local backend on 127.0.0.1: "localhost" and "127.0.0.1" are
    // different sites to the browser, so a refresh-token cookie set for
    // 127.0.0.1 needs the frontend on 127.0.0.1 too, not localhost.
    host: true,
  },
})
