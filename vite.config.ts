import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(() => {
  const clientPort = Number(process.env.CLIENT_PORT ?? 5173);
  const apiTarget = `http://localhost:${Number(process.env.PORT ?? 3001)}`;

  return {
    root: 'client',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client')
      }
    },
    server: {
      port: clientPort,
      host: true,
      proxy: {
        '/api': apiTarget,
        '/socket.io': { target: apiTarget, ws: true }
      }
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true
    }
  };
});
