import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Dev-only: allow the headless-screenshot container to reach this dev
      // server via host.docker.internal (used to visually verify WebGL
      // output during development). Ignored by the production build.
      allowedHosts: ['host.docker.internal', 'localhost'],
      // Dev-only: inotify events don't cross the Docker Desktop Windows
      // bind mount, so Vite never sees host-side edits and serves stale
      // cached modules. Polling makes file changes actually hot-reload.
      watch: { usePolling: true, interval: 300 },
    },
  };
});
