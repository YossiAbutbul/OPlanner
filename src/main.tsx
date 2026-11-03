// Side-effect import first: registers the beforeinstallprompt listener at the
// earliest point so the in-app install button can fire the real native prompt.
import './utility/installPrompt';
// Applies the saved appearance (Light / Dark) before first paint.
import './utility/theme';
import './css/index.css';
import 'sileo/styles.css';
import './css/sileo.css';
import './css/InstallHelpModal.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import NotFound from "./components/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import AppToaster from "./components/AppToaster";
import ToastLab from "./components/ToastLab";
import PwaReloadPrompt from "./components/PwaReloadPrompt";
import { HomeworkProvider } from "./context/HomeworkContext";
import { TimeBlockProvider } from "./context/TimeBlockContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CoinsProvider } from "./context/CoinsContext";
import { PomodoroProvider } from "./context/PomodoroContext";
import { NotificationProvider } from "./context/NotificationContext";
import { UpdateProvider } from "./context/UpdateContext";

// Dev-only toast playground: visit ?toastlab=1 to fire every toast kind from
// every position.
const showToastLab =
  import.meta.env.DEV && new URLSearchParams(location.search).get("toastlab") === "1";

// Mobile debug console: dev builds only, visit ?debug=1 to enable on phones.
if (import.meta.env.DEV && new URLSearchParams(location.search).get("debug") === "1") {
  import("eruda").then(({ default: eruda }) => eruda.init());
}

// The app has no client-side router — it lives only at the configured base
// path (/ on Vercel, /OPlanner/ on GitHub Pages). The host serves index.html
// for every path, so an unknown URL like /1 would otherwise silently render
// the full app. Compare against the base and show a 404 instead.
const normalizePath = (p: string) => p.replace(/\/+$/, "") || "/";
const isKnownRoute =
  normalizePath(window.location.pathname) === normalizePath(import.meta.env.BASE_URL);

// Marks the page idle while its window isn't focused or visible, and holds
// the looping animations still meanwhile. Only the infinite ones: a one-shot
// entrance paused at its first frame (opacity 0) would leave the page blank
// when the app opens without focus.
const loops = () =>
  document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity);
const markIdle = () => {
  const idle = document.visibilityState !== "visible" || !document.hasFocus();
  document.documentElement.toggleAttribute("data-idle", idle);
  for (const a of loops()) {
    if (idle && a.playState === "running") a.pause();
    else if (!idle && a.playState === "paused") a.play();
  }
};
window.addEventListener("focus", markIdle);
window.addEventListener("blur", markIdle);
document.addEventListener("visibilitychange", markIdle);
markIdle();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isKnownRoute ? (
        <ToastProvider>
          <UpdateProvider>
          <AuthProvider>
            <CoinsProvider>
              <PomodoroProvider>
                <HomeworkProvider>
                  <TimeBlockProvider>
                    <NotificationProvider>
                      <App />
                      <AppToaster />
                      {showToastLab && <ToastLab />}
                      <PwaReloadPrompt />
                    </NotificationProvider>
                  </TimeBlockProvider>
                </HomeworkProvider>
              </PomodoroProvider>
            </CoinsProvider>
          </AuthProvider>
          </UpdateProvider>
        </ToastProvider>
      ) : (
        <NotFound />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
