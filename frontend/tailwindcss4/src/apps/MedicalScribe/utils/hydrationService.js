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
    });

  const makeScanCommand = (exclusiveStartKey) =>
    new ScanCommand({
      TableName: tableName,
      FilterExpression: "#owner = :owner",
      ExpressionAttributeNames: { "#owner": "ownerUserId" },
      ExpressionAttributeValues: { ":owner": ownerUserId },
      ExclusiveStartKey: exclusiveStartKey,
    });

  const runPaginated = async (commandFactory) => {
    let exclusiveStartKey;
    do {
      const command = commandFactory(exclusiveStartKey);
      const response = await client.send(command);
      items.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);
  };

  if (OWNER_GSI_NAME) {
    try {
      await runPaginated(makeQueryCommand);
      return items;
    } catch (error) {
      console.warn(
        "[hydrationService] Query via GSI failed, falling back to scan",
        { tableName, error }
      );
    }
  }

  await runPaginated(makeScanCommand);
  return items;
};

const fetchTranscriptSegmentsForConsultations = async (consultations) => {
  if (!TRANSCRIPT_SEGMENTS_TABLE || consultations.length === 0) {
    return new Map();
  }

  const client = getDocumentClient();
  if (!client) return new Map();

  const byConsultation = new Map();
  const MAX_CONCURRENT = 5;
  const queue = [...consultations];

  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_CONCURRENT);
    await Promise.all(
      batch.map(async (consultation) => {
        const consultationId =
          consultation?.id ?? consultation?.consultationId ?? null;
        if (!consultationId) return;

        let exclusiveStartKey;
        const segments = [];

        do {
          const command = new QueryCommand({
            TableName: TRANSCRIPT_SEGMENTS_TABLE,
            KeyConditionExpression: "#cid = :cid",
            ExpressionAttributeNames: { "#cid": "consultationId" },
            ExpressionAttributeValues: { ":cid": consultationId },
            ExclusiveStartKey: exclusiveStartKey,
            ScanIndexForward: true,
          });

          const response = await client.send(command);
          segments.push(...(response.Items ?? []));
          exclusiveStartKey = response.LastEvaluatedKey;
        } while (exclusiveStartKey);

        if (segments.length > 0) {
          byConsultation.set(consultationId, segments);
        }
      })
    );
  }

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

  const [patients, consultations, clinicalNotes] = await Promise.all([
    fetchItemsByOwner(PATIENTS_TABLE, ownerUserId),
    fetchItemsByOwner(CONSULTATIONS_TABLE, ownerUserId),
    fetchItemsByOwner(CLINICAL_NOTES_TABLE, ownerUserId),
  ]);

  const transcriptSegmentsByConsultation =
    await fetchTranscriptSegmentsForConsultations(consultations);

  console.info("[hydrationService] hydrateAll complete", {
    ownerUserId,
    patients: patients.length,
    consultations: consultations.length,
    clinicalNotes: clinicalNotes.length,
    transcriptSegmentsByConsultation: transcriptSegmentsByConsultation.size,
  });

    return {
    patients,
    consultations,
    clinicalNotes,
    transcriptSegmentsByConsultation: Array.from(
      transcriptSegmentsByConsultation.entries()
    ).map(([consultationId, segments]) => ({
      consultationId,
      segments,
    })),
  };
};