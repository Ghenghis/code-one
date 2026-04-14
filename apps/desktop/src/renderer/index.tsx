import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import type { CodeOneAPI } from "../preload/api.js";
import "./styles/global.css";

declare global {
  interface Window {
    codeone: CodeOneAPI;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
