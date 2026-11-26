/**
 * Shared Clozzz remote gate helpers (Edge / Node / Vite).
 * Password stays in CLOZZZ_OVERLAY_PASSWORD — never baked into the client bundle.
 * Open OBS display at /clozzz-overlay is NOT gated.
 */

export const COOKIE_NAME = "clozzz_overlay_gate";
export const AUTH_PATH = "/api/clozzz-overlay-auth";

/** @param {string} password */
export async function unlockToken(password) {
  const data = new TextEncoder().encode(`clozzz-overlay-gate:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** @param {string | null | undefined} cookieHeader @param {string} name */
export function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/**
 * @param {string} token
 * @param {{ remember?: boolean, secure?: boolean }} [opts]
 */
export function buildSetCookie(token, opts = {}) {
  const remember = Boolean(opts.remember);
  const secure = opts.secure !== false;
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  if (remember) parts.push(`Max-Age=${60 * 60 * 24 * 30}`);
  return parts.join("; ");
}

/** Safe same-origin relative path for post-unlock redirect. */
export function safeNextPath(raw, fallback = "/clozzz-remote") {
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.includes("://")) return fallback;
  if (
    raw.startsWith("/clozzz-remote") ||
    raw.startsWith("/clozzz-routines") ||
    raw.startsWith("/clozzz-overlay")
  ) {
    return raw;
  }
  return fallback;
}

/**
 * After unlock, send new devices to the remote-first mode chooser.
 * Deep links that already imply a remote session or routines page are unchanged.
 */
export function postUnlockPath(raw, fallback = "/clozzz-remote/mode") {
  const next = safeNextPath(raw, fallback);
  const pathOnly = next.split("?")[0].replace(/\/+$/, "") || "/clozzz-remote";
  if (
    pathOnly === "/clozzz-remote" ||
    pathOnly === "/clozzz-overlay" ||
    pathOnly === "/clozzz-overlay/mode"
  ) {
    const qs = next.includes("?") ? next.slice(next.indexOf("?")) : "";
    return `/clozzz-remote/mode${qs}`;
  }
  return next;
}

/** Minimal gate page HTML (inline styles; no client password). */
export function gatePageHtml({ nextPath, error = "", action = AUTH_PATH }) {
  const next = safeNextPath(nextPath, "/clozzz-remote/mode");
  const errBlock = error
    ? `<p class="err" role="alert">${escapeHtml(error)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" href="/clozzz/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" href="/clozzz/favicon-32x32.png" sizes="32x32" />
  <link rel="icon" type="image/png" href="/clozzz/favicon-16x16.png" sizes="16x16" />
  <link rel="apple-touch-icon" href="/clozzz/apple-touch-icon.png" />
  <title>Clozzz remote — unlock</title>
  <style>
    :root {
      --ink: #2a2540;
      --muted: #6b6580;
      --line: #e6e1f0;
      --accent: #514b82;
      --gold: #c9a45a;
      --bg: #f6f4fb;
      --danger: #c44b4f;
      --font: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: var(--font); color: var(--ink);
      background:
        radial-gradient(ellipse at 12% 0%, rgba(246, 197, 107, 0.14) 0%, transparent 42%),
        radial-gradient(ellipse at 88% 8%, rgba(81, 75, 130, 0.12) 0%, transparent 45%),
        var(--bg);
    }
    main {
      width: min(22rem, calc(100% - 2rem));
      padding: 1.75rem 1.5rem 1.5rem;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 1rem;
      box-shadow: 0 10px 28px rgba(42, 37, 64, 0.1);
    }
    h1 { margin: 0 0 0.35rem; font-size: 1.25rem; font-weight: 650; }
    p.lead { margin: 0 0 1.1rem; color: var(--muted); font-size: 0.92rem; line-height: 1.4; }
    label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.35rem; }
    input[type="password"] {
      width: 100%; padding: 0.65rem 0.75rem; border: 1px solid var(--line);
      border-radius: 0.55rem; font: inherit; margin-bottom: 0.85rem;
    }
    input[type="password"]:focus { outline: 2px solid rgba(81, 75, 130, 0.35); border-color: var(--accent); }
    .row { display: flex; align-items: center; gap: 0.45rem; margin-bottom: 1rem; font-size: 0.88rem; color: var(--muted); }
    button {
      width: 100%; border: 0; border-radius: 0.55rem; padding: 0.7rem 1rem;
      background: linear-gradient(180deg, #5c568f, var(--accent));
      color: #fff; font: inherit; font-weight: 650; cursor: pointer;
      box-shadow: 0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 12px rgba(81, 75, 130, 0.28);
    }
    button:hover { filter: brightness(1.05); }
    button:disabled { opacity: 0.65; cursor: wait; }
    .err { color: var(--danger); font-size: 0.88rem; margin: 0 0 0.75rem; }
    .hint { margin: 1rem 0 0; font-size: 0.78rem; color: var(--muted); line-height: 1.35; }
  </style>
</head>
<body>
  <main>
    <h1>Unlock Clozzz</h1>
    <p class="lead">Remote and routines are separate gated apps. The OBS display at <strong>/clozzz-overlay</strong> stays open — no password there.</p>
    ${errBlock}
    <form id="gate" method="post" action="${escapeHtml(action)}" autocomplete="current-password">
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autofocus />
      <label class="row"><input type="checkbox" name="remember" value="1" /> Remember on this device (30 days)</label>
      <button type="submit">Unlock</button>
    </form>
    <p class="hint">Paste <code>/clozzz-overlay</code> once into OBS Browser Source. Open <code>/clozzz-remote</code> or <code>/clozzz-routines</code> deliberately — they do not link to each other.</p>
  </main>
  <script>
    const form = document.getElementById("gate");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const btn = form.querySelector("button");
      btn.disabled = true;
      let errEl = document.querySelector(".err");
      const body = new URLSearchParams(new FormData(form));
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body,
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          const msg = data.error || "Incorrect password";
          if (!errEl) {
            errEl = document.createElement("p");
            errEl.className = "err";
            errEl.setAttribute("role", "alert");
            form.parentNode.insertBefore(errEl, form);
          }
          errEl.textContent = msg;
          btn.disabled = false;
          return;
        }
        if (data.liveToken) {
          try {
            sessionStorage.setItem("clozzz_live_token", data.liveToken);
            localStorage.setItem("clozzz_live_token", data.liveToken);
          } catch (_) {}
        }
        location.replace(data.next || ${JSON.stringify(next)});
      } catch {
        btn.disabled = false;
        alert("Could not reach unlock service. Try again.");
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
