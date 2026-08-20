import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress third-party extension errors (e.g. Grammarly, password managers)
if (typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      if (
        event.message?.includes("Illegal constructor") ||
        event.filename?.includes("Grammarly") ||
        event.filename?.includes("extension") ||
        event.filename?.includes("content-script")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById("root")!).render(<App />);
