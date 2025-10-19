import { useEffect, useState, useCallback, useMemo } from "react";
import { DEFAULT_CONSULTATION, ENABLE_BACKGROUND_SYNC } from "../utils/constants";
import { generatePatientId, generatePatientName } from "../utils/helpers";
import { syncService } from "../utils/syncService";
import { hydrateAll } from "../utils/hydrationService";
import { syncDeleteConsultation, syncDeletePatient } from "../utils/syncOperations";
import { apiClient } from "../utils/apiClient";

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
 * Converts transcript segments to a proper Map structure regardless of input format
 * 
 * @param {any} value - The transcript segments in any supported format
 * @returns {Map<string, Object>} A map of transcript segments
 */
const toTranscriptMap = (value) => {
  if (!value) return new Map();
  
  // Already a Map
  if (value instanceof Map) return value;
  
  // Array of [id, segment] entries that can be passed to Map constructor
  if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
    return new Map(value);
  }
  
  // Object with segment IDs as keys
  if (typeof value === "object") {
    return new Map(Object.entries(value));
  }
  
  // Default to empty Map if format is unrecognized
  console.warn("[useConsultations] Unrecognized transcript segment format:", value);
  return new Map();
};

/**
 * Serializes a consultation object for storage in localStorage
 * 
 * @param {Object} consultation - The consultation object
 * @returns {Object} A serialized consultation with transcript segments as Array
 */
const serializeConsultationForStorage = (consultation) => {
  if (!consultation) return null;
  
  // Convert transcript segments Map to array for storage
  const transcriptSegments = Array.from(
    toTranscriptMap(consultation.transcriptSegments).entries()
  );
  
  return {
    ...consultation,
    transcriptSegments,
  };
};

/**
 * Deserializes a consultation from localStorage into proper runtime format
 * 
 * @param {Object} raw - The raw consultation object from storage
 * @param {string|null} ownerUserId - The current user's ID
 * @returns {Object} A deserialized consultation ready for use
 */
const deserializeConsultationFromStorage = (raw, ownerUserId) => {
  if (!raw) return { ...DEFAULT_CONSULTATION };

  // Handle possible name variations
  const name = raw?.name ?? raw?.title ?? DEFAULT_CONSULTATION.name;
  
  return {
    ...DEFAULT_CONSULTATION,
    ...raw,
    name,
    title: raw?.title ?? name,
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
 * Deserializes a patient from localStorage into proper runtime format
 * 
 * @param {Object} raw - The raw patient object from storage
 * @param {string|null} ownerUserId - The current user's ID
 * @returns {Object} A deserialized patient ready for use
 */
const deserializePatientFromStorage = (raw, ownerUserId) => {
  if (!raw) return null;
  
  const name = raw?.name ?? raw?.displayName ?? "";
  
  return {
    ...raw,
    name,
    displayName: raw?.displayName ?? name,
    ownerUserId: raw?.ownerUserId ?? ownerUserId ?? null,
  };
};

/**
 * Custom hook for managing medical consultations, patients, and persistence
 * 
 * @param {string|null} ownerUserId - The ID of the current user
 * @returns {Object} State and functions for consultations management
 */
export const useConsultations = (ownerUserId = null) => {
  console.info("[useConsultations] hook mount ownerUserId =", ownerUserId);
  const safeOwnerUserId = ownerUserId ?? null;
  console.info("[useConsultations] safeOwnerUserId =", safeOwnerUserId);

  // Create a single state object to reduce multiple renders
  const [appState, setAppState] = useState(() => {
    try {
      // Load data from localStorage
      const savedConsultations = localStorage.getItem(STORAGE_KEYS.consultations);
      const savedActiveId = localStorage.getItem(STORAGE_KEYS.activeConsultationId);
      const savedPatients = localStorage.getItem(STORAGE_KEYS.patients);
      
      // Parse and deserialize consultations
      const consultations = savedConsultations 
        ? JSON.parse(savedConsultations).map(c => 
            deserializeConsultationFromStorage(c, safeOwnerUserId)
          ) 
        : [];
      
      // Parse and deserialize patients
      const patients = savedPatients 
        ? JSON.parse(savedPatients).map(p => 
            deserializePatientFromStorage(p, safeOwnerUserId)
          ) 
        : [];
      
      // Initial hydration state
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

  /**
   * Forces rehydration from DynamoDB
   * @returns {Promise<void>}
   */
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
      console.error("[useConsultations] Force hydration failed:", error);
      
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

  /**
   * Main hydration function that pulls data from DynamoDB
   * @returns {Promise<void>}
   */
  const runHydration = useCallback(async () => {
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId) {
      console.info("[useConsultations] Hydration skipped - background sync disabled or no user ID");
      return;
    }

    try {
      setAppState(prev => ({
        ...prev,
        hydrationState: { ...prev.hydrationState, status: "loading", message: "Fetching data...", progress: 10 }
      }));

      const {
        patients: remotePatients,
        consultations: remoteConsultations,
        clinicalNotes,
      } = await hydrateAll(safeOwnerUserId);

      setAppState(prev => ({
        ...prev,
        hydrationState: { ...prev.hydrationState, progress: 50, message: "Processing data..." }
      }));

      if ((remotePatients?.length ?? 0) === 0 && (remoteConsultations?.length ?? 0) === 0) {
        console.info("[useConsultations] No remote data to hydrate", { safeOwnerUserId });
        
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

      // Process clinical notes by consultation ID
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

      // Process transcript segments by consultation ID
      const segmentsLookup = new Map();
      const MAX_CONCURRENT = 4;
      const queue = [...(remoteConsultations ?? [])];

      async function fetchSegmentsFor(consultationId) {
        const res = await apiClient.listTranscriptSegments({
          token: undefined,
          consultationId,
          signal: undefined
        });

        if (!res.ok) {
          console.error("[useConsultations] listTranscriptSegments FAILED", {
            consultationId,
            status: res.status,
            error: res.error?.message
          });
        }

        const items = res?.ok ? (Array.isArray(res.data) ? res.data : []) : [];
        console.info("[useConsultations] Raw segments response", {
          consultationId,
          ok: res.ok,
          status: res.status,
          itemCount: items.length,
          sample: items[0]
        });

        const mapped = items.map(seg => {
          const wireId = seg.segment_id ?? seg.id;
          const id = wireId ? String(wireId) : `${consultationId}-seq-${seg.sequence_number ?? 0}`;
          const speaker = seg.speaker_label ?? null;
          const original = seg.original_text ?? "";
          const translated = seg.translated_text ?? null;
          return {
            id,
            speaker,
            text: original,
            displayText: original,
            translatedText: translated,
            entities: [],
            _sequence: typeof seg.sequence_number === "number" ? seg.sequence_number : 0
          };
        }).sort((a, b) => a._sequence - b._sequence);

        console.info("[useConsultations] Segments fetched", {
          consultationId,
          count: mapped.length,
          first: mapped[0]?.id
        });

        segmentsLookup.set(consultationId, mapped);
      }

      const workers = new Array(Math.min(MAX_CONCURRENT, queue.length)).fill(0).map(async () => {
        while (queue.length) {
          const c = queue.shift();
          const cid = c?.id ?? c?.consultationId;
          if (!cid) continue;
          try {
            await fetchSegmentsFor(cid);
          } catch (e) {
            console.error("[useConsultations] Failed fetching segments for", cid, e);
          }
        }
      });
      await Promise.all(workers);

      setAppState(prev => ({
        ...prev,
        hydrationState: { ...prev.hydrationState, progress: 70, message: "Processing patients and consultations..." }
      }));

      // Process patients
      const normalizedPatients = (remotePatients ?? []).map((patient) =>
        deserializePatientFromStorage(patient, safeOwnerUserId)
      );

      // Create patient profile lookup for linking to consultations
      const patientProfileLookup = new Map(
        normalizedPatients.map((patient) => [
          patient.id,
          patient.profile ?? {},
        ])
      );

      // Process consultations
      const normalizedConsultations = (remoteConsultations ?? []).map((consultation) => {
        const normalized = deserializeConsultationFromStorage(consultation, safeOwnerUserId);
        const consultationKey = normalized.id ?? normalized.consultationId ?? null;

          // Add clinical note data if available
          if (consultationKey && notesByConsultation.has(consultationKey)) {
            const note = notesByConsultation.get(consultationKey);
            let parsedContent = note.content;
            if (typeof parsedContent === "string") {
              try {
                parsedContent = JSON.parse(parsedContent);
              } catch {
                // leave as string if not valid JSON
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

          // Normalize name/title
          if (!normalized.name && normalized.title) {
            normalized.name = normalized.title;
          }
          if (!normalized.title && normalized.name) {
            normalized.title = normalized.name;
          }

          // Link patient profile to consultation
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

          // Process transcript segments
          if (consultationKey && segmentsLookup.has(consultationKey)) {
          const segments = segmentsLookup.get(consultationKey);
          const segmentMap = new Map();
          segments.forEach(segment => {
            segmentMap.set(segment.id, {
              id: segment.id,
              speaker: segment.speaker || null,
              text: segment.text || "",
              displayText: segment.displayText || segment.text || "",
              translatedText: segment.translatedText || null,
              entities: []
            });
          });
          normalized.transcriptSegments = segmentMap;
        } else {
          normalized.transcriptSegments = toTranscriptMap(normalized.transcriptSegments);
        }

        return normalized;
      });

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

      // Apply all updates in a single state update
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

      console.info("[useConsultations] Remote hydration complete", {
        safeOwnerUserId,
        patients: mergedPatients.length,
        consultations: mergedConsultations.length,
      });
    } catch (error) {
      console.error("[useConsultations] Remote hydration failed", error);
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
      console.info("[useConsultations] Skipping hydration - recent sync exists", {
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

  /**
   * Queues a patient update to be synced to DynamoDB
   * 
   * @param {Object} patient - The patient object to sync
   */
  const queuePatientSync = useCallback((patient) => {
    console.info("[useConsultations] queuePatientSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      patientId: patient?.id,
    });
    
    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !patient?.id) {
      console.warn("[useConsultations] queuePatientSync skipped - missing requirements");
      return;
    }

    console.info("[useConsultations] Calling syncService.enqueuePatientUpsert");
    syncService.enqueuePatientUpsert({
      id: patient.id,
      ownerUserId: safeOwnerUserId,
      displayName: patient.displayName ?? patient.name ?? "",
      profile: patient.profile ?? {},
      createdAt: patient.createdAt ?? patient.updatedAt ?? new Date().toISOString(),
      updatedAt: patient.updatedAt ?? patient.createdAt ?? new Date().toISOString(),
    });
  }, [safeOwnerUserId]);

  /**
   * Queues a consultation update to be synced to DynamoDB
   * 
   * @param {Object} consultation - The consultation object to sync
   */
  const queueConsultationSync = useCallback((consultation) => {
    console.info("[useConsultations] queueConsultationSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      consultationId: consultation?.id,
      patientId: consultation?.patientId,
    });

    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !consultation?.id) {
      console.warn("[useConsultations] queueConsultationSync skipped - missing requirements", {
        ENABLE_BACKGROUND_SYNC,
        safeOwnerUserId,
        consultationHasId: Boolean(consultation?.id),
      });
      return;
    }

    if (!consultation.patientId) {
      console.warn("[useConsultations] queueConsultationSync skipped - missing patientId");
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
  }, [safeOwnerUserId]);

  /**
   * Queues a clinical note update to be synced to DynamoDB
   * 
   * @param {Object} note - The clinical note object to sync
   */
  const queueClinicalNoteSync = useCallback((note) => {
    console.info("[useConsultations] queueClinicalNoteSync called", {
      ENABLE_BACKGROUND_SYNC,
      safeOwnerUserId,
      noteId: note?.id,
      consultationId: note?.consultationId,
    });

    if (!ENABLE_BACKGROUND_SYNC || !safeOwnerUserId || !note?.id || !note?.consultationId) {
      console.warn("[useConsultations] queueClinicalNoteSync skipped - missing requirements", {
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
      console.warn("[useConsultations] queueClinicalNoteSync skipped - missing content");
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
  }, [safeOwnerUserId]);

  /**
   * Adds a new patient without creating a consultation
   * 
   * @param {Object} patientProfile - The patient profile data
   */
  const addNewPatient = useCallback((patientProfile) => {
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
        // Update existing patient
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
        // Create new patient
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
  }, [safeOwnerUserId, queuePatientSync]);

  /**
   * Creates a new consultation for an existing patient
   * 
   * @param {string} patientId - The ID of the patient
   */
  const addConsultationForPatient = useCallback((patientId) => {
    console.info("[useConsultations] addConsultationForPatient", patientId);
    
    setAppState(prevState => {
      const patient = prevState.patients.find((p) => p.id === patientId);
      if (!patient) {
        console.warn(`[useConsultations] Patient ${patientId} not found`);
        return prevState;
      }

      const now = new Date().toISOString();
      const newId = Date.now().toString();
      const patientConsultations = prevState.consultations.filter((c) => c.patientId === patientId);
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

      // Queue sync in the next tick to avoid race conditions
      setTimeout(() => queueConsultationSync(newConsultation), 0);

      return {
        ...prevState,
        consultations: [...prevState.consultations, newConsultation],
        activeConsultationId: newId
      };
    });
  }, [safeOwnerUserId, queueConsultationSync]);

  /**
   * Updates an existing consultation
   * 
   * @param {string} id - The ID of the consultation to update
   * @param {Object} updates - The properties to update
   */
  const updateConsultation = useCallback((id, updates) => {
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

        // Handle patient profile updates
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

          // Update patient in a separate function to avoid nesting state updates
          setTimeout(() => {
            handlePatientUpdate(derivedPatientId, derivedPatientName, profile);
          }, 0);
        }

        // Handle clinical note updates
        if (updates.notes !== undefined) {
          console.info("[useConsultations] updateConsultation notes branch", {
            notesType: typeof updates.notes,
          });

          const noteUpdatedAt = now;
          const existingNoteCreatedAt = consultation.notesCreatedAt ?? null;
          const noteCreatedAt = existingNoteCreatedAt ?? noteUpdatedAt;
          const resolvedNoteId = consultation.noteId ?? consultation.id;

          const serializedContent =
            typeof updates.notes === "string"
              ? updates.notes
              : JSON.stringify(updates.notes ?? {});

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
            
            // Queue note sync in the next tick to avoid race conditions
            setTimeout(() => queueClinicalNoteSync(clinicalNoteForSync), 0);
          } else {
            console.warn("[useConsultations] Notes content empty, skipping sync");
          }
        }

        // Queue consultation sync in the next tick to avoid race conditions
        setTimeout(() => queueConsultationSync(updatedConsultation), 0);
        
        return updatedConsultation;
      });

      return {
        ...prevState,
        consultations: updatedConsultations
      };
    });

    // Function to handle patient updates when patientProfile changes in updateConsultation
    function handlePatientUpdate(derivedPatientId, derivedPatientName, profile) {
      setAppState(prevState => {
        const prevPatients = prevState.patients;
        const patientNow = new Date().toISOString();
        const existingPatient = prevPatients.find(
          (patient) => patient.id === derivedPatientId
        );

        let updatedPatients;
        let patientForSync;
        
        if (existingPatient) {
          // Update existing patient
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
          // Create new patient
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

        // Queue patient sync in the next tick to avoid race conditions
        if (patientForSync) {
          setTimeout(() => queuePatientSync(patientForSync), 0);
        }

        return {
          ...prevState,
          patients: updatedPatients
        };
      });
    }
  }, [safeOwnerUserId, queuePatientSync, queueConsultationSync, queueClinicalNoteSync]);

  /**
   * Deletes a consultation
   * 
   * @param {string} id - The ID of the consultation to delete
   */
  const deleteConsultation = useCallback((id) => {
    // Find the consultation to get its owner ID for deletion
    setAppState(prevState => {
      const consultationToDelete = prevState.consultations.find(c => c.id === id);
      const filteredConsultations = prevState.consultations.filter(c => c.id !== id);
      let nextActiveId = prevState.activeConsultationId;
      
      // If we're deleting the active consultation, select another one
      if (prevState.activeConsultationId === id) {
        nextActiveId = filteredConsultations.length > 0 ? filteredConsultations[0].id : null;
      }
      
      // Queue deletion in the next tick
      if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId && consultationToDelete) {
        console.info("[useConsultations] Syncing consultation deletion to DynamoDB", {
          consultationId: id,
          ownerUserId: safeOwnerUserId
        });
        
        setTimeout(() => {
          syncDeleteConsultation(id, safeOwnerUserId, {
            noteId: consultationToDelete.noteId
          });
        }, 0);
      }
      
      return {
        ...prevState,
        consultations: filteredConsultations,
        activeConsultationId: nextActiveId
      };
    });
  }, [safeOwnerUserId]);

  /**
   * Deletes a patient and all related consultations
   * 
   * @param {string} patientId - The ID of the patient to delete
   */
  const deletePatient = useCallback((patientId) => {
    // Find consultations that belong to this patient
    setAppState(prevState => {
      const patientConsultations = prevState.consultations.filter(c => c.patientId === patientId);
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
      
      // Queue deletion in the next tick
      if (ENABLE_BACKGROUND_SYNC && safeOwnerUserId) {
        console.info("[useConsultations] Syncing patient deletion to DynamoDB", {
          patientId,
          ownerUserId: safeOwnerUserId
        });
        
        setTimeout(() => {
          syncDeletePatient(patientId, safeOwnerUserId, {
            patientConsultations
          });
        }, 0);
      }
      
      return {
        ...prevState,
        consultations: filteredConsultations,
        patients: filteredPatients,
        activeConsultationId: nextActiveId
      };
    });
  }, [safeOwnerUserId]);

  /**
   * Resets a consultation to its initial state
   * 
   * @param {string} id - The ID of the consultation to reset
   */
  const resetConsultation = useCallback((id) => {
    updateConsultation(id, {
      transcriptSegments: new Map(),
      interimTranscript: "",
      interimSpeaker: null,
      notes: null,
      error: null,
      loading: false,
      sessionState: "idle",
    });
  }, [updateConsultation]);

  /**
   * Finalizes the timestamp for a consultation once recording is done
   * 
   * @param {string} id - The ID of the consultation to finalize
   */
  const finalizeConsultationTimestamp = useCallback((id) => {
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

        // Queue consultation sync in the next tick
        setTimeout(() => queueConsultationSync(updatedConsultation), 0);
        
        return updatedConsultation;
      });

      return {
        ...prevState,
        consultations: updatedConsultations
      };
    });
  }, [queueConsultationSync]);

  // Find the active consultation object from the consultations array
  const activeConsultation = useMemo(() => {
    return consultations.find(
      (consultation) => consultation.id === activeConsultationId
    ) || null;
  }, [consultations, activeConsultationId]);
  
  // Function to update activeConsultationId
  const setActiveConsultationId = useCallback((id) => {
    setAppState(prevState => ({
      ...prevState,
      activeConsultationId: id
    }));
  }, []);

  // Function to set consultations (rarely used, but needed for compatibility)
  const setConsultations = useCallback((updaterOrValue) => {
    setAppState(prevState => {
      const newConsultations = typeof updaterOrValue === 'function'
        ? updaterOrValue(prevState.consultations)
        : updaterOrValue;
        
      return {
        ...prevState,
        consultations: newConsultations
      };
    });
  }, []);

  return {
    // Data
    consultations,
    patients,
    activeConsultation,
    activeConsultationId,
    hydrationState,
    
    // Setters
    setActiveConsultationId,
    setConsultations,
    
    // CRUD operations
    addNewPatient,
    addConsultationForPatient,
    updateConsultation,
    deleteConsultation,
    deletePatient,
    
    // Utility methods
    resetConsultation,
    finalizeConsultationTimestamp,
    queueClinicalNoteSync,
    forceHydrate,
  };
};