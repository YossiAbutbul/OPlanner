// Side-effect import first: registers the beforeinstallprompt listener at the
// earliest point so the in-app install button can fire the real native prompt.
import './utility/installPrompt';
import './css/index.css';
import './css/Toast.css';
import './css/InstallHelpModal.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import NotFound from "./components/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import ToastList from "./components/ToastList";
import PwaReloadPrompt from "./components/PwaReloadPrompt";
import { HomeworkProvider } from "./context/HomeworkContext";
import { TimeBlockProvider } from "./context/TimeBlockContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CoinsProvider } from "./context/CoinsContext";
import { PomodoroProvider } from "./context/PomodoroContext";
import { NotificationProvider } from "./context/NotificationContext";
import { PlanProvider } from "./context/PlanContext";

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isKnownRoute ? (
        <ToastProvider>
          <AuthProvider>
            <CoinsProvider>
              <PomodoroProvider>
                <HomeworkProvider>
                  <TimeBlockProvider>
                    <NotificationProvider>
                      <PlanProvider>
                        <App />
                        <ToastList />
                        <PwaReloadPrompt />
                      </PlanProvider>
                    </NotificationProvider>
                  </TimeBlockProvider>
                </HomeworkProvider>
              </PomodoroProvider>
            </CoinsProvider>
          </AuthProvider>
        </ToastProvider>
      ) : (
        <NotFound />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
