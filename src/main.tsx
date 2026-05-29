import './css/index.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HomeworkProvider } from "./context/HomeworkContext";
import { TimeBlockProvider } from "./context/TimeBlockContext";
import { AuthProvider } from "./context/AuthContext";

// Mobile debug console: dev builds only, visit ?debug=1 to enable on phones.
if (import.meta.env.DEV && new URLSearchParams(location.search).get("debug") === "1") {
  import("eruda").then(({ default: eruda }) => eruda.init());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <HomeworkProvider>
        <TimeBlockProvider>
          <App />
        </TimeBlockProvider>
      </HomeworkProvider>
    </AuthProvider>
  </React.StrictMode>
);
