import { defineConfig, loadEnv } from 'vite'; // Import loadEnv
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  // Parse the domain from .env (removes https://)
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return 'localhost';
    }
  };

  const hostname = getHostname(env.VITE_APP_DOMAIN || 'http://localhost');

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      
      // Dynamic Allowed Host
      allowedHosts: [
        hostname
      ],
    
      proxy: {
        '/api': {
          target: 'http://server:3001', 
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://server:3001', 
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://server:3001', 
          changeOrigin: true,
        },
      },

      // Dynamic HMR Host
      hmr: {
          host: hostname,
          protocol: env.VITE_APP_DOMAIN?.startsWith('https') ? 'wss' : 'ws',
          clientPort: env.VITE_APP_DOMAIN?.startsWith('https') ? 443 : 5173,
      },
    },
  };
});