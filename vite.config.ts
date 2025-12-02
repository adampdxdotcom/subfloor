import { defineConfig, loadEnv } from 'vite'; 
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      allowedHosts: true, 
    
      proxy: {
        '/api': { target: 'http://server:3001', changeOrigin: true },
        '/auth': { target: 'http://server:3001', changeOrigin: true },
        '/uploads': { target: 'http://server:3001', changeOrigin: true },
      },

      // --- RESTORE THIS BLOCK ---
      hmr: {
          host: undefined, // Uses window.location.hostname (dynamic)
          clientPort: 443, // Forces browser to use HTTPS/WSS
          protocol: 'wss' 
      },
    },
  };
});