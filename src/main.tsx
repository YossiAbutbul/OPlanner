import './css/index.css'
import './css/index.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HomeworkProvider } from "./context/HomeworkContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HomeworkProvider>
      <App />
    </HomeworkProvider>
  </React.StrictMode>
);
