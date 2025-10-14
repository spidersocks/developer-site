import { DynamoDBClient, BatchWriteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ENABLE_BACKGROUND_SYNC } from "./constants";

const REGION = "us-east-1";
const SEGMENT_BATCH_LIMIT = 25;

const dynamoClient = ENABLE_BACKGROUND_SYNC
  ? new DynamoDBClient({ region: REGION })
  : null;

/**
 * In-memory FIFO queue so we control when remote writes execute.
 */
class SyncQueue {
  constructor() {
    this.items = [];
    this.flushing = false;
  }

  enqueue(task) {
    if (!ENABLE_BACKGROUND_SYNC) return;
    this.items.push(task);
  }

  async flushAll() {
    if (!ENABLE_BACKGROUND_SYNC) return;
    if (this.flushing) return;
    if (this.items.length === 0) return;

    this.flushing = true;
    try {
      while (this.items.length > 0) {
        const next = this.items.shift();
        // Each task returns a promise.
        // eslint-disable-next-line no-await-in-loop
        await next();
      }
    } finally {
      this.flushing = false;
    }
  }
}

const queue = new SyncQueue();

/**
 * Helper to wrap PutItem calls.
 */
function putItem(tableName, item) {
  return async () => {
    if (!dynamoClient) return;
    const command = new PutItemCommand({ TableName: tableName, Item: item });
    await dynamoClient.send(command);
  };
}

/**
 * Helper to wrap BatchWriteItem calls for transcripts.
 */
function batchWriteSegments(requestItems) {
  return async () => {
    if (!dynamoClient) return;
    const command = new BatchWriteItemCommand({ RequestItems: requestItems });
    await dynamoClient.send(command);
  };
}

export const syncService = {
  enqueuePatientUpsert(patient) {
    queue.enqueue(
      putItem("medical-scribe-patients", {
        id: { S: patient.id },
        ownerUserId: { S: patient.ownerUserId },
        displayName: { S: patient.displayName },
        profile: {
          M: {
            name: { S: patient.profile.name },
            dateOfBirth: { S: patient.profile.dateOfBirth },
            sex: { S: patient.profile.sex },
            medicalRecordNumber: { S: patient.profile.medicalRecordNumber },
            referringPhysician: { S: patient.profile.referringPhysician },
            email: { S: patient.profile.email },
            phoneNumber: { S: patient.profile.phoneNumber }
          }
        },
        createdAt: { S: patient.createdAt },
        ...(patient.updatedAt ? { updatedAt: { S: patient.updatedAt } } : {})
      })
    );
  },

  enqueueConsultationUpsert(consultation) {
    queue.enqueue(
      putItem("medical-scribe-consultations", {
        id: { S: consultation.id },
        ownerUserId: { S: consultation.ownerUserId },
        patientId: { S: consultation.patientId },
        patientName: { S: consultation.patientName },
        title: { S: consultation.title },
        noteType: { S: consultation.noteType },
        language: { S: consultation.language },
        additionalContext: { S: consultation.additionalContext },
        speakerRoles: {
          M: Object.entries(consultation.speakerRoles || {}).reduce((acc, [speakerId, role]) => {
            acc[speakerId] = { S: role };
            return acc;
          }, {})
        },
        sessionState: { S: consultation.sessionState },
        connectionStatus: { S: consultation.connectionStatus },
        hasShownHint: { BOOL: Boolean(consultation.hasShownHint) },
        customNameSet: { BOOL: Boolean(consultation.customNameSet) },
        activeTab: { S: consultation.activeTab },
        createdAt: { S: consultation.createdAt },
        updatedAt: { S: consultation.updatedAt }
      })
    );
  },

  enqueueTranscriptSegments(consultationId, segments, startingIndex) {
    if (!ENABLE_BACKGROUND_SYNC || !segments?.length) return;

    // Chunk to respect Dynamo’s 25 item limit.
    for (let i = 0; i < segments.length; i += SEGMENT_BATCH_LIMIT) {
      const batch = segments.slice(i, i + SEGMENT_BATCH_LIMIT);
      const batchItems = batch.map((segment, idx) => {
        const segmentIndex = startingIndex + i + idx;

        return {
          PutRequest: {
            Item: {
              consultationId: { S: consultationId },
              segmentIndex: { N: segmentIndex.toString() },
              segmentId: { S: segment.id },
              speaker: segment.speaker
                ? { S: segment.speaker }
                : { NULL: true },
              text: { S: segment.text },
              displayText: { S: segment.displayText },
              translatedText: segment.translatedText
                ? { S: segment.translatedText }
                : { NULL: true },
              entities: {
                L: (segment.entities || []).map(entity => ({
                  M: {
                    BeginOffset: { N: entity.BeginOffset.toString() },
                    EndOffset: { N: entity.EndOffset.toString() },
                    Category: { S: entity.Category },
                    Type: { S: entity.Type },
                    ...(entity.Traits?.length
                      ? {
                          Traits: {
                            L: entity.Traits.map(trait => ({
                              M: {
                                Name: { S: trait.Name },
                                Score: { N: trait.Score.toString() }
                              }
                            }))
                          }
                        }
                      : {})
                  }
                }))
              }
            }
          }
        };
      });

      queue.enqueue(
        batchWriteSegments({
          "medical-scribe-transcript-segments": batchItems
        })
      );
    }
  },

  async flushAll() {
    await queue.flushAll();
  }
};