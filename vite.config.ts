import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // Import the path module

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://server:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://server:3001',
        changeOrigin: true,
      },
    },
    hmr: {
      host: 'flooring.dumbleigh.com',
      protocol: 'wss',
    },
    // --- THIS IS THE FINAL, CRITICAL FIX ---
    // Tell Vite's file watcher to completely ignore the server's uploads and temp-uploads directories.
    // This will prevent it from locking the folders during the restore process.
    watch: {
      ignored: [
        path.resolve(__dirname, 'server/uploads'),
        path.resolve(__dirname, 'server/temp-uploads'),
      ],
    },
  },
});