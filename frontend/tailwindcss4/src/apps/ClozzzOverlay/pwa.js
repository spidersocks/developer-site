/**
 * Per-surface web app manifests + Apple home-screen meta.
 * Shared /clozzz/site.webmanifest used to always open the overlay; each
 * surface now installs with its own start_url / scope / name.
 */

const SURFACES = {
  overlay: {
    title: "Clozzz Overlay",
    appleTitle: "Clozzz Overlay",
    manifest: "/clozzz/overlay.webmanifest",
    themeColor: "#120e22",
  },
  remote: {
    title: "Clozzz Remote",
    appleTitle: "Clozzz Remote",
    manifest: "/clozzz/remote.webmanifest",
    themeColor: "#120e22",
  },
  routines: {
    title: "Clozzz Routines",
    appleTitle: "Clozzz Routines",
    manifest: "/clozzz/routines.webmanifest",
    themeColor: "#514b82",
  },
};

function ensureMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function ensureManifest(href) {
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "manifest");
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}

/** Apply manifest + titles for overlay | remote | routines. */
export function applyClozzzPwa(surface) {
  const cfg = SURFACES[surface] || SURFACES.overlay;
  if (typeof document === "undefined") return;
  document.title = cfg.title;
  ensureManifest(cfg.manifest);
  ensureMeta("apple-mobile-web-app-title", cfg.appleTitle);
  ensureMeta("apple-mobile-web-app-capable", "yes");
  ensureMeta("mobile-web-app-capable", "yes");
  ensureMeta("theme-color", cfg.themeColor);
}

export function detectClozzzPwaSurface(location = window.location) {
  const path = (location.pathname || "").replace(/\/+$/, "") || "/";
  if (path === "/clozzz-routines" || path.startsWith("/clozzz-routines/")) {
    return "routines";
  }
  if (
    path === "/clozzz-remote" ||
    path.startsWith("/clozzz-remote/") ||
    /\/clozzz-overlay(?:\.html)?\/[^/]+\/remote$/i.test(path)
  ) {
    return "remote";
  }
  return "overlay";
}
