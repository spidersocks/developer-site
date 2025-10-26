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

const TEMPLATES_TABLE = readEnv("VITE_DDB_TEMPLATES_TABLE", "medical-scribe-templates");

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
            // Try multiple approaches to find segments for this consultation
            const segments = await fetchSegmentsWithMultipleApproaches(client, consultationId);
            
            if (segments.length > 0) {
              // Transform the segments to ensure they have all required fields
              const processedSegments = segments.map(segment => {
                // Handle different field naming conventions that might appear in DynamoDB
                const id = segment.segmentId || segment.id || `segment-${segment.segmentIndex}`;
                
                // Create a normalized segment with consistent field names
                return {
                  id: id, // Primary key for UI components
                  segmentId: id, // Ensure we always have segmentId 
                  consultationId: segment.consultationId || consultationId,
                  segmentIndex: segment.segmentIndex || 0,
                  speaker: segment.speaker || null,
                  text: segment.text || "",
                  displayText: segment.displayText || segment.text || "",
                  translatedText: segment.translatedText || null,
                  entities: Array.isArray(segment.entities) ? segment.entities : [],
                  createdAt: segment.createdAt || new Date().toISOString()
                };
              });
              
              // Sort by segmentIndex to ensure proper order
              processedSegments.sort((a, b) => Number(a.segmentIndex) - Number(b.segmentIndex));
              
              // Log some detailed information about what we found
              console.info(
                `[hydrationService] Found ${processedSegments.length} transcript segments for consultation ${consultationId}`
              );
              
              if (processedSegments.length > 0) {
                console.info("[hydrationService] Sample segment:", JSON.stringify(processedSegments[0]));
              }
              
              byConsultation.set(consultationId, processedSegments);
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

// Try multiple approaches to find transcript segments for a consultation
async function fetchSegmentsWithMultipleApproaches(client, consultationId) {
  const allSegments = [];
  
  // Try multiple query approaches to handle different schema possibilities
  try {
    // Approach 1: Try Query on consultationId if it's the primary key
    try {
      const queryResults = await client.send(new QueryCommand({
        TableName: TRANSCRIPT_SEGMENTS_TABLE,
        KeyConditionExpression: "consultationId = :cid",
        ExpressionAttributeValues: { ":cid": consultationId },
      }));
      
      if (queryResults.Items?.length > 0) {
        console.info(`[hydrationService] Found ${queryResults.Items.length} segments via direct query`);
        allSegments.push(...queryResults.Items);
      }
    } catch (e) {
      // If this fails, likely consultationId is not the table's partition key
      console.info(`[hydrationService] Direct query failed, trying scan: ${e.message}`);
    }
    
    // Approach 2: Scan with FilterExpression on consultationId
    if (allSegments.length === 0) {
      let exclusiveStartKey;
      do {
        const scanCommand = new ScanCommand({
          TableName: TRANSCRIPT_SEGMENTS_TABLE,
          FilterExpression: "consultationId = :cid",
          ExpressionAttributeValues: { ":cid": consultationId },
          ExclusiveStartKey: exclusiveStartKey,
          Limit: 100
        });
        
        const response = await client.send(scanCommand);
        if (response.Items?.length > 0) {
          console.info(`[hydrationService] Found ${response.Items.length} segments via scan`);
          allSegments.push(...response.Items);
        }
        
        exclusiveStartKey = response.LastEvaluatedKey;
      } while (exclusiveStartKey);
    }
    
    // Approach 3: Try finding by any attribute that might be consultationId
    if (allSegments.length === 0) {
      let exclusiveStartKey;
      do {
        const scanCommand = new ScanCommand({
          TableName: TRANSCRIPT_SEGMENTS_TABLE,
          Limit: 1000,
          ExclusiveStartKey: exclusiveStartKey
        });
        
        const response = await client.send(scanCommand);
        if (response.Items?.length > 0) {
          const filteredItems = response.Items.filter(item => {
            // Look for consultationId in any field
            return (
              item.consultationId === consultationId || 
              item.consultation_id === consultationId ||
              item.ConsultationId === consultationId
            );
          });
          
          if (filteredItems.length > 0) {
            console.info(`[hydrationService] Found ${filteredItems.length} segments via full table scan`);
            allSegments.push(...filteredItems);
          }
        }
        
        exclusiveStartKey = response.LastEvaluatedKey;
      } while (exclusiveStartKey && allSegments.length === 0); // Stop scanning if we found segments
    }
    
    return allSegments;
  } catch (error) {
    console.error(`[hydrationService] All segment fetch approaches failed: ${error}`);
    return [];
  }
}

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
  const [patients, consultations, clinicalNotes, rawTemplates] = await Promise.all([
    fetchItemsByOwner(PATIENTS_TABLE, ownerUserId),
    fetchItemsByOwner(CONSULTATIONS_TABLE, ownerUserId),
    fetchItemsByOwner(CLINICAL_NOTES_TABLE, ownerUserId),
    fetchItemsByOwner(TEMPLATES_TABLE, ownerUserId),
  ]);

  console.info("[hydrationService] Patients, consultations, and notes fetched", {
    patientsCount: patients.length,
    consultationsCount: consultations.length,
    notesCount: clinicalNotes.length,
  });

  // Normalize templates: ensure sections is an array of {id,name,description}
  const templates = (rawTemplates || []).map((t) => {
    // defensive field selection to support different key naming conventions
    const id = t.id || t.templateId || t.template_id || null;
    const owner = t.ownerUserId || t.owner_user_id || t.owner || ownerUserId;
    const name = t.name || t.templateName || t.title || "Untitled Template";
    const example_text = t.example_text || t.exampleNoteText || t.example || "";

    // sections may come as:
    // - an array (preferred)
    // - a JSON string (marshal/unmarshal)
    // - stored under other keys
    let sectionsRaw = t.sections ?? t.sections_json ?? t.sections_string ?? t.sections_str ?? null;
    if (!sectionsRaw && t.body) {
      sectionsRaw = t.body.sections ?? null;
    }

    let sections = [];
    if (typeof sectionsRaw === "string") {
      try {
        const parsed = JSON.parse(sectionsRaw);
        sections = Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        // Fallback: attempt to parse a minimal comma-separated list (best-effort)
        console.warn("[hydrationService] Failed to parse template.sections JSON, falling back:", err);
        sections = [];
      }
    } else if (Array.isArray(sectionsRaw)) {
      sections = sectionsRaw;
    } else {
      sections = [];
    }

    // Ensure each section has id, name, description
    sections = sections.map((s, i) => {
      if (!s) s = {};
      return {
        id: s.id || s.section_id || s.key || `sec_${i + 1}`,
        name: s.name || s.title || s.label || `Section ${i + 1}`,
        description: s.description || s.desc || s.instructions || "",
      };
    });

    // keep created/updated timestamps normalized
    const created_at = t.created_at || t.createdAt || t.created || null;
    const updated_at = t.updated_at || t.updatedAt || t.updated || null;

    return {
      id,
      ownerUserId: owner,
      name,
      sections,
      example_text,
      created_at,
      updated_at,
      raw: t,
    };
  });

  // Map patients by ID for quick lookup
  const patientsById = patients.reduce((acc, patient) => {
    if (patient.id) {
      acc[patient.id] = patient;
    }
    return acc;
  }, {});

  // Attach patient profile/name to consultations
  const processedConsultations = consultations.map((consultation) => {
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
    templates,
    transcriptSegmentsByConsultation: [],
  };
};