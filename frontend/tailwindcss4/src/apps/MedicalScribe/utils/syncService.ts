import { BatchWriteItemCommand, DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import type {
  PatientRecord,
  ConsultationRecord,
  ScreenTranscriptSegment
} from "../types/domain";

const REGION = "us-east-1";
const client = new DynamoDBClient({ region: REGION });

export interface SyncQueueItem {
  flush(): Promise<void>;
}

class SyncQueue {
  private queue: SyncQueueItem[] = [];
  private flushing = false;

  enqueue(item: SyncQueueItem) {
    this.queue.push(item);
  }

  async flushAll() {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;
        await item.flush();
      }
    } finally {
      this.flushing = false;
    }
  }
}

const syncQueue = new SyncQueue();

/* ------------------------------------------------------------------ */
/* Patient upsert                                                     */
/* ------------------------------------------------------------------ */

class PatientUpsertItem implements SyncQueueItem {
  constructor(private patient: PatientRecord) {}

  async flush() {
    const command = new PutItemCommand({
      TableName: "medical-scribe-patients",
      Item: {
        id: { S: this.patient.id },
        ownerUserId: { S: this.patient.ownerUserId },
        displayName: { S: this.patient.displayName },
        profile: {
          M: {
            name: { S: this.patient.profile.name },
            dateOfBirth: { S: this.patient.profile.dateOfBirth },
            sex: { S: this.patient.profile.sex },
            medicalRecordNumber: { S: this.patient.profile.medicalRecordNumber },
            referringPhysician: { S: this.patient.profile.referringPhysician },
            email: { S: this.patient.profile.email },
            phoneNumber: { S: this.patient.profile.phoneNumber }
          }
        },
        createdAt: { S: this.patient.createdAt },
        ...(this.patient.updatedAt ? { updatedAt: { S: this.patient.updatedAt } } : {})
      }
    });

    await client.send(command);
  }
}

/* ------------------------------------------------------------------ */
/* Consultation upsert                                                */
/* ------------------------------------------------------------------ */

class ConsultationUpsertItem implements SyncQueueItem {
  constructor(private consultation: ConsultationRecord) {}

  async flush() {
    const command = new PutItemCommand({
      TableName: "medical-scribe-consultations",
      Item: {
        id: { S: this.consultation.id },
        ownerUserId: { S: this.consultation.ownerUserId },
        patientId: { S: this.consultation.patientId },
        patientName: { S: this.consultation.patientName },
        title: { S: this.consultation.title },
        noteType: { S: this.consultation.noteType },
        language: { S: this.consultation.language },
        additionalContext: { S: this.consultation.additionalContext },
        speakerRoles: {
          M: Object.entries(this.consultation.speakerRoles).reduce(
            (acc, [speakerId, role]) => ({
              ...acc,
              [speakerId]: { S: role }
            }),
            {}
          )
        },
        sessionState: { S: this.consultation.sessionState },
        connectionStatus: { S: this.consultation.connectionStatus },
        hasShownHint: { BOOL: this.consultation.hasShownHint },
        customNameSet: { BOOL: this.consultation.customNameSet },
        activeTab: { S: this.consultation.activeTab },
        createdAt: { S: this.consultation.createdAt },
        updatedAt: { S: this.consultation.updatedAt }
      }
    });

    await client.send(command);
  }
}

/* ------------------------------------------------------------------ */
/* Transcript segment batch write                                     */
/* ------------------------------------------------------------------ */

class TranscriptSegmentBatchItem implements SyncQueueItem {
  constructor(
    private consultationId: string,
    private segments: ScreenTranscriptSegment[],
    private baseIndex: number // caller supplies starting offset
  ) {}

  async flush() {
    if (this.segments.length === 0) return;

    const writeRequests = this.segments.map((segment, offset) => {
      const segmentIndex = this.baseIndex + offset;

      return {
        PutRequest: {
          Item: {
            consultationId: { S: this.consultationId },
            segmentIndex: { N: segmentIndex.toString() },
            segmentId: { S: segment.id },
            speaker: segment.speaker ? { S: segment.speaker } : { NULL: true },
            text: { S: segment.text },
            displayText: { S: segment.displayText },
            translatedText: segment.translatedText
              ? { S: segment.translatedText }
              : { NULL: true },
            entities: {
              L: segment.entities.map(entity => ({
                M: {
                  BeginOffset: { N: entity.BeginOffset.toString() },
                  EndOffset: { N: entity.EndOffset.toString() },
                  Category: { S: entity.Category },
                  Type: { S: entity.Type },
                  ...(entity.Traits && entity.Traits.length > 0
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

    // DynamoDB BatchWrite can handle up to 25 items per call
    const command = new BatchWriteItemCommand({
      RequestItems: {
        "medical-scribe-transcript-segments": writeRequests
      }
    });

    await client.send(command);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export const syncService = {
  enqueuePatientUpsert(patient: PatientRecord) {
    syncQueue.enqueue(new PatientUpsertItem(patient));
  },

  enqueueConsultationUpsert(consultation: ConsultationRecord) {
    syncQueue.enqueue(new ConsultationUpsertItem(consultation));
  },

  enqueueTranscriptSegments(
    consultationId: string,
    segments: ScreenTranscriptSegment[],
    baseIndex: number
  ) {
    syncQueue.enqueue(new TranscriptSegmentBatchItem(consultationId, segments, baseIndex));
  },

  flushAll: () => syncQueue.flushAll()
};