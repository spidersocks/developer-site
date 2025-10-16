import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ENABLE_BACKGROUND_SYNC } from "./constants";
import { AWS_REGION, getDynamoDocumentClient } from "./awsClients";

const readEnv = (key, fallback) => {
  const metaEnv =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : undefined;
  if (metaEnv && metaEnv[key] !== undefined) return metaEnv[key];

  const windowEnv =
    typeof window !== "undefined" && window.__ENV__
      ? window.__ENV__
      : undefined;
  if (windowEnv && windowEnv[key] !== undefined) return windowEnv[key];

  return fallback;
};

const PATIENTS_TABLE = readEnv(
  "VITE_DDB_PATIENTS_TABLE",
  "medical-scribe-patients"
);

const CONSULTATIONS_TABLE = readEnv(
  "VITE_DDB_CONSULTATIONS_TABLE",
  "medical-scribe-consultations"
);

const CLINICAL_NOTES_TABLE = readEnv(
  "VITE_DDB_CLINICAL_NOTES_TABLE",
  "medical-scribe-clinical-notes"
);

const TRANSCRIPT_SEGMENTS_TABLE = readEnv(
  "VITE_DDB_TRANSCRIPT_SEGMENTS_TABLE",
  "medical-scribe-transcript-segments"
);

const OWNER_GSI_NAME = readEnv("VITE_DDB_OWNER_GSI", null);

const getDocumentClient = () => {
  if (!ENABLE_BACKGROUND_SYNC) {
    console.warn(
      "[hydrationService] Document client unavailable while background sync disabled"
    );
    return null;
  }

  const client = getDynamoDocumentClient();
  if (!client) {
    throw new Error("[hydrationService] DynamoDBDocumentClient not initialized");
  }
  return client;
};

const fetchItemsByOwner = async (tableName, ownerUserId) => {
  const client = getDocumentClient();
  const items = [];

  const makeQueryCommand = (exclusiveStartKey) =>
    new QueryCommand({
      TableName: tableName,
      IndexName: OWNER_GSI_NAME ?? undefined,
      KeyConditionExpression: "#owner = :owner",
      ExpressionAttributeNames: { "#owner": "ownerUserId" },
      ExpressionAttributeValues: { ":owner": ownerUserId },
      ExclusiveStartKey: exclusiveStartKey,
      Limit: 100, // Process in smaller batches to avoid timeouts
    });

  const makeScanCommand = (exclusiveStartKey) =>
    new ScanCommand({
      TableName: tableName,
      FilterExpression: "#owner = :owner",
      ExpressionAttributeNames: { "#owner": "ownerUserId" },
      ExpressionAttributeValues: { ":owner": ownerUserId },
      ExclusiveStartKey: exclusiveStartKey,
      Limit: 50, // Process in smaller batches for scans which are slower
    });

  const runPaginated = async (commandFactory) => {
    let exclusiveStartKey;
    let iteration = 0;
    let totalItems = 0;
    
    do {
      iteration++;
      console.info(`[hydrationService] Fetching page ${iteration} from ${tableName}`);
      
      try {
        const command = commandFactory(exclusiveStartKey);
        const response = await client.send(command);
        const pageItems = response.Items ?? [];
        items.push(...pageItems);
        totalItems += pageItems.length;
        exclusiveStartKey = response.LastEvaluatedKey;
        
        console.info(`[hydrationService] Retrieved ${pageItems.length} items from ${tableName}, total: ${totalItems}`);
      } catch (error) {
        console.error(`[hydrationService] Error fetching page ${iteration} from ${tableName}:`, error);
        throw error;
      }
    } while (exclusiveStartKey);
  };

  console.info(`[hydrationService] Starting fetch from ${tableName} for owner ${ownerUserId}`);
  console.time(`fetch-${tableName}`);
  
  try {
    if (OWNER_GSI_NAME) {
      try {
        await runPaginated(makeQueryCommand);
        console.timeEnd(`fetch-${tableName}`);
        return items;
      } catch (error) {
        console.warn(
          "[hydrationService] Query via GSI failed, falling back to scan",
          { tableName, error }
        );
      }
    }

    await runPaginated(makeScanCommand);
    console.timeEnd(`fetch-${tableName}`);
    return items;
  } catch (error) {
    console.error(`[hydrationService] Failed to fetch from ${tableName}:`, error);
    console.timeEnd(`fetch-${tableName}`);
    throw error;
  }
};

const fetchTranscriptSegmentsForConsultations = async (consultations) => {
  if (!TRANSCRIPT_SEGMENTS_TABLE || consultations.length === 0) {
    return new Map();
  }

  const client = getDocumentClient();
  if (!client) return new Map();

  const byConsultation = new Map();
  const MAX_CONCURRENT = 3; // Reduce concurrent requests to prevent rate limiting
  const queue = [...consultations];

  console.info(`[hydrationService] Fetching transcript segments for ${consultations.length} consultations`);
  console.time('fetch-transcript-segments');
  
  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, MAX_CONCURRENT);
      await Promise.all(
        batch.map(async (consultation) => {
          const consultationId = consultation?.id ?? consultation?.consultationId ?? null;
          if (!consultationId) return;

          try {
            let exclusiveStartKey;
            const segments = [];

            console.info(`[hydrationService] Querying segments for consultation ${consultationId}`);

            do {
              // Changed from consultationId KeyConditionExpression to use Scan with FilterExpression
              // This is necessary because the primary key schema might be different
              const command = new ScanCommand({
                TableName: TRANSCRIPT_SEGMENTS_TABLE,
                FilterExpression: "consultationId = :cid",
                ExpressionAttributeValues: { ":cid": consultationId },
                ExclusiveStartKey: exclusiveStartKey,
              });

              const response = await client.send(command);
              
              if (response.Items?.length > 0) {
                console.info(
                  `[hydrationService] Found ${response.Items.length} transcript segments in batch for ${consultationId}`
                );
                // Log first segment for debugging
                if (response.Items.length > 0) {
                  console.info("[hydrationService] First segment sample:", JSON.stringify(response.Items[0]).substring(0, 200) + "...");
                }
              }
              
              segments.push(...(response.Items ?? []));
              exclusiveStartKey = response.LastEvaluatedKey;
            } while (exclusiveStartKey);

            if (segments.length > 0) {
              // Transform the segments to ensure they have all required fields
              const processedSegments = segments.map(segment => ({
                consultationId: segment.consultationId,
                segmentIndex: segment.segmentIndex,
                segmentId: segment.segmentId,
                speaker: segment.speaker,
                text: segment.text || "",
                displayText: segment.displayText || segment.text || "",
                translatedText: segment.translatedText || null,
                entities: Array.isArray(segment.entities) ? segment.entities : [],
                createdAt: segment.createdAt || new Date().toISOString()
              }));
              
              // Sort by segmentIndex to ensure proper order
              processedSegments.sort((a, b) => Number(a.segmentIndex) - Number(b.segmentIndex));
              
              byConsultation.set(consultationId, processedSegments);
              console.info(
                `[hydrationService] Found ${processedSegments.length} transcript segments for consultation ${consultationId}`
              );
            } else {
              console.warn(`[hydrationService] No transcript segments found for consultation ${consultationId}`);
            }
          } catch (error) {
            console.error(
              `[hydrationService] Error fetching segments for consultation ${consultationId}:`,
              error
            );
          }
        })
      );
    }
  } catch (error) {
    console.error("[hydrationService] Error in transcript segments batch processing:", error);
  }
  
  console.timeEnd('fetch-transcript-segments');
  console.info(`[hydrationService] Fetched segments for ${byConsultation.size}/${consultations.length} consultations`);
  return byConsultation;
};

export const hydrateAll = async (ownerUserId) => {
  if (!ENABLE_BACKGROUND_SYNC) {
    throw new Error(
      "[hydrationService] hydrateAll invoked while background sync disabled"
    );
  }

  if (!ownerUserId) {
    throw new Error("[hydrationService] ownerUserId is required for hydration");
  }

  console.info("[hydrationService] hydrateAll start", {
    ownerUserId,
    region: AWS_REGION,
    indexName: OWNER_GSI_NAME,
  });

  // Fetch patients, consultations, and notes in parallel
  const [patients, consultations, clinicalNotes] = await Promise.all([
    fetchItemsByOwner(PATIENTS_TABLE, ownerUserId),
    fetchItemsByOwner(CONSULTATIONS_TABLE, ownerUserId),
    fetchItemsByOwner(CLINICAL_NOTES_TABLE, ownerUserId),
  ]);

  console.info("[hydrationService] Patients, consultations, and notes fetched", {
    patientsCount: patients.length,
    consultationsCount: consultations.length,
    notesCount: clinicalNotes.length,
  });

  // Then fetch transcript segments
  const transcriptSegmentsByConsultation = 
    await fetchTranscriptSegmentsForConsultations(consultations);

  console.info("[hydrationService] hydrateAll complete", {
    ownerUserId,
    patients: patients.length,
    consultations: consultations.length,
    clinicalNotes: clinicalNotes.length,
    transcriptSegmentsByConsultation: transcriptSegmentsByConsultation.size,
  });

  // Map patients by ID for quick lookup
  const patientsById = patients.reduce((acc, patient) => {
    if (patient.id) {
      acc[patient.id] = patient;
    }
    return acc;
  }, {});

  // Explicitly adding patientProfile to consultations to fix persistence issue
  const processedConsultations = consultations.map(consultation => {
    // Check if patient exists and attach their profile
    if (consultation.patientId && patientsById[consultation.patientId]) {
      const patient = patientsById[consultation.patientId];
      consultation.patientProfile = patient.profile || {};
      consultation.patientName = patient.displayName || patient.name;
    }
    return consultation;
  });

  return {
    patients,
    consultations: processedConsultations,
    clinicalNotes,
    transcriptSegmentsByConsultation: Array.from(
      transcriptSegmentsByConsultation.entries()
    ).map(([consultationId, segments]) => ({
      consultationId,
      segments,
    })),
  };
};