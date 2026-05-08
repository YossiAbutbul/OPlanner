import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Override per-host: GitHub Pages = '/OPlanner/', Vercel = '/'
    base: env.VITE_BASE_PATH ?? '/OPlanner/',
    server: {
      headers: {
        // Allow Firebase popup to read window.closed across COOP boundary,
        // so popup-cancel detection isn't blocked.
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
