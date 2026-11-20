import React from "react";
import { createRoot } from "react-dom/client";
import Overlay from "./Overlay.jsx";

/**
 * Dedicated MPA entry (no plaza chrome). Built as
 * dist/clozzz-overlay/index.html; Vercel rewrites /clozzz-overlay/*
 * here so the SPA catch-all cannot steal the path.
 */
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>
);
