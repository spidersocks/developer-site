import { BACKEND_API_URL } from "./constants";

const BASE_URL = BACKEND_API_URL.replace(/\/$/, "");

function buildUrl(path, query) {
  const url = new URL(
    `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  );

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)));
      } else {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url;
}

async function apiRequest(
  path,
  { method = "GET", body, accessToken, signal, query } = {}
) {
  const url = buildUrl(path, query);

  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const isJson =
      response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json") ?? false;

    const payload =
      response.status === 204
        ? null
        : isJson
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

    if (!response.ok) {
      const message =
        (payload && payload.detail) ||
        (typeof payload === "string" && payload) ||
        `Request failed with status ${response.status}`;

      return {
        ok: false,
        status: response.status,
        data: payload,
        error: new Error(message),
      };
    }

    return { ok: true, status: response.status, data: payload };
  } catch (error) {
    const normalized =
      error instanceof Error ? error : new Error(String(error));
    return { ok: false, status: 0, data: null, error: normalized };
  }
}

export const apiClient = {
  listPatients: ({ token, userId, signal } = {}) =>
    apiRequest("/patients", {
      accessToken: token,
      signal,
      query: {
        user_id: userId,
        limit: 1000,
        offset: 0,
        starred_only: undefined,
      },
    }),

  createPatient: ({ token, payload }) =>
    apiRequest("/patients", {
      method: "POST",
      accessToken: token,
      body: payload,
    }),

  updatePatient: ({ token, patientId, payload }) =>
    apiRequest(`/patients/${patientId}`, {
      method: "PATCH",
      accessToken: token,
      body: payload,
    }),

  deletePatient: ({ token, patientId }) =>
    apiRequest(`/patients/${patientId}`, {
      method: "DELETE",
      accessToken: token,
    }),

  listConsultations: ({
    token,
    userId,
    patientId,
    includePatient,
    signal,
  } = {}) =>
    apiRequest("/consultations", {
      accessToken: token,
      signal,
      query: {
        user_id: userId,
        patient_id: patientId,
        limit: 250,
        offset: 0,
        include_patient: includePatient ? "true" : undefined,
      },
    }),

  createConsultation: ({ token, payload }) =>
    apiRequest("/consultations", {
      method: "POST",
      accessToken: token,
      body: payload,
    }),

  updateConsultation: ({ token, consultationId, payload }) =>
    apiRequest(`/consultations/${consultationId}`, {
      method: "PATCH",
      accessToken: token,
      body: payload,
    }),

  deleteConsultation: ({ token, consultationId }) =>
    apiRequest(`/consultations/${consultationId}`, {
      method: "DELETE",
      accessToken: token,
    }),

  listTranscriptSegments: ({ token, consultationId, signal, includeEntities } = {}) =>
    apiRequest(`/transcript-segments/consultations/${consultationId}/segments`, {
      accessToken: token,
      signal,
      query: {
        include_entities: includeEntities ? "true" : undefined,
      },
    }),

  createTranscriptSegment: ({ token, consultationId, payload }) =>
    apiRequest(`/transcript-segments/consultations/${consultationId}/segments`, {
      method: "POST",
      accessToken: token,
      body: payload,
    }),

  updateTranscriptSegment: ({ token, segmentId, payload }) =>
    apiRequest(`/transcript-segments/segments/${segmentId}`, {
      method: "PATCH",
      accessToken: token,
      body: payload,
    }),

  deleteTranscriptSegment: ({ token, segmentId }) =>
    apiRequest(`/transcript-segments/segments/${segmentId}`, {
      method: "DELETE",
      accessToken: token,
    }),

  getClinicalNote: ({ token, consultationId, signal }) =>
    apiRequest(`/clinical-notes/consultations/${consultationId}/clinical-note`, {
      accessToken: token,
      signal,
    }),

  upsertClinicalNote: ({ token, consultationId, payload }) =>
    apiRequest(`/clinical-notes/consultations/${consultationId}/clinical-note`, {
      method: "PUT",
      accessToken: token,
      body: payload,
    }),
};

export { apiRequest };