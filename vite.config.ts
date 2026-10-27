import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// The app's version, from package.json. Bump it there to ship a release:
// the Release workflow tags and publishes it when it reaches main.
const APP_VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

// version.json next to index.html names the deployed build, so a running
// app can tell what a waiting update is (and check without a service
// worker). Not precached, so it always reflects the newest deploy.
const versionFile = (): Plugin => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) });
  },
});

// The CSP meta in index.html allows bare ws:/wss: so Vite's HMR websocket
// works in dev. Production has no HMR, and an open ws:/wss: would let an
// XSS payload exfiltrate to any host — strip it from the built HTML so
// connect-src only reaches the explicitly listed Firebase endpoints.
const tightenCspForProd = (): Plugin => ({
  name: 'tighten-csp-for-prod',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      /(<meta http-equiv="Content-Security-Policy"[^>]*connect-src[^"]*?) ws: wss:/,
      '$1'
    );
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Per-host base override. Vercel sets VITE_BASE_PATH=/ ; GitHub Pages
  // falls back to the project sub-path.
  const base = env.VITE_BASE_PATH ?? '/OPlanner/';

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    plugins: [
      react(),
      tightenCspForProd(),
      versionFile(),
      VitePWA({
        // 'prompt' here really means "apply on next launch": the new SW
        // downloads in the background and waits; we never show a prompt or
        // skipWaiting, so the running session stays on its build and the
        // next app open starts directly on the new one. No mid-session
        // reload. Safe against white screens because the old precache
        // (all js/css chunks) stays intact until the new SW activates.
        registerType: 'prompt',
        // PwaReloadPrompt registers the SW via `useRegisterSW`, so disable
        // the plugin's auto-injected registration to avoid double-register.
        injectRegister: null,

        // Our own SW (src/sw.ts) so it can handle Web Push. It keeps the
        // generated SW's precache, navigation fallback and outdated-cache
        // cleanup; the plugin only injects the precache manifest.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        },

        includeAssets: ['Logo.svg', 'pwa-icon.svg', 'og-image.png', 'notification-icon.png', 'notification-badge.png'],

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
          // pwa-icon.svg = green rounded square with white logo centered.
          // Solves the "white-on-white" issue Android produced when the OS
          // masked the transparent Logo.svg onto its default white
          // app-icon background.
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
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
