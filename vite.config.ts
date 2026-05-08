import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/OPlanner/',
  server: {
    headers: {
      // Allow Firebase popup to read window.closed across COOP boundary,
      // so popup-cancel detection isn't blocked.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
});
