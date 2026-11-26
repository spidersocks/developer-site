import React from "react";
import { createRoot } from "react-dom/client";
import Overlay from "./Overlay.jsx";
import { applyClozzzPwa, detectClozzzPwaSurface } from "./pwa.js";

/**
 * Dedicated MPA entry (no plaza chrome). Built as
 * dist/clozzz-overlay/index.html; Vercel rewrites /clozzz-overlay/*
 * here so the SPA catch-all cannot steal the path.
 */
applyClozzzPwa(detectClozzzPwaSurface());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>
);
