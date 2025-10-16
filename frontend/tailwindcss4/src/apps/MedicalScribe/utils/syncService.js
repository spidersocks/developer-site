import { BatchWriteItemCommand, DeleteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ENABLE_BACKGROUND_SYNC } from "./constants";
import {
  AWS_REGION,
  credentialsProvider,
  getDynamoClient,
  warmAwsCredentials,
} from "./awsClients";

const SEGMENT_BATCH_LIMIT = 25;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

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
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      retried: 0,
    };
  }

  enqueue(task, meta = {}) {
    if (!ENABLE_BACKGROUND_SYNC) return;
    this.items.push({ 
      run: task, 
      meta, 
      retryCount: 0,
      createdAt: new Date().toISOString()
    });
    this.stats.total++;
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
      stats: this.stats,
    });

    try {
      const failedItems = [];
      
      while (this.items.length > 0) {
        const item = this.items.shift();
        console.info(
          "[sync][queue] executing task",
          item.meta.label ?? "task",
          "remaining =",
          this.items.length,
          "retryCount =", 
          item.retryCount
        );
        
        try {
          // eslint-disable-next-line no-await-in-loop
          await item.run();
          this.stats.success++;
          console.info(
            "[sync][queue] completed task",
            item.meta.label ?? "task"
          );
        } catch (error) {
          console.error("[sync][queue] task failed", {
            error,
            label: item.meta.label,
            retryCount: item.retryCount
          });
          
          // If we haven't exceeded max retries, add it back to queue
          if (item.retryCount < MAX_RETRIES) {
            item.retryCount++;
            this.stats.retried++;
            failedItems.push(item);
            // Add exponential backoff delay
            await new Promise(resolve => 
              setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, item.retryCount - 1))
            );
          } else {
            this.stats.failed++;
            console.error("[sync][queue] max retries exceeded, abandoning task", {
              label: item.meta.label,
              error
            });
          }
        }
      }
      
      // Re-add failed items that haven't exceeded retry count
      if (failedItems.length > 0) {
        this.items.push(...failedItems);
        console.info("[sync][queue] re-queued failed items", {
          count: failedItems.length
        });
      }
    } finally {
      this.flushing = false;
      console.info("[sync][queue] flush complete", { 
        reason,
        stats: this.stats,
        pendingItems: this.items.length
      });
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

function deleteItem(tableName, key, debugLabel) {
  return async () => {
    if (!dynamoClient) return;
    console.info("[sync][dynamodb] DeleteItem", { tableName, key, debugLabel });
    await dynamoClient.send(
      new DeleteItemCommand({ 
        TableName: tableName, 
        Key: key 
      })
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
  
  enqueuePatientDeletion(patientId, ownerUserId) {
    console.info("[syncService] enqueuePatientDeletion invoked", {
      patientId,
      ownerUserId
    });
    
    queue.enqueue(
      deleteItem("medical-scribe-patients", 
        { id: { S: patientId } },
        `delete-patient:${patientId}`
      ),
      { label: `delete-patient:${patientId}` }
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
  
  enqueueConsultationDeletion(consultationId, ownerUserId) {
    console.info("[syncService] enqueueConsultationDeletion invoked", {
      consultationId,
      ownerUserId
    });
    
    queue.enqueue(
      deleteItem("medical-scribe-consultations", 
        { id: { S: consultationId } },
        `delete-consultation:${consultationId}`
      ),
      { label: `delete-consultation:${consultationId}` }
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
  
  enqueueClinicalNoteDeletion(noteId, ownerUserId) {
    console.info("[syncService] enqueueClinicalNoteDeletion invoked", {
      noteId,
      ownerUserId
    });
    
    queue.enqueue(
      deleteItem("medical-scribe-clinical-notes", 
        { id: { S: noteId } },
        `delete-clinical-note:${noteId}`
      ),
      { label: `delete-clinical-note:${noteId}` }
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

    // Input validation
    if (!consultationId) {
      console.error("[syncService] Missing consultationId, cannot sync segments");
      return;
    }
    
    if (startingIndex === null || startingIndex === undefined || !Number.isFinite(startingIndex)) {
      console.error("[syncService] Invalid startingIndex", { startingIndex });
      return;
    }

    // Safely process segments in batches
    for (let i = 0; i < segments.length; i += SEGMENT_BATCH_LIMIT) {
      const batch = segments.slice(i, i + SEGMENT_BATCH_LIMIT);
      
      // Map segments to DynamoDB items
      const batchItems = batch.map((segment, idx) => {
        const segmentIndex = startingIndex + i + idx;
        
        // Skip segments with invalid indexes
        if (!Number.isFinite(segmentIndex)) {
          console.error("[syncService] invalid segmentIndex", {
            consultationId,
            startingIndex,
            i,
            idx,
          });
          return null;
        }
        
        if (!segment || !segment.id) {
          console.error("[syncService] invalid segment, missing id", { segment });
          return null;
        }

        // Create the PutRequest for this segment with all required fields
        return {
          PutRequest: {
            Item: {
              consultationId: { S: consultationId },
              segmentIndex: { N: segmentIndex.toString() },
              ownerUserId: { S: ownerUserId }, // CRITICAL: Always include ownerUserId
              segmentId: { S: segment.id },
              speaker: segment.speaker ? { S: segment.speaker } : { NULL: true },
              text: { S: segment.text || "" },
              displayText: segment.displayText ? { S: segment.displayText } : { S: segment.text || "" },
              translatedText: segment.translatedText ? { S: segment.translatedText } : { NULL: true },
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
              createdAt: { S: new Date().toISOString() },
            },
          },
        };
      }).filter(Boolean); // Remove null items

      if (batchItems.length === 0) {
        console.warn("[syncService] No valid segments to sync in batch");
        continue;
      }

      // Create the batch write operation with unique debug label
      const debugLabel = `segments:${consultationId}:${startingIndex + i}-${
        startingIndex + i + batch.length - 1
      }`;
      
      // Enqueue the batch write operation
      queue.enqueue(
        batchWriteSegments(
          {
            "medical-scribe-transcript-segments": batchItems,
          },
          debugLabel
        ),
        { 
          label: `segments:${consultationId}:${startingIndex + i}`,
          segmentIds: batch.map(s => s.id),
          batchSize: batchItems.length
        }
      );
    }
  },
  
  enqueueSegmentDeletion(segmentId, consultationId, ownerUserId) {
    console.info("[syncService] enqueueSegmentDeletion invoked", {
      segmentId,
      consultationId,
      ownerUserId
    });
    
    queue.enqueue(
      deleteItem("medical-scribe-transcript-segments", 
        { segmentId: { S: segmentId } },
        `delete-segment:${segmentId}`
      ),
      { label: `delete-segment:${segmentId}` }
    );
  },

  async flushAll(reason = "manual") {
    await queue.flushAll(reason);
  },
  
  // Get stats about the sync queue
  getStats() {
    return {
      pendingItems: queue.items.length,
      ...queue.stats
    };
  },
  
  // Reset stats counter
  resetStats() {
    queue.stats = {
      total: 0,
      success: 0,
      failed: 0,
      retried: 0
    };
  }
};

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(
    "[sync] exposing syncService as window.__syncService for debugging"
  );
  window.__syncService = syncService;
}