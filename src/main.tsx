import './css/index.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HomeworkProvider } from "./context/HomeworkContext";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <HomeworkProvider>
        <App />
      </HomeworkProvider>
    </AuthProvider>
  </React.StrictMode>
);
