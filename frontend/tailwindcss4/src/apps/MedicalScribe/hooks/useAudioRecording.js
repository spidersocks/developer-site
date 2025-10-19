import { useRef, useCallback } from 'react';
import { BACKEND_WS_URL, BACKEND_API_URL, ENABLE_BACKGROUND_SYNC } from '../utils/constants';
import { getAssetPath, getFriendlySpeakerLabel, calculateAge, to16BitPCM } from '../utils/helpers';
// REMOVE: import { syncService } from "../utils/syncService";
import { apiClient } from "../utils/apiClient";

/**
 * Custom hook for audio recording and real-time transcription
 */
export const useAudioRecording = (
  activeConsultation,
  activeConsultationId,
  updateConsultation,
  resetConsultation,
  setConsultations,
  finalizeConsultationTimestamp
) => {
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const sessionStateRef = useRef('idle');
  const ownerUserIdRef = useRef(null);

  if (activeConsultation?.ownerUserId) {
    ownerUserIdRef.current = activeConsultation.ownerUserId;
  }

  // Persist a finalized segment to the backend (no entities)
  const persistFinalSegment = useCallback(async (segment, sequenceNumber, detectedLanguage) => {
    try {
      await apiClient.createTranscriptSegment({
        // If your API enforces auth, pass access token here from useAuth; otherwise this can be omitted
        token: undefined,
        consultationId: activeConsultationId,
        payload: {
          sequence_number: sequenceNumber,
          speaker_label: segment.speaker ?? null,
          speaker_role: undefined, // optional: derive from speakerRoles if desired
          original_text: segment.text ?? "",
          translated_text: segment.translatedText ?? null,
          detected_language: detectedLanguage ?? null,
          start_time_ms: undefined,
          end_time_ms: undefined,
          // IMPORTANT: do not send entities; they will be re-computed on demand
          entities: undefined,
        },
      });
    } catch (e) {
      console.error("[useAudioRecording] Failed to persist transcript segment:", e);
    }
  }, [activeConsultationId]);

  const prepareSegmentForUi = useCallback((raw) => {
    if (!raw) return null;
    return {
      id: raw.id,
      speaker: raw.speaker || null,
      text: raw.text || "",
      displayText: raw.displayText || raw.text || "",
      translatedText: raw.translatedText || null,
      entities: Array.isArray(raw.entities) ? raw.entities : [], // live entities (from websocket) only
    };
  }, []);

  // DO NOT enqueue segments to DynamoDB directly anymore
  const enqueueSegmentsForSync = useCallback((_segments, _baseIndex) => {
    // No-op: we now persist via backend API
  }, []);

  if (activeConsultation) {
    sessionStateRef.current = activeConsultation.sessionState;
  }

  const finalizeInterimSegment = useCallback(() => {
    if (!activeConsultation) return;
    const text = (activeConsultation.interimTranscript || '').trim();
    if (!text) return;

    const id = `local-final-${Date.now()}`;
    const baseIndex = activeConsultation.transcriptSegments.size;

    const finalSegment = {
      id,
      speaker: activeConsultation.interimSpeaker,
      text,
      entities: [],
      translatedText: null,
      displayText: text
    };

    const newSegments = new Map(activeConsultation.transcriptSegments);
    newSegments.set(id, finalSegment);

    updateConsultation(activeConsultationId, {
      transcriptSegments: newSegments,
      interimTranscript: '',
      interimSpeaker: null
    });

    // Persist via backend API (no entities)
    persistFinalSegment(finalSegment, baseIndex, activeConsultation.language || "en-US");
  }, [activeConsultation, activeConsultationId, updateConsultation, persistFinalSegment]);

  const startMicrophone = useCallback(async () => {
    if (!activeConsultation) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;
      await context.audioWorklet.addModule(getAssetPath('/audio-processor.js'));
      const source = context.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(context, 'audio-downsampler-processor');
      audioWorkletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (
          sessionStateRef.current === 'recording' &&
          websocketRef.current?.readyState === WebSocket.OPEN
        ) {
          websocketRef.current.send(to16BitPCM(new Float32Array(event.data)));
        }
      };

      source.connect(workletNode);
      updateConsultation(activeConsultationId, { sessionState: 'recording' });
    } catch (err) {
      console.error('[useAudioRecording] Microphone Error:', err);
      updateConsultation(activeConsultationId, {
        error: 'Could not access microphone. Please check browser permissions.',
        connectionStatus: 'error'
      });
      stopSession(false);
    }
  }, [activeConsultation, activeConsultationId, updateConsultation]);

  const startSession = useCallback(async () => {
    if (!activeConsultation) return;
    resetConsultation(activeConsultationId);
    updateConsultation(activeConsultationId, {
      sessionState: 'connecting',
      connectionStatus: 'connecting',
      activeTab: 'transcript'
    });

    try {
      const ws = new WebSocket(
        `${BACKEND_WS_URL}?language_code=${encodeURIComponent(activeConsultation.language)}`
      );
      websocketRef.current = ws;

      ws.onopen = () => {
        console.info("[useAudioRecording] WebSocket connection established");
        updateConsultation(activeConsultationId, { connectionStatus: 'connected' });
        startMicrophone();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const results = data.Transcript?.Results ?? [];
          if (!results.length) return;

          const segmentsToPersist = [];

          setConsultations((prevConsultations) => {
            const consultation = prevConsultations.find((c) => c.id === activeConsultationId);
            if (!consultation) return prevConsultations;

            let interimTranscript = consultation.interimTranscript || '';
            let interimSpeaker = consultation.interimSpeaker || null;
            let hasShownHint = consultation.hasShownHint;
            const newSegments = new Map(consultation.transcriptSegments || []);
            const baseIndex = newSegments.size;

            results.forEach((result, idx) => {
              const alt = result.Alternatives?.[0];
              if (!alt) return;

              const transcriptText = alt.Transcript;
              const firstWord = alt.Items?.find((i) => i.Type === 'pronunciation');
              const currentSpeaker = firstWord ? firstWord.Speaker : null;

              if (result.IsPartial) {
                interimTranscript = transcriptText;
                interimSpeaker = currentSpeaker;
                return;
              }

              // Final UI segment enriched live with entities from server push (data.ComprehendEntities)
              const uiSegment = prepareSegmentForUi({
                id: result.ResultId,
                speaker: currentSpeaker,
                text: transcriptText,
                entities: Array.isArray(data.ComprehendEntities) ? data.ComprehendEntities : [],
                translatedText: data.TranslatedText || null,
                displayText: data.DisplayText || transcriptText,
              });

              newSegments.set(uiSegment.id, uiSegment);

              // Queue for persistence (without entities)
              segmentsToPersist.push({
                ui: uiSegment,
                sequenceNumber: baseIndex + idx,
                detectedLanguage: result.LanguageCode || activeConsultation.language || "en-US"
              });

              interimTranscript = '';
              interimSpeaker = null;
              if (currentSpeaker) hasShownHint = true;
            });

            return prevConsultations.map((c) =>
              c.id === activeConsultationId
                ? {
                    ...c,
                    transcriptSegments: newSegments,
                    interimTranscript,
                    interimSpeaker,
                    hasShownHint,
                  }
                : c
            );
          });

          // Persist finalized segments (no entities) via backend API
          segmentsToPersist.forEach(({ ui, sequenceNumber, detectedLanguage }) => {
            persistFinalSegment(ui, sequenceNumber, detectedLanguage);
          });
        } catch (e) {
          console.error('[useAudioRecording] Error processing WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('[useAudioRecording] WebSocket error:', err);
        updateConsultation(activeConsultationId, {
          error: 'Connection to the transcription service failed.',
          connectionStatus: 'error'
        });
        stopSession(false);
      };

      ws.onclose = () => {
        console.info("[useAudioRecording] WebSocket connection closed");
        updateConsultation(activeConsultationId, { connectionStatus: 'disconnected' });
      };
    } catch (e) {
      console.error('[useAudioRecording] Failed to start session:', e);
      updateConsultation(activeConsultationId, {
        error: 'Could not connect to backend. Is it running?',
        connectionStatus: 'error',
        sessionState: 'idle'
      });
    }
  }, [
    activeConsultation,
    activeConsultationId,
    resetConsultation,
    updateConsultation,
    startMicrophone,
    setConsultations,
    prepareSegmentForUi,
    persistFinalSegment
  ]);

  const handlePause = useCallback(() => {
    finalizeInterimSegment();
    updateConsultation(activeConsultationId, { sessionState: 'paused' });
  }, [activeConsultationId, updateConsultation, finalizeInterimSegment]);

  const handleResume = useCallback(() => {
    updateConsultation(activeConsultationId, { sessionState: 'recording' });
  }, [activeConsultationId, updateConsultation]);

  const stopSession = useCallback(async (closeSocket = true) => {
    if (!activeConsultation) return;
    if (activeConsultation.sessionState === 'stopped' || activeConsultation.sessionState === 'idle') {
      return;
    }

    updateConsultation(activeConsultationId, { sessionState: 'stopped' });

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((t) => t.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      try { await audioContextRef.current?.close(); } catch {}
    }

    let finalized = false;

    if (closeSocket && websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(new ArrayBuffer(0));
        await new Promise((r) => setTimeout(r, 700));
        finalized = !activeConsultation.interimTranscript;
      } catch {}
      try { websocketRef.current?.close(); websocketRef.current = null; } catch {}
    }

    if (!finalized) {
      finalizeInterimSegment();
    }
  }, [activeConsultation, activeConsultationId, updateConsultation, finalizeInterimSegment]);

  const handleGenerateNote = useCallback(async (noteTypeOverride) => {
    if (!activeConsultation) return;
    const noteTypeToUse = noteTypeOverride || activeConsultation.noteType;

    let transcript = '';
    Array.from(activeConsultation.transcriptSegments.values()).forEach((seg) => {
      transcript += `[${getFriendlySpeakerLabel(seg.speaker, activeConsultation.speakerRoles)}]: ${seg.displayText}\n`;
    });

    if (!transcript.trim()) {
      updateConsultation(activeConsultationId, { error: 'Transcript is empty. Nothing to generate.' });
      return;
    }

    updateConsultation(activeConsultationId, { loading: true, error: null, notes: null });

    try {
      const requestBody = { full_transcript: transcript, note_type: noteTypeToUse };
      const resp = await fetch(`${BACKEND_API_URL}/generate-final-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Server error');

      updateConsultation(activeConsultationId, {
        notes: data.notes,
        noteType: noteTypeToUse,
        noteId: activeConsultationId,
        notesCreatedAt: new Date().toISOString(),
        notesUpdatedAt: new Date().toISOString()
      });

      if (finalizeConsultationTimestamp) {
        finalizeConsultationTimestamp(activeConsultationId);
      }
    } catch (err) {
      updateConsultation(activeConsultationId, {
        error: `Failed to generate final note: ${err.message}`
      });
    } finally {
      updateConsultation(activeConsultationId, { loading: false });
    }
  }, [activeConsultation, activeConsultationId, updateConsultation, finalizeConsultationTimestamp]);

  // Optional dev debug kept as no-op for DB writes
  const debugTranscriptSegments = useCallback(() => {
    // Leave as is or remove; do not write directly to DynamoDB
  }, []);

  // Re-export
  return {
    startSession,
    stopSession,
    handlePause,
    handleResume,
    handleGenerateNote,
    finalizeInterimSegment,
    debugTranscriptSegments
  };
};