import { normalizeCatalog } from "./routines.js";

const API_BASE =
  import.meta.env.VITE_CLOZZZ_API_URL ||
  "https://unified-backend.fly.dev/clozzz";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
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
    throw new Error(message);
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

export { API_BASE };
