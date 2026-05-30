import './css/index.css';
import './css/Toast.css';
import './css/InstallHelpModal.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import ToastList from "./components/ToastList";
import { HomeworkProvider } from "./context/HomeworkContext";
import { TimeBlockProvider } from "./context/TimeBlockContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";

// Mobile debug console: dev builds only, visit ?debug=1 to enable on phones.
if (import.meta.env.DEV && new URLSearchParams(location.search).get("debug") === "1") {
  import("eruda").then(({ default: eruda }) => eruda.init());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <HomeworkProvider>
            <TimeBlockProvider>
              <App />
              <ToastList />
            </TimeBlockProvider>
          </HomeworkProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
