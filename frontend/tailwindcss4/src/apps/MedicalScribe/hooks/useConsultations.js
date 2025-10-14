import { useEffect, useState } from "react";
import { DEFAULT_CONSULTATION, ENABLE_BACKGROUND_SYNC } from "../utils/constants";
import { generatePatientId, generatePatientName } from "../utils/helpers";
import { syncService } from "../utils/syncService";

/**
 * LocalStorage keys used by the consultations hook.
 */
const STORAGE_KEYS = {
  consultations: "consultations",
  activeConsultationId: "activeConsultationId",
  patients: "patients"
};

/**
 * Converts any supported representation of transcript segments into a Map.
 * @param {Map<string, any>|Array<[string, any]>|Record<string, any>|null|undefined} value
 * @returns {Map<string, any>}
 */
const toTranscriptMap = (value) => {
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return new Map(value);
  if (value && typeof value === "object") return new Map(Object.entries(value));
  return new Map();
};

/**
 * Serializes a consultation for LocalStorage persistence.
 * @param {Record<string, any>} consultation
 * @returns {Record<string, any>}
 */
const serializeConsultationForStorage = (consultation) => ({
  ...consultation,
  transcriptSegments: Array.from(
    toTranscriptMap(consultation.transcriptSegments).entries()
  )
});

/**
 * Rehydrates a consultation pulled from LocalStorage.
 * @param {Record<string, any>} raw
 * @param {string|null} ownerUserId
 * @returns {Record<string, any>}
 */
const deserializeConsultationFromStorage = (raw, ownerUserId) => ({
  ...DEFAULT_CONSULTATION,
  ...raw,
  ownerUserId: raw?.ownerUserId ?? ownerUserId ?? null,
  transcriptSegments: toTranscriptMap(raw?.transcriptSegments)
});

/**
 * Rehydrates a patient pulled from LocalStorage.
 * @param {Record<string, any>} raw
 * @param {string|null} ownerUserId
 * @returns {Record<string, any>}
 */
const deserializePatientFromStorage = (raw, ownerUserId) => {
  const name = raw?.name ?? raw?.displayName ?? "";
  return {
    ...raw,
    name,
    displayName: raw?.displayName ?? name,
    ownerUserId: raw?.ownerUserId ?? ownerUserId ?? null
  };
};

/**
 * Hook responsible for managing patients, consultations, and their persistence.
 * Optionally accepts an ownerUserId so background sync can attribute records.
 *
 * @param {string|null} ownerUserId
 * @returns {object}
 */
export const useConsultations = (ownerUserId = null) => {
  const safeOwnerUserId = ownerUserId ?? null;

  const [consultations, setConsultations] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.consultations);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((consultation) =>
        deserializeConsultationFromStorage(consultation, safeOwnerUserId)
      );
    } catch {
      return [];
    }
  });

  const [activeConsultationId, setActiveConsultationId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.activeConsultationId);
    return saved || null;
  });

  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.patients);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((patient) =>
        deserializePatientFromStorage(patient, safeOwnerUserId)
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const toPersist = consultations.map(serializeConsultationForStorage);
    localStorage.setItem(STORAGE_KEYS.consultations, JSON.stringify(toPersist));
  }, [consultations]);

  useEffect(() => {
    if (activeConsultationId) {
      localStorage.setItem(STORAGE_KEYS.activeConsultationId, activeConsultationId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.activeConsultationId);
    }
  }, [activeConsultationId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patients));
  }, [patients]);

  const queuePatientSync = (patient) => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !patient?.id) return;

    syncService.enqueuePatientUpsert({
      id: patient.id,
      ownerUserId: safeOwnerUserId,
      displayName: patient.displayName ?? patient.name ?? "",
      profile: patient.profile ?? {},
      createdAt: patient.createdAt ?? patient.updatedAt ?? new Date().toISOString(),
      updatedAt: patient.updatedAt ?? patient.createdAt ?? new Date().toISOString()
    });
  };

  const queueConsultationSync = (consultation) => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !consultation?.id) return;
    if (!consultation.patientId) return;

    const normalized = {
      ...DEFAULT_CONSULTATION,
      ...consultation
    };

    const createdAt =
      normalized.createdAt ??
      normalized.updatedAt ??
      new Date().toISOString();

    syncService.enqueueConsultationUpsert({
      id: normalized.id,
      ownerUserId: safeOwnerUserId,
      patientId: normalized.patientId,
      patientName: normalized.patientName ?? "Unknown Patient",
      title:
        normalized.title ??
        normalized.name ??
        `Consultation ${normalized.id}`,
      noteType: normalized.noteType ?? "General",
      language: normalized.language ?? "en-US",
      additionalContext: normalized.additionalContext ?? "",
      speakerRoles: normalized.speakerRoles ?? {},
      sessionState: normalized.sessionState ?? "idle",
      connectionStatus: normalized.connectionStatus ?? "disconnected",
      hasShownHint: Boolean(normalized.hasShownHint),
      customNameSet: Boolean(normalized.customNameSet),
      activeTab: normalized.activeTab ?? "transcript",
      createdAt,
      updatedAt: normalized.updatedAt ?? createdAt
    });
  };

  /**
   * Add or upsert a patient profile without creating a consultation.
   */
  const addNewPatient = (patientProfile) => {
    const patientId = generatePatientId(patientProfile);
    const patientName = generatePatientName(patientProfile);
    const timestamp = new Date().toISOString();

    let patientForSync = null;

    setPatients((prev) => {
      const existing = prev.find((p) => p.id === patientId);

      if (existing) {
        const updatedPatient = {
          ...existing,
          name: patientName,
          displayName: patientName,
          profile: { ...patientProfile },
          updatedAt: timestamp,
          ownerUserId: existing.ownerUserId ?? safeOwnerUserId
        };
        patientForSync = updatedPatient;
        return prev.map((p) => (p.id === patientId ? updatedPatient : p));
      }

      const newPatient = {
        id: patientId,
        name: patientName,
        displayName: patientName,
        profile: { ...patientProfile },
        createdAt: timestamp,
        updatedAt: timestamp,
        ownerUserId: safeOwnerUserId
      };
      patientForSync = newPatient;
      return [...prev, newPatient];
    });

    setActiveConsultationId(null);

    if (patientForSync) {
      queuePatientSync(patientForSync);
    }
  };

  /**
   * Create a consultation for the specified patient.
   */
  const addConsultationForPatient = (patientId) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    const now = new Date().toISOString();
    const newId = Date.now().toString();
    const patientConsultations = consultations.filter(
      (c) => c.patientId === patientId
    );
    const consultationNumber = patientConsultations.length + 1;

    const newConsultation = {
      ...DEFAULT_CONSULTATION,
      id: newId,
      name: `Consultation ${consultationNumber}`,
      createdAt: null,
      updatedAt: now,
      transcriptSegments: new Map(),
      patientProfile: { ...patient.profile },
      patientId: patient.id,
      patientName: patient.name ?? patient.displayName,
      ownerUserId: patient.ownerUserId ?? safeOwnerUserId
    };

    let consultationForSync = null;

    setConsultations((prev) => {
      consultationForSync = newConsultation;
      return [...prev, newConsultation];
    });

    setActiveConsultationId(newId);

    if (consultationForSync) {
      queueConsultationSync(consultationForSync);
    }
  };

  /**
   * Update a consultation and optionally its associated patient profile.
   */
  const updateConsultation = (id, updates) => {
    let consultationForSync = null;
    let patientForSync = null;

    setConsultations((prev) =>
      prev.map((consultation) => {
        if (consultation.id !== id) return consultation;

        const now = new Date().toISOString();
        const nextTranscriptSegments =
          updates.transcriptSegments !== undefined
            ? toTranscriptMap(updates.transcriptSegments)
            : consultation.transcriptSegments;

        const updatedConsultation = {
          ...consultation,
          ...updates,
          transcriptSegments: nextTranscriptSegments,
          updatedAt: now,
          ownerUserId: consultation.ownerUserId ?? safeOwnerUserId
        };

        if (updates.patientProfile) {
          const profile = {
            ...consultation.patientProfile,
            ...updates.patientProfile
          };
          const derivedPatientId = generatePatientId(profile);
          const derivedPatientName = generatePatientName(profile);

          updatedConsultation.patientProfile = profile;
          updatedConsultation.patientId = derivedPatientId;
          updatedConsultation.patientName = derivedPatientName;

          setPatients((prevPatients) => {
            const patientNow = new Date().toISOString();
            const existingPatient = prevPatients.find(
              (patient) => patient.id === derivedPatientId
            );

            if (existingPatient) {
              const revisedPatient = {
                ...existingPatient,
                name: derivedPatientName,
                displayName: derivedPatientName,
                profile,
                updatedAt: patientNow,
                ownerUserId: existingPatient.ownerUserId ?? safeOwnerUserId
              };
              patientForSync = revisedPatient;
              return prevPatients.map((patient) =>
                patient.id === derivedPatientId ? revisedPatient : patient
              );
            }

            const createdPatient = {
              id: derivedPatientId,
              name: derivedPatientName,
              displayName: derivedPatientName,
              profile,
              createdAt: patientNow,
              updatedAt: patientNow,
              ownerUserId: safeOwnerUserId
            };
            patientForSync = createdPatient;
            return [...prevPatients, createdPatient];
          });
        }

        consultationForSync = updatedConsultation;
        return updatedConsultation;
      })
    );

    if (consultationForSync) {
      queueConsultationSync(consultationForSync);
    }
    if (patientForSync) {
      queuePatientSync(patientForSync);
    }
  };

  /**
   * Remove a consultation from local state. (Remote deletion TBD.)
   */
  const deleteConsultation = (id) => {
    setConsultations((prev) => {
      const filtered = prev.filter((consultation) => consultation.id !== id);

      if (activeConsultationId === id) {
        if (filtered.length > 0) {
          setActiveConsultationId(filtered[0].id);
        } else {
          setActiveConsultationId(null);
        }
      }

      return filtered;
    });

    if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId) {
      console.warn(
        "[useConsultations] Consultation deletions are not yet synced to DynamoDB."
      );
    }
  };

  /**
   * Delete a patient and their consultations from local state. (Remote deletion TBD.)
   */
  const deletePatient = (patientId) => {
    setConsultations((prev) => {
      const filtered = prev.filter((consultation) => consultation.patientId !== patientId);

      const activeWasDeleted = prev.find(
        (consultation) =>
          consultation.id === activeConsultationId &&
          consultation.patientId === patientId
      );

      if (activeWasDeleted) {
        if (filtered.length > 0) {
          setActiveConsultationId(filtered[0].id);
        } else {
          setActiveConsultationId(null);
        }
      }

      return filtered;
    });

    setPatients((prev) => prev.filter((patient) => patient.id !== patientId));

    if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId) {
      console.warn(
        "[useConsultations] Patient deletions are not yet synced to DynamoDB."
      );
    }
  };

  /**
   * Reset a consultation to its initial state.
   */
  const resetConsultation = (id) => {
    updateConsultation(id, {
      transcriptSegments: new Map(),
      interimTranscript: "",
      interimSpeaker: null,
      notes: null,
      error: null,
      loading: false,
      sessionState: "idle"
    });
  };

  /**
   * Finalize the createdAt timestamp once the note is generated.
   */
  const finalizeConsultationTimestamp = (id) => {
    let consultationForSync = null;

    setConsultations((prev) =>
      prev.map((consultation) => {
        if (consultation.id !== id) return consultation;
        if (consultation.createdAt !== null && consultation.createdAt !== undefined) {
          return consultation;
        }

        const now = new Date().toISOString();
        const updatedConsultation = {
          ...consultation,
          createdAt: now,
          updatedAt: now
        };

        consultationForSync = updatedConsultation;
        return updatedConsultation;
      })
    );

    if (consultationForSync) {
      queueConsultationSync(consultationForSync);
    }
  };

  const activeConsultation = consultations.find(
    (consultation) => consultation.id === activeConsultationId
  );

  return {
    consultations,
    patients,
    activeConsultation,
    activeConsultationId,
    setActiveConsultationId,
    addNewPatient,
    addConsultationForPatient,
    updateConsultation,
    deleteConsultation,
    deletePatient,
    resetConsultation,
    finalizeConsultationTimestamp,
    setConsultations
  };
};