import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Per-host base override. Vercel sets VITE_BASE_PATH=/ ; GitHub Pages
  // falls back to the project sub-path.
  const base = env.VITE_BASE_PATH ?? '/OPlanner/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // Auto-update strategy: a fresh service worker activates as soon
        // as the user navigates, no "click to update" prompt. Combined
        // with skipWaiting + clientsClaim so visitors always get the
        // latest deploy without a hard refresh.
        registerType: 'autoUpdate',
        // Emit the SW registration to a separate file (not inline) so it
        // respects our strict `script-src 'self'` CSP.
        injectRegister: 'script',

        // Don't precache the giant boxicons font file leftovers (already
        // dropped, but the glob is defensive).
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Firestore + Auth must hit the network — don't try to cache
          // their POST channels.
          navigateFallbackDenylist: [/^\/__\/auth\//, /firestore\.googleapis\.com/],
        },

        includeAssets: ['Logo.svg', 'pwa-icon.svg', 'og-image.png'],

        manifest: {
          // Keep the name short — the OS shows it as the app label in the
          // launcher and prepends it to the page <title> in the standalone
          // window. A long name here produces "OPlanner — Semester Planner
          // - OPlanner" in the title bar.
          name: 'OPlanner',
          short_name: 'OPlanner',
          description:
            'Track assignments, count down to finals, and import your course calendar.',
          // Title bar / status bar color in standalone mode. Matches the
          // dark sidebar (--bg in index.css) so the installed app frame
          // blends with the in-app chrome.
          theme_color: '#0e0f12',
          background_color: '#0e0f12',
          display: 'standalone',
          orientation: 'any',
          scope: base,
          start_url: base,
          // SVG works on Chrome/Edge/Android. iOS Safari falls back to
          // the apple-touch-icon meta in index.html (or the default
          // bookmark icon) — a future pass can add 192/512 PNGs.
          // pwa-icon.svg = green-filled square with white logo inside the
          // maskable safe zone. Solves the "white-on-white" issue Android
          // produced when the OS masked the transparent Logo.svg onto its
          // default white app-icon background.
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },

        devOptions: {
          // Enable SW in `npm run dev` too so you can test install /
          // offline behavior without a production build.
          enabled: false,
        },
      }),
    ],
    server: {
      headers: {
        // Allow Firebase popup to read window.closed across COOP boundary,
        // so popup-cancel detection isn't blocked.
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
