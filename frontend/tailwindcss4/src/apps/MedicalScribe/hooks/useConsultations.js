import { useEffect, useState, useCallback } from "react";
import { DEFAULT_CONSULTATION, ENABLE_BACKGROUND_SYNC } from "../utils/constants";
import { generatePatientId, generatePatientName } from "../utils/helpers";
import { syncService } from "../utils/syncService";
import { hydrateAll } from "../utils/hydrationService";
import { syncDeleteConsultation, syncDeletePatient } from "../utils/syncOperations";

/**
 * LocalStorage keys used by the consultations hook.
 */
const STORAGE_KEYS = {
  consultations: "consultations",
  activeConsultationId: "activeConsultationId",
  patients: "patients",
  lastSyncTimestamp: "lastSyncTimestamp",
  syncVersion: "syncVersion",
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

  // Create a single state object to reduce multiple renders
  const [appState, setAppState] = useState(() => {
    // Initialize state values from localStorage
    try {
      const savedConsultations = localStorage.getItem(STORAGE_KEYS.consultations);
      const savedActiveId = localStorage.getItem(STORAGE_KEYS.activeConsultationId);
      const savedPatients = localStorage.getItem(STORAGE_KEYS.patients);
      
      // Parse consultations
      const consultations = savedConsultations 
        ? JSON.parse(savedConsultations).map(c => 
            deserializeConsultationFromStorage(c, safeOwnerUserId)
          ) 
        : [];
      
      // Parse patients
      const patients = savedPatients 
        ? JSON.parse(savedPatients).map(p => 
            deserializePatientFromStorage(p, safeOwnerUserId)
          ) 
        : [];
      
      return {
        consultations,
        patients,
        activeConsultationId: savedActiveId || null,
        hydrationState: {
          status: "idle",
          error: null,
          lastSynced: null,
          progress: 0,
          message: "",
          syncVersion: parseInt(localStorage.getItem(STORAGE_KEYS.syncVersion) || "0", 10)
        }
      };
    } catch (error) {
      console.error("[useConsultations] Error initializing from localStorage:", error);
      return {
        consultations: [],
        patients: [],
        activeConsultationId: null,
        hydrationState: {
          status: "idle",
          error: null,
          lastSynced: null,
          progress: 0,
          message: "",
          syncVersion: 0
        }
      };
    }
  });

  // Destructure for easier access
  const { consultations, patients, activeConsultationId, hydrationState } = appState;

  // Force a re-hydration (useful after adding/removing data)
  const forceHydrate = useCallback(async () => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId) {
      return;
    }
    
    setAppState(prev => ({
      ...prev,
      hydrationState: {
        ...prev.hydrationState,
        status: "loading",
        message: "Syncing with database...",
        progress: 0
      }
    }));
    
    try {
      await runHydration();
      
      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          status: "success",
          error: null,
          lastSynced: new Date().toISOString(),
          progress: 100,
          message: "Sync complete"
        }
      }));
    } catch (error) {
      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          status: "error",
          error: error.message,
          progress: 0,
          message: "Sync failed"
        }
      }));
    }
  }, [safeOwnerUserId]);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      // Persist consultations
      if (consultations?.length >= 0) {
        const toPersist = consultations.map(serializeConsultationForStorage);
        localStorage.setItem(STORAGE_KEYS.consultations, JSON.stringify(toPersist));
      }
      
      // Persist patients
      if (patients?.length >= 0) {
        localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patients));
      }
      
      // Persist active consultation ID
      if (activeConsultationId) {
        localStorage.setItem(STORAGE_KEYS.activeConsultationId, activeConsultationId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.activeConsultationId);
      }
    } catch (error) {
      console.error("[useConsultations] Error persisting state to localStorage:", error);
    }
  }, [consultations, patients, activeConsultationId]);

  const runHydration = useCallback(async () => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId) {
      console.info("[useConsultations] hydration skipped - background sync disabled or no user ID");
      return;
    }

    try {
      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          status: "loading", 
          message: "Fetching data...",
          progress: 10
        }
      }));
      
      console.info("[useConsultations] remote hydration start", {
        safeOwnerUserId,
      });

      // Fetch remote data
      const {
        patients: remotePatients,
        consultations: remoteConsultations,
        clinicalNotes,
        transcriptSegmentsByConsultation,
      } = await hydrateAll(safeOwnerUserId);

      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          progress: 50,
          message: "Processing data..."
        }
      }));

      if ((remotePatients?.length ?? 0) === 0 && (remoteConsultations?.length ?? 0) === 0) {
        console.info("[useConsultations] no remote data to hydrate", { safeOwnerUserId });
        
        setAppState(prev => ({
          ...prev,
          hydrationState: {
            ...prev.hydrationState,
            status: "success", 
            progress: 100,
            message: "No remote data found",
            lastSynced: new Date().toISOString()
          }
        }));
        
        return;
      }

      const notesByConsultation = new Map();
      for (const note of clinicalNotes ?? []) {
        if (!note || !note.consultationId) continue;
        const current = notesByConsultation.get(note.consultationId) ?? null;

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

      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          progress: 70,
          message: "Processing patients and consultations..."
        }
      }));

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

      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          progress: 90,
          message: "Finalizing data..."
        }
      }));

      // Merge remote and local data, giving preference to remote when in conflict
      // For patients: update by ID, keeping remote data
      const mergedPatients = [...patients];
      for (const remotePatient of normalizedPatients) {
        const localIndex = mergedPatients.findIndex(p => p.id === remotePatient.id);
        if (localIndex >= 0) {
          // Update existing patient
          const localPatient = mergedPatients[localIndex];
          const localUpdated = new Date(localPatient.updatedAt || 0).getTime();
          const remoteUpdated = new Date(remotePatient.updatedAt || 0).getTime();
          
          // Prefer remote unless local is newer
          if (remoteUpdated >= localUpdated) {
            mergedPatients[localIndex] = remotePatient;
          }
        } else {
          // Add new remote patient
          mergedPatients.push(remotePatient);
        }
      }

      // For consultations: update by ID, merging transcript segments
      const mergedConsultations = [...consultations];
      for (const remoteConsultation of normalizedConsultations) {
        const localIndex = mergedConsultations.findIndex(c => c.id === remoteConsultation.id);
        if (localIndex >= 0) {
          // Update existing consultation
          const localConsultation = mergedConsultations[localIndex];
          const localUpdated = new Date(localConsultation.updatedAt || 0).getTime();
          const remoteUpdated = new Date(remoteConsultation.updatedAt || 0).getTime();
          
          // Always merge transcript segments
          const mergedSegments = new Map([
            ...Array.from(localConsultation.transcriptSegments.entries()),
            ...Array.from(remoteConsultation.transcriptSegments.entries())
          ]);
          
          // Prefer remote unless local is newer
          if (remoteUpdated >= localUpdated) {
            // Keep remote but with merged segments
            remoteConsultation.transcriptSegments = mergedSegments;
            mergedConsultations[localIndex] = remoteConsultation;
          } else {
            // Keep local but with merged segments
            localConsultation.transcriptSegments = mergedSegments;
            mergedConsultations[localIndex] = localConsultation;
          }
        } else {
          // Add new remote consultation
          mergedConsultations.push(remoteConsultation);
        }
      }

      // Find the most recent consultation if needed
      let nextActiveId = activeConsultationId;
      if (!activeConsultationId && mergedConsultations.length > 0) {
        const mostRecent = mergedConsultations.reduce(
          (acc, curr) => {
            if (!acc) return curr;
            const accTime = new Date(acc.updatedAt ?? acc.createdAt ?? 0).getTime();
            const currTime = new Date(curr.updatedAt ?? curr.createdAt ?? 0).getTime();
            return currTime > accTime ? curr : acc;
          },
          null
        );
        
        if (mostRecent?.id) {
          nextActiveId = mostRecent.id;
        }
      }

      // Update hydration state
      const newVersion = hydrationState.syncVersion + 1;
      localStorage.setItem(STORAGE_KEYS.syncVersion, newVersion.toString());
      localStorage.setItem(STORAGE_KEYS.lastSyncTimestamp, new Date().toISOString());

      // Apply all updates in a single state update - this is the key optimization!
      setAppState(prev => ({
        ...prev,
        patients: mergedPatients,
        consultations: mergedConsultations,
        activeConsultationId: nextActiveId,
        hydrationState: {
          ...prev.hydrationState,
          status: "success",
          progress: 100,
          message: "Sync complete",
          syncVersion: newVersion,
          lastSynced: new Date().toISOString(),
          error: null
        }
      }));

      console.info("[useConsultations] remote hydration complete", {
        safeOwnerUserId,
        patients: mergedPatients.length,
        consultations: mergedConsultations.length,
      });
    } catch (error) {
      console.error("[useConsultations] remote hydration failed", error);
      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          status: "error",
          message: `Sync failed: ${error.message}`,
          error: error.message
        }
      }));
    }
  }, [safeOwnerUserId, patients, consultations, activeConsultationId, hydrationState.syncVersion]);

  // Initial hydration effect
  useEffect(() => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || hydrationState.status !== "idle") {
      return;
    }
    
    // Check if we need to hydrate
    const lastSyncTimestamp = localStorage.getItem(STORAGE_KEYS.lastSyncTimestamp);
    const now = new Date().getTime();
    const lastSync = lastSyncTimestamp ? new Date(lastSyncTimestamp).getTime() : 0;
    const syncThreshold = 5 * 60 * 1000; // 5 minutes
    
    // Skip if we've synced recently (within 5 minutes) and have data
    if (
      lastSync > now - syncThreshold && 
      (patients.length > 0 || consultations.length > 0)
    ) {
      console.info("[useConsultations] skipping hydration - recent sync exists", {
        lastSync: new Date(lastSync).toISOString(),
        timeSinceSync: (now - lastSync) / 1000,
        threshold: syncThreshold / 1000,
      });
      
      setAppState(prev => ({
        ...prev,
        hydrationState: {
          ...prev.hydrationState,
          status: "success",
          message: "Using cached data",
          lastSynced: lastSyncTimestamp
        }
      }));
      
      return;
    }
    
    runHydration();
  }, [safeOwnerUserId, hydrationState.status, patients.length, consultations.length, runHydration]);

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

    setAppState(prevState => {
      const prevPatients = prevState.patients;
      const existing = prevPatients.find((p) => p.id === patientId);

      let updatedPatients;
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
        updatedPatients = prevPatients.map((p) => (p.id === patientId ? updatedPatient : p));
      } else {
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
        updatedPatients = [...prevPatients, newPatient];
      }

      return {
        ...prevState,
        patients: updatedPatients,
        activeConsultationId: null
      };
    });

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

    setAppState(prevState => ({
      ...prevState,
      consultations: [...prevState.consultations, newConsultation],
      activeConsultationId: newId
    }));

    queueConsultationSync(newConsultation);
  };

  /**
   * Update a consultation and optionally its associated patient profile.
   */
  const updateConsultation = (id, updates) => {
    let consultationForSync = null;
    let patientForSync = null;

    setAppState(prevState => {
      const prevConsultations = prevState.consultations;
      
      const updatedConsultations = prevConsultations.map((consultation) => {
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

          // Handle patient updates in a separate function to avoid nesting setStates
          handlePatientUpdate(derivedPatientId, derivedPatientName, profile);
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
      });

      return {
        ...prevState,
        consultations: updatedConsultations
      };
    });

    // Function to handle patient updates without nesting setStates
    function handlePatientUpdate(derivedPatientId, derivedPatientName, profile) {
      setAppState(prevState => {
        const prevPatients = prevState.patients;
        const patientNow = new Date().toISOString();
        const existingPatient = prevPatients.find(
          (patient) => patient.id === derivedPatientId
        );

        let updatedPatients;
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
          updatedPatients = prevPatients.map((patient) =>
            patient.id === derivedPatientId ? revisedPatient : patient
          );
        } else {
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
          updatedPatients = [...prevPatients, createdPatient];
        }

        // Sync the patient in the next tick to avoid overwriting the patientForSync
        setTimeout(() => {
          if (patientForSync) {
            queuePatientSync(patientForSync);
          }
        }, 0);

        return {
          ...prevState,
          patients: updatedPatients
        };
      });
    }

    if (consultationForSync) {
      queueConsultationSync(consultationForSync);
    }
  };

  /**
   * Remove a consultation from local state and initiate remote deletion.
   */
  const deleteConsultation = (id) => {
    // Find the consultation to get its owner ID for deletion
    const consultationToDelete = consultations.find(c => c.id === id);
    
    setAppState(prevState => {
      const filteredConsultations = prevState.consultations.filter(c => c.id !== id);
      let nextActiveId = prevState.activeConsultationId;
      
      // If we're deleting the active consultation, select another one
      if (prevState.activeConsultationId === id) {
        nextActiveId = filteredConsultations.length > 0 ? filteredConsultations[0].id : null;
      }
      
      return {
        ...prevState,
        consultations: filteredConsultations,
        activeConsultationId: nextActiveId
      };
    });

    if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId && consultationToDelete) {
      console.info("[useConsultations] Syncing consultation deletion to DynamoDB", {
        consultationId: id,
        ownerUserId: safeOwnerUserId
      });
      
      // Use the utility function to handle deletion properly
      syncDeleteConsultation(id, safeOwnerUserId, {
        noteId: consultationToDelete.noteId
      });
    }
  };

  /**
   * Delete a patient and their consultations from local state and initiate remote deletion.
   */
  const deletePatient = (patientId) => {
    // Find consultations that belong to this patient
    const patientConsultations = consultations.filter(c => c.patientId === patientId);
    
    setAppState(prevState => {
      const filteredConsultations = prevState.consultations.filter(c => c.patientId !== patientId);
      const filteredPatients = prevState.patients.filter(p => p.id !== patientId);
      
      let nextActiveId = prevState.activeConsultationId;
      
      // If active consultation belonged to this patient, select another one
      const activeWasDeleted = prevState.consultations.find(
        c => c.id === prevState.activeConsultationId && c.patientId === patientId
      );
      
      if (activeWasDeleted) {
        nextActiveId = filteredConsultations.length > 0 ? filteredConsultations[0].id : null;
      }
      
      return {
        ...prevState,
        consultations: filteredConsultations,
        patients: filteredPatients,
        activeConsultationId: nextActiveId
      };
    });

    if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId) {
      console.info("[useConsultations] Syncing patient deletion to DynamoDB", {
        patientId,
        ownerUserId: safeOwnerUserId
      });
      
      // Use the utility function to handle cascading deletion
      syncDeletePatient(patientId, safeOwnerUserId, {
        patientConsultations
      });
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
    setAppState(prevState => {
      const updatedConsultations = prevState.consultations.map(consultation => {
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

        // Queue the sync in the next tick to avoid race conditions
        setTimeout(() => queueConsultationSync(updatedConsultation), 0);
        
        return updatedConsultation;
      });

      return {
        ...prevState,
        consultations: updatedConsultations
      };
    });
  };

  const activeConsultation = consultations.find(
    (consultation) => consultation.id === activeConsultationId
  );
  
  // Define a function to update activeConsultationId
  const setActiveConsultationId = (id) => {
    setAppState(prevState => ({
      ...prevState,
      activeConsultationId: id
    }));
  };

  // Define a function to set consultations (rarely used, but needed for compatibility)
  const setConsultations = (updaterOrValue) => {
    setAppState(prevState => {
      const newConsultations = typeof updaterOrValue === 'function'
        ? updaterOrValue(prevState.consultations)
        : updaterOrValue;
        
      return {
        ...prevState,
        consultations: newConsultations
      };
    });
  };

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
    hydrationState,
    forceHydrate,
  };
};