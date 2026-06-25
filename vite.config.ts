import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is opt-in for this Express middleware setup to avoid websocket port conflicts.
      hmr: process.env.ENABLE_HMR === 'true',
      // Disable file watching unless HMR is explicitly enabled to save CPU during agent edits.
      watch: process.env.ENABLE_HMR === 'true' ? {} : null,
    },
  };
});
