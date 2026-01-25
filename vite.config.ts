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
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        // REMOVED /auth proxy: Let React Router handle the Login Page!
        '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
      },

      // --- RESTORE THIS BLOCK ---
      // Commented out for Local Dev (http://localhost:5173) to prevent connection errors
      /*
      hmr: {
          host: undefined, // Uses window.location.hostname (dynamic)
          clientPort: 443, // Forces browser to use HTTPS/WSS
          protocol: 'wss' 
      },
      */
    },
  };
});