import './css/index.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HomeworkProvider } from "./context/HomeworkContext";
import { AuthProvider } from "./context/AuthContext";
import { StudyProvider } from "./context/StudyContext";

// Mobile debug console: visit ?debug=1 to enable on phones.
if (new URLSearchParams(location.search).get("debug") === "1") {
  import("eruda").then(({ default: eruda }) => eruda.init());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <HomeworkProvider>
        <StudyProvider>
          <App />
        </StudyProvider>
      </HomeworkProvider>
    </AuthProvider>
  </React.StrictMode>
);
