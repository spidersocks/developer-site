import { normalizeCatalog } from "./routines.js";

const API_BASE =
  import.meta.env.VITE_CLOZZZ_API_URL ||
  "https://unified-backend.fly.dev/clozzz";

const LIVE_TOKEN_KEY = "clozzz_live_token";

async function request(path, options = {}) {
  // Pull headers out before spreading options — otherwise options.headers
  // replaces the merged object and drops Content-Type (remote commands → 422).
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join("; ")
          : `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function asCatalog(data) {
  return normalizeCatalog(data);
}

export function fetchCatalog() {
  return request("/routines").then(asCatalog);
}

export function saveCatalog(catalog) {
  return request("/routines", {
    method: "PUT",
    body: JSON.stringify(catalog),
  }).then(asCatalog);
}

export function saveRoutine(routine) {
  return request(`/routines/${encodeURIComponent(routine.id)}`, {
    method: "PUT",
    body: JSON.stringify(routine),
  }).then(asCatalog);
}

export function deleteRoutine(id) {
  return request(`/routines/${encodeURIComponent(id)}`, { method: "DELETE" }).then(
    asCatalog
  );
}

export function reorderRoutines(ids) {
  return request("/routines/order", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  }).then(asCatalog);
}

export function fetchLive(routineKey) {
  return request(`/live/${encodeURIComponent(routineKey)}`);
}

export function postLiveCommand(routineKey, command, token) {
  const headers = {};
  if (token) headers["X-Clozzz-Live-Token"] = token;
  return request(`/live/${encodeURIComponent(routineKey)}/command`, {
    method: "POST",
    headers,
    body: JSON.stringify({ command }),
  });
}

export function rememberLiveToken(token) {
  if (!token) return;
  try {
    sessionStorage.setItem(LIVE_TOKEN_KEY, token);
    localStorage.setItem(LIVE_TOKEN_KEY, token);
  } catch {
    /* private mode */
  }
}

export function readLiveToken() {
  try {
    return (
      sessionStorage.getItem(LIVE_TOKEN_KEY) ||
      localStorage.getItem(LIVE_TOKEN_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}

/** Refresh live token from gate cookie when storage is empty. */
export async function ensureLiveToken() {
  const existing = readLiveToken();
  if (existing) return existing;
  try {
    const res = await fetch("/api/clozzz-overlay-auth", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (data?.liveToken) {
      rememberLiveToken(data.liveToken);
      return data.liveToken;
    }
    if (data?.gate === "off") return "";
  } catch {
    /* ignore */
  }
  return readLiveToken();
}

export { API_BASE, LIVE_TOKEN_KEY };
