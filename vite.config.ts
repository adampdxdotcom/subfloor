import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listens on all interfaces
    proxy: {
      // This rule was already here and is correct
      '/api': {
        target: 'http://server:3001', // Target the 'server' service name
        changeOrigin: true,
      },
      // --- ADD THIS BLOCK TO PROXY IMAGE REQUESTS ---
      '/uploads': {
        target: 'http://server:3001', // Also target the 'server' service
        changeOrigin: true,
      },
      // ---------------------------------------------
    },
    hmr: {
      // This is for your Caddy reverse proxy and is correct
      host: 'flooring.dumbleigh.com',
      protocol: 'wss',
    }
  },
});