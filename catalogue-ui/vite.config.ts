import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const catalogueService = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: catalogueService, changeOrigin: true },
      '/register': { target: catalogueService, changeOrigin: true },
      '/userlogin': { target: catalogueService, changeOrigin: true },
      '/logout': { target: catalogueService, changeOrigin: true },
      '/getcurrentuser': { target: catalogueService, changeOrigin: true },
      '/pingauth': { target: catalogueService, changeOrigin: true },
    },
  },
});
