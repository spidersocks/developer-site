import { BatchWriteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ENABLE_BACKGROUND_SYNC } from "./constants";
import {
  AWS_REGION,
  credentialsProvider,
  getDynamoClient,
  warmAwsCredentials,
} from "./awsClients";

const SEGMENT_BATCH_LIMIT = 25;

if (ENABLE_BACKGROUND_SYNC) {
  warmAwsCredentials().catch(() => {
    /* warmAwsCredentials already logged the error */
  });
}

const dynamoClient = ENABLE_BACKGROUND_SYNC ? getDynamoClient() : null;

class SyncQueue {
  constructor() {
    this.items = [];
    this.flushing = false;
  }

  enqueue(task, meta = {}) {
    if (!ENABLE_BACKGROUND_SYNC) return;
    this.items.push({ run: task, meta });
    console.info(
      "[sync][queue] enqueue",
      meta.label ?? "task",
      "pending =",
      this.items.length
    );
  }

  async flushAll(reason = "unspecified") {
    if (!ENABLE_BACKGROUND_SYNC) {
      console.info(
        "[sync][queue] flush skipped because background sync disabled"
      );
      return;
    }

    if (this.flushing) {
      console.info("[sync][queue] flush skipped (already flushing)", { reason });
      return;
    }

    if (this.items.length === 0) {
      console.info("[sync][queue] flush skipped (empty queue)", { reason });
      return;
    }

    this.flushing = true;
    console.info("[sync][queue] flush start", {
      reason,
      pending: this.items.length,
    });

    try {
      while (this.items.length > 0) {
        const { run, meta } = this.items.shift();
        console.info(
          "[sync][queue] executing task",
          meta.label ?? "task",
          "remaining =",
          this.items.length
        );
        // eslint-disable-next-line no-await-in-loop
        await run();
        console.info(
          "[sync][queue] completed task",
          meta.label ?? "task"
        );
      }
    } catch (error) {
      console.error("[sync][queue] task failed", error);
      throw error;
    } finally {
      this.flushing = false;
      console.info("[sync][queue] flush complete", { reason });
    }
  }
}

const queue = new SyncQueue();

function putItem(tableName, item, debugLabel) {
  return async () => {
    if (!dynamoClient) return;
    console.info("[sync][dynamodb] PutItem", { tableName, debugLabel });
    await dynamoClient.send(
      new PutItemCommand({ TableName: tableName, Item: item })
    );
  };
}

function batchWriteSegments(requestItems, debugLabel) {
  return async () => {
    if (!dynamoClient) return;
    console.info("[sync][dynamodb] BatchWriteItem", {
      tableName: "medical-scribe-transcript-segments",
      debugLabel,
    });
    await dynamoClient.send(
      new BatchWriteItemCommand({ RequestItems: requestItems })
    );
  };
}

console.info("[sync] ENABLE_BACKGROUND_SYNC", ENABLE_BACKGROUND_SYNC);
console.info("[sync] AWS_REGION", AWS_REGION);

export const syncService = {
  enqueuePatientUpsert(patient) {
    console.info("[syncService] enqueuePatientUpsert invoked", patient);
    queue.enqueue(
      putItem("medical-scribe-patients", {
        id: { S: patient.id },
        ownerUserId: { S: patient.ownerUserId },
        displayName: { S: patient.displayName },
        profile: {
          M: Object.fromEntries(
            Object.entries(patient.profile ?? {}).flatMap(([key, value]) => {
              if (value === undefined || value === null || value === "") return [];
              return [[key, { S: value }]];
            })
          ),
        },
        createdAt: { S: patient.createdAt },
        ...(patient.updatedAt ? { updatedAt: { S: patient.updatedAt } } : {}),
      }),
      { label: `patient:${patient.id}` }
    );
  },

  enqueueConsultationUpsert(consultation) {
    console.info(
      "[syncService] enqueueConsultationUpsert invoked",
      consultation
    );
    queue.enqueue(
      putItem("medical-scribe-consultations", {
        id: { S: consultation.id },
        ownerUserId: { S: consultation.ownerUserId },
        patientId: { S: consultation.patientId },
        patientName: { S: consultation.patientName },
        title: { S: consultation.title },
        noteType: { S: consultation.noteType },
        language: { S: consultation.language },
        additionalContext: { S: consultation.additionalContext ?? "" },
        speakerRoles: {
          M: Object.entries(consultation.speakerRoles || {}).reduce(
            (acc, [speakerId, role]) => {
              if (!role) return acc;
              acc[speakerId] = { S: role };
              return acc;
            },
            {}
          ),
        },
        sessionState: { S: consultation.sessionState },
        connectionStatus: { S: consultation.connectionStatus },
        hasShownHint: { BOOL: Boolean(consultation.hasShownHint) },
        customNameSet: { BOOL: Boolean(consultation.customNameSet) },
        activeTab: { S: consultation.activeTab },
        createdAt: { S: consultation.createdAt },
        updatedAt: { S: consultation.updatedAt },
      }),
      { label: `consultation:${consultation.id}` }
    );
  },

  enqueueClinicalNote(note) {
    console.info("[syncService] enqueueClinicalNote invoked", note);
    const item = {
      id: { S: note.id },
      ownerUserId: { S: note.ownerUserId },
      consultationId: { S: note.consultationId },
      noteType: { S: note.noteType },
      content: { S: note.content },
      createdAt: { S: note.createdAt },
      updatedAt: { S: note.updatedAt },
    };

    if (note.title) {
      item.title = { S: note.title };
    }

    if (note.language) {
      item.language = { S: note.language };
    }

    if (note.summary) {
      item.summary = { S: note.summary };
    }

    if (note.status) {
      item.status = { S: note.status };
    }

    queue.enqueue(
      putItem("medical-scribe-clinical-notes", item, note.debugLabel),
      { label: `clinical-note:${note.id}` }
    );
  },

    enqueueTranscriptSegments(consultationId, segments, startingIndex, ownerUserId) {
      console.info("[syncService] enqueueTranscriptSegments", {
        consultationId,
        segmentsLength: segments?.length,
        startingIndex,
        ownerUserId,
      });
    if (!ENABLE_BACKGROUND_SYNC || !segments?.length) return;
    if (!ownerUserId) {
      console.warn("[syncService] missing ownerUserId, skipping batch", {
        consultationId,
        startingIndex,
      });
      return;
    }

    for (let i = 0; i < segments.length; i += SEGMENT_BATCH_LIMIT) {
      const batch = segments.slice(i, i + SEGMENT_BATCH_LIMIT);
      const batchItems = batch.map((segment, idx) => {
        const segmentIndex = startingIndex + i + idx;
        if (!Number.isFinite(segmentIndex)) {
          console.error("[syncService] invalid segmentIndex", {
            consultationId,
            startingIndex,
            i,
            idx,
          });
          return null;
        }

        return {
          PutRequest: {
            Item: {
              consultationId: { S: consultationId },
              segmentIndex: { N: segmentIndex.toString() },
              ...(ownerUserId ? { ownerUserId: { S: ownerUserId } } : {}),
              segmentId: { S: segment.id },
              ...(segment.speaker ? { speaker: { S: segment.speaker } } : {}),
              text: { S: segment.text },
              ...(segment.displayText
                ? { displayText: { S: segment.displayText } }
                : {}),
              ...(segment.translatedText
                ? { translatedText: { S: segment.translatedText } }
                : {}),
              entities: {
                L: (segment.entities || []).map((entity) => ({
                  M: {
                    BeginOffset: { N: entity.BeginOffset.toString() },
                    EndOffset: { N: entity.EndOffset.toString() },
                    Category: { S: entity.Category },
                    Type: { S: entity.Type },
                    ...(entity.Traits?.length
                      ? {
                          Traits: {
                            L: entity.Traits.map((trait) => ({
                              M: {
                                Name: { S: trait.Name },
                                Score: { N: trait.Score.toString() },
                              },
                            })),
                          },
                        }
                      : {}),
                  },
                })),
              },
            },
          },
        };
      });

      queue.enqueue(
        batchWriteSegments(
          {
            "medical-scribe-transcript-segments": batchItems,
          },
          `segments:${consultationId}:${startingIndex + i}-${
            startingIndex + i + batch.length - 1
          }`
        ),
        { label: `segments:${consultationId}:${startingIndex + i}` }
      );
    }
  },

  async flushAll(reason = "manual") {
    await queue.flushAll(reason);
  },
};

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(
    "[sync] exposing syncService as window.__syncService for debugging"
  );
  window.__syncService = syncService;
}