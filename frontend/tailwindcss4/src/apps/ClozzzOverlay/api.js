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

export function fetchCatalog() {
  return request("/routines");
}

export function saveCatalog(catalog) {
  return request("/routines", {
    method: "PUT",
    body: JSON.stringify(catalog),
  });
}

export function saveRoutine(routine) {
  return request(`/routines/${encodeURIComponent(routine.id)}`, {
    method: "PUT",
    body: JSON.stringify(routine),
  });
}

export function deleteRoutine(id) {
  return request(`/routines/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function reorderRoutines(ids) {
  return request("/routines/order", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export function resetCatalogToSeed() {
  return request("/routines/seed", { method: "POST" });
}

export { API_BASE };
