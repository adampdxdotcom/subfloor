import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    
    // This part is essential to fix the "Host not allowed" error.
    allowedHosts: [
      'flooring.dumbleigh.com'
    ],
  
    // This is essential for your API calls and images to work.
    proxy: {
      '/api': {
        target: 'http://server:3000', 
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://server:3000', 
        changeOrigin: true,
      },
    },

    // This is essential for HMR to work through the proxy.
    hmr: {
        host: 'flooring.dumbleigh.com',
        protocol: 'wss',
        clientPort: 443,
    },
  },
});