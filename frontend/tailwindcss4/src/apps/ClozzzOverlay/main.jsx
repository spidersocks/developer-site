import React from "react";
import { createRoot } from "react-dom/client";
import Overlay from "./Overlay.jsx";

/**
 * Dedicated MPA entry (no plaza chrome). Vercel rewrites
 * /clozzz-overlay and /clozzz-overlay/* → clozzz-overlay.html.
 */
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>
);
