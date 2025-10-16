import { useEffect, useState } from "react";
import { DEFAULT_CONSULTATION, ENABLE_BACKGROUND_SYNC } from "../utils/constants";
import { generatePatientId, generatePatientName } from "../utils/helpers";
import { syncService } from "../utils/syncService";
import { hydrateAll } from "../utils/hydrationService";

/**
 * LocalStorage keys used by the consultations hook.
 */
const STORAGE_KEYS = {
  consultations: "consultations",
  activeConsultationId: "activeConsultationId",
  patients: "patients",
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
  transcriptSegments: Array.from(toTranscriptMap(consultation.transcriptSegments).entries()),
});

/**
 * Rehydrates a consultation pulled from LocalStorage.
 * @param {Record<string, any>} raw
 * @param {string|null} ownerUserId
 * @returns {Record<string, any>}
 */
const deserializeConsultationFromStorage = (raw, ownerUserId) => {
  const derivedName = raw?.name ?? raw?.title ?? null;

  return {
    ...DEFAULT_CONSULTATION,
    ...raw,
    name: derivedName ?? DEFAULT_CONSULTATION.name,
    title: raw?.title ?? derivedName ?? DEFAULT_CONSULTATION.title,
    ownerUserId: raw?.ownerUserId ?? ownerUserId ?? null,
    patientProfile:
      raw?.patientProfile ??
      (DEFAULT_CONSULTATION.patientProfile
        ? { ...DEFAULT_CONSULTATION.patientProfile }
        : {}),
    transcriptSegments: toTranscriptMap(raw?.transcriptSegments),
  };
};

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
    ownerUserId: raw?.ownerUserId ?? ownerUserId ?? null,
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
  console.info("[useConsultations] hook mount ownerUserId =", ownerUserId);
  const safeOwnerUserId = ownerUserId ?? null;
  console.info("[useConsultations] safeOwnerUserId =", safeOwnerUserId);

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
      return parsed.map((patient) => deserializePatientFromStorage(patient, safeOwnerUserId));
    } catch {
      return [];
    }
  });

  const [hasHydratedFromRemote, setHasHydratedFromRemote] = useState(false);

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

  useEffect(() => {
    if (
      !ENABLE_BACKGROUND_SYNC ||
      !safeOwnerUserId ||
      hasHydratedFromRemote
    ) {
      return;
    }

    const localStateEmpty =
      consultations.length === 0 && patients.length === 0;

    if (!localStateEmpty) {
      console.info(
        "[useConsultations] skipping hydration because local state already has data"
      );
      setHasHydratedFromRemote(true);
      return;
    }

    let isCancelled = false;

    const runHydration = async () => {
      try {
        console.info("[useConsultations] remote hydration start", {
          safeOwnerUserId,
        });

        const {
          patients: remotePatients,
          consultations: remoteConsultations,
          clinicalNotes,
          transcriptSegmentsByConsultation,
        } = await hydrateAll(safeOwnerUserId);

        if (isCancelled) return;

        if (
          (remotePatients?.length ?? 0) === 0 &&
          (remoteConsultations?.length ?? 0) === 0
        ) {
          console.info("[useConsultations] no remote data to hydrate", {
            safeOwnerUserId,
          });
          setHasHydratedFromRemote(true);
          return;
        }

        const notesByConsultation = new Map();
        for (const note of clinicalNotes ?? []) {
          if (!note || !note.consultationId) continue;
          const current =
            notesByConsultation.get(note.consultationId) ?? null;

          const currentTimestamp = current
            ? new Date(current.updatedAt ?? current.createdAt ?? 0).getTime()
            : -Infinity;
          const nextTimestamp = new Date(
            note.updatedAt ?? note.createdAt ?? 0
          ).getTime();

          if (nextTimestamp >= currentTimestamp) {
            notesByConsultation.set(note.consultationId, note);
          }
        }

        const segmentsLookup = new Map(
          (transcriptSegmentsByConsultation ?? []).map((entry) => {
            const sortedSegments = [...(entry.segments ?? [])].sort(
              (a, b) =>
                Number(a.segmentIndex ?? 0) - Number(b.segmentIndex ?? 0)
            );
            return [entry.consultationId, sortedSegments];
          })
        );

        const normalizedPatients = (remotePatients ?? []).map((patient) =>
          deserializePatientFromStorage(patient, safeOwnerUserId)
        );

        const patientProfileLookup = new Map(
          normalizedPatients.map((patient) => [
            patient.id,
            patient.profile ?? {},
          ])
        );

        const normalizedConsultations = (remoteConsultations ?? []).map(
          (consultation) => {
            const normalized = deserializeConsultationFromStorage(
              consultation,
              safeOwnerUserId
            );

            const consultationKey =
              normalized.id ?? normalized.consultationId ?? null;

            if (consultationKey && notesByConsultation.has(consultationKey)) {
              const note = notesByConsultation.get(consultationKey);
              let parsedContent = note.content;
              if (typeof parsedContent === "string") {
                try {
                  parsedContent = JSON.parse(parsedContent);
                } catch {
                  // leave as string
                }
              }

              normalized.noteId = note.id;
              normalized.noteType = note.noteType ?? normalized.noteType;
              normalized.language = note.language ?? normalized.language;
              normalized.notes = parsedContent;
              normalized.notesSummary = note.summary ?? null;
              normalized.notesStatus = note.status ?? null;
              normalized.notesCreatedAt = note.createdAt ?? note.updatedAt ?? null;
              normalized.notesUpdatedAt = note.updatedAt ?? note.createdAt ?? null;
            }

            if (!normalized.name && normalized.title) {
              normalized.name = normalized.title;
            }
            if (!normalized.title && normalized.name) {
              normalized.title = normalized.name;
            }

            if (
              (!normalized.patientProfile ||
                Object.keys(normalized.patientProfile).length === 0) &&
              normalized.patientId &&
              patientProfileLookup.has(normalized.patientId)
            ) {
              normalized.patientProfile = {
                ...(DEFAULT_CONSULTATION?.patientProfile ?? {}),
                ...patientProfileLookup.get(normalized.patientId),
              };
            }

            if (consultationKey && segmentsLookup.has(consultationKey)) {
              const segments = segmentsLookup.get(consultationKey);
              normalized.transcriptSegments = new Map(
                segments.map((segment) => {
                  const segmentKey =
                    segment.segmentId ??
                    `${consultationKey}-${segment.segmentIndex ?? 0}`;
                  return [
                    segmentKey,
                    {
                      id: segmentKey,
                      speaker: segment.speaker ?? null,
                      text: segment.text ?? "",
                      displayText: segment.displayText ?? segment.text ?? "",
                      translatedText: segment.translatedText ?? null,
                      entities: Array.isArray(segment.entities)
                        ? segment.entities
                        : [],
                    },
                  ];
                })
              );
            } else if (!(normalized.transcriptSegments instanceof Map)) {
              normalized.transcriptSegments = toTranscriptMap(
                normalized.transcriptSegments
              );
            }

            return normalized;
          }
        );

        setPatients(normalizedPatients);
        setConsultations(normalizedConsultations);

        if (
          !activeConsultationId &&
          normalizedConsultations.length > 0
        ) {
          const mostRecent = normalizedConsultations.reduce(
            (acc, curr) => {
              if (!acc) return curr;
              const accTime = new Date(
                acc.updatedAt ?? acc.createdAt ?? 0
              ).getTime();
              const currTime = new Date(
                curr.updatedAt ?? curr.createdAt ?? 0
              ).getTime();
              return currTime > accTime ? curr : acc;
            },
            null
          );

          if (mostRecent?.id) {
            setActiveConsultationId(mostRecent.id);
          }
        }

        console.info("[useConsultations] remote hydration complete", {
          safeOwnerUserId,
          patients: normalizedPatients.length,
          consultations: normalizedConsultations.length,
        });
      } catch (error) {
        if (!isCancelled) {
          console.error("[useConsultations] remote hydration failed", error);
        }
      } finally {
        if (!isCancelled) {
          setHasHydratedFromRemote(true);
        }
      }
    };

    runHydration();

    return () => {
      isCancelled = true;
    };
  }, [
    safeOwnerUserId,
    hasHydratedFromRemote,
    consultations.length,
    patients.length,
    activeConsultationId,
  ]);

  const queuePatientSync = (patient) => {
    console.info("[useConsultations] queuePatientSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      patientId: patient?.id,
    });
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !patient?.id) {
      console.warn("[useConsultations] queuePatientSync skipped guard");
      return;
    }

    console.info("[useConsultations] calling syncService.enqueuePatientUpsert");
    syncService.enqueuePatientUpsert({
      id: patient.id,
      ownerUserId: safeOwnerUserId,
      displayName: patient.displayName ?? patient.name ?? "",
      profile: patient.profile ?? {},
      createdAt: patient.createdAt ?? patient.updatedAt ?? new Date().toISOString(),
      updatedAt: patient.updatedAt ?? patient.createdAt ?? new Date().toISOString(),
    });
  };

  const queueConsultationSync = (consultation) => {
    console.info("[useConsultations] queueConsultationSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      consultationId: consultation?.id,
      patientId: consultation?.patientId,
    });

    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !consultation?.id) {
      console.warn("[useConsultations] queueConsultationSync skipped guard", {
        ENABLE_BACKGROUND_SYNC,
        safeOwnerUserId,
        consultationHasId: Boolean(consultation?.id),
        consultationHasPatientId: Boolean(consultation?.patientId),
      });
      return;
    }

    if (!consultation.patientId) {
      console.warn("[useConsultations] queueConsultationSync missing patientId");
      return;
    }

    const normalized = {
      ...DEFAULT_CONSULTATION,
      ...consultation,
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
      updatedAt: normalized.updatedAt ?? createdAt,
    });
  };

  const queueClinicalNoteSync = (note) => {
    console.info("[useConsultations] queueClinicalNoteSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      noteId: note?.id,
      consultationId: note?.consultationId,
    });

    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !note?.id || !note?.consultationId) {
      console.warn("[useConsultations] queueClinicalNoteSync skipped guard", {
        ENABLE_BACKGROUND_SYNC,
        safeOwnerUserId,
        noteHasId: Boolean(note?.id),
        noteHasConsultationId: Boolean(note?.consultationId),
      });
      return;
    }

    if (
      note.content === undefined ||
      note.content === null ||
      (typeof note.content === "string" && note.content.trim() === "")
    ) {
      console.warn("[useConsultations] queueClinicalNoteSync missing content");
      return;
    }

    const normalizedContent =
      typeof note.content === "string" ? note.content : JSON.stringify(note.content);

    syncService.enqueueClinicalNote({
      id: note.id,
      ownerUserId: note.ownerUserId ?? safeOwnerUserId,
      consultationId: note.consultationId,
      title: note.title ?? `Consultation ${note.consultationId} Note`,
      noteType: note.noteType ?? "General",
      language: note.language ?? "en-US",
      content: normalizedContent,
      createdAt: note.createdAt ?? new Date().toISOString(),
      updatedAt: note.updatedAt ?? new Date().toISOString(),
      summary: note.summary,
      status: note.status,
      debugLabel: note.debugLabel,
    });
  };

  /**
   * Add or upsert a patient profile without creating a consultation.
   */
  const addNewPatient = (patientProfile) => {
    console.info("[useConsultations] addNewPatient", patientProfile);
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
          ownerUserId: existing.ownerUserId ?? safeOwnerUserId,
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
        ownerUserId: safeOwnerUserId,
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
    console.info("[useConsultations] addConsultationForPatient", patientId);
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    const now = new Date().toISOString();
    const newId = Date.now().toString();
    const patientConsultations = consultations.filter((c) => c.patientId === patientId);
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
      ownerUserId: patient.ownerUserId ?? safeOwnerUserId,
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
          ownerUserId: consultation.ownerUserId ?? safeOwnerUserId,
        };

        if (updates.patientProfile) {
          const profile = {
            ...consultation.patientProfile,
            ...updates.patientProfile,
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
                ownerUserId: existingPatient.ownerUserId ?? safeOwnerUserId,
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
              ownerUserId: safeOwnerUserId,
            };
            patientForSync = createdPatient;
            return [...prevPatients, createdPatient];
          });
        }

        if (updates.notes !== undefined) {
          console.info("[useConsultations] updateConsultation notes branch", {
            notesType: typeof updates.notes,
            notesValue: updates.notes,
          });

          const noteUpdatedAt = now;
          const existingNoteCreatedAt = consultation.notesCreatedAt ?? null;
          const noteCreatedAt = existingNoteCreatedAt ?? noteUpdatedAt;
          const resolvedNoteId = consultation.noteId ?? consultation.id;

          const serializedContent =
            typeof updates.notes === "string"
              ? updates.notes
              : JSON.stringify(updates.notes ?? {});

          console.info("[useConsultations] serializedContent", {
            serializedType: typeof serializedContent,
            serializedLength: serializedContent?.length,
            isEmptyString: serializedContent === "",
          });

          updatedConsultation.notesCreatedAt = noteCreatedAt;
          updatedConsultation.notesUpdatedAt = noteUpdatedAt;
          updatedConsultation.noteId = resolvedNoteId;

          if (
            serializedContent !== null &&
            serializedContent !== undefined &&
            (typeof serializedContent !== "string" || serializedContent.trim() !== "")
          ) {
            const clinicalNoteForSync = {
              id: resolvedNoteId,
              ownerUserId: updatedConsultation.ownerUserId ?? safeOwnerUserId,
              consultationId: updatedConsultation.id,
              title:
                updatedConsultation.title ??
                updatedConsultation.name ??
                `Consultation ${updatedConsultation.id}`,
              noteType: updatedConsultation.noteType ?? "General",
              language: updatedConsultation.language ?? "en-US",
              content: serializedContent,
              createdAt: noteCreatedAt,
              updatedAt: noteUpdatedAt,
              summary: updatedConsultation.notesSummary ?? null,
              status: updatedConsultation.notesStatus ?? null,
              debugLabel: `consultation:${updatedConsultation.id}`,
            };
            console.info("[useConsultations] prepared clinicalNoteForSync", clinicalNoteForSync);
            console.info("[useConsultations] queuing clinical note", {
              noteId: clinicalNoteForSync.id,
              consultationId: clinicalNoteForSync.consultationId,
            });
            queueClinicalNoteSync(clinicalNoteForSync);
          } else {
            console.warn("[useConsultations] notes content empty, skipping sync");
          }
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
          consultation.id === activeConsultationId && consultation.patientId === patientId
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
      sessionState: "idle",
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
          updatedAt: now,
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
    setConsultations,
    queueClinicalNoteSync,
  };
};