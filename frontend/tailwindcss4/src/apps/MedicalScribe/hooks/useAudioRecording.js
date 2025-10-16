import { useRef, useCallback } from 'react';
import { BACKEND_WS_URL, BACKEND_API_URL, ENABLE_BACKGROUND_SYNC } from '../utils/constants';
import { getAssetPath, getFriendlySpeakerLabel, calculateAge, to16BitPCM } from '../utils/helpers';
import { syncService } from '../utils/syncService';

/**
 * Custom hook for audio recording and real-time transcription
 * 
 * @param {Object} activeConsultation - Current active consultation
 * @param {string} activeConsultationId - ID of the active consultation
 * @param {Function} updateConsultation - Function to update consultation state
 * @param {Function} resetConsultation - Function to reset consultation state
 * @param {Function} setConsultations - Function to update consultations array
 * @param {Function} finalizeConsultationTimestamp - Function to set final timestamp
 * @returns {Object} Audio recording control functions
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

  // Keep ownerUserId in ref for access in callbacks
  if (activeConsultation?.ownerUserId) {
    ownerUserIdRef.current = activeConsultation.ownerUserId;
  }

  /**
   * Prepares a segment for sync by ensuring it has all required fields
   * 
   * @param {Object} segment - Transcript segment
   * @returns {Object} Processed segment ready for sync
   */
  const prepareSegmentForSync = useCallback((segment) => {
    if (!segment) return null;
    
    return {
      id: segment.id,
      speaker: segment.speaker || null,
      text: segment.text || "",
      displayText: segment.displayText || segment.text || "",
      translatedText: segment.translatedText || null,
      entities: Array.isArray(segment.entities) ? segment.entities : []
    };
  }, []);

  /**
   * Synchronizes transcript segments to DynamoDB
   * 
   * @param {Array} segments - Array of transcript segments
   * @param {number} baseIndex - Starting index for segments
   */
  const enqueueSegmentsForSync = useCallback((segments, baseIndex) => {
    if (
      !ENABLE_BACKGROUND_SYNC ||
      !activeConsultationId ||
      !segments?.length ||
      baseIndex === null ||
      baseIndex === undefined
    ) {
      console.warn("[useAudioRecording] Skipping sync - invalid params:", { 
        sync: ENABLE_BACKGROUND_SYNC, 
        consultationId: activeConsultationId,
        segmentsLength: segments?.length,
        baseIndex 
      });
      return;
    }

    const ownerUserId = ownerUserIdRef.current;
    
    console.info("[useAudioRecording] enqueueSegmentsForSync payload", {
      activeConsultationId,
      ownerUserId,
      segmentsLength: segments.length,
      baseIndex,
      segmentIds: segments.map(s => s.id),
    });
    
    if (!ownerUserId) {
      console.error(
        "[useAudioRecording] enqueueSegmentsForSync FAILED: missing ownerUserId",
        { activeConsultationId, segmentsLength: segments.length, baseIndex }
      );
      return;
    }
    
    // Process segments to ensure proper structure
    const processedSegments = segments
      .map(prepareSegmentForSync)
      .filter(Boolean);
    
    if (processedSegments.length === 0) {
      console.warn("[useAudioRecording] No valid segments to sync after processing");
      return;
    }
    
    syncService.enqueueTranscriptSegments(
      activeConsultationId,
      processedSegments,
      baseIndex,
      ownerUserId
    );
  }, [activeConsultationId, prepareSegmentForSync]);

  // Sync session state ref whenever consultation changes
  if (activeConsultation) {
    sessionStateRef.current = activeConsultation.sessionState;
  }

  /**
   * Finalizes an interim transcript segment and adds it to the permanent transcript
   */
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

    console.info("[useAudioRecording] Finalizing interim segment", {
      id,
      text,
      speaker: finalSegment.speaker,
      baseIndex
    });

    // First update the local state with the new segment
    const newSegments = new Map(activeConsultation.transcriptSegments);
    newSegments.set(id, finalSegment);

    updateConsultation(activeConsultationId, {
      transcriptSegments: newSegments,
      interimTranscript: '',
      interimSpeaker: null
    });

    // Then sync the segment to DynamoDB
    enqueueSegmentsForSync([finalSegment], baseIndex);
  }, [activeConsultation, activeConsultationId, updateConsultation, enqueueSegmentsForSync]);

  /**
   * Initializes and starts the microphone for recording
   */
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

  /**
   * Starts a new recording session
   */
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

          // Track segments that need to be synced
          const segmentsToSync = [];

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

              // Final transcript segment
              const finalSegment = {
                id: result.ResultId,
                speaker: currentSpeaker,
                text: transcriptText,
                entities: Array.isArray(data.ComprehendEntities) ? data.ComprehendEntities : [],
                translatedText: data.TranslatedText || null,
                displayText: data.DisplayText || transcriptText,
              };

              // Add to state update
              newSegments.set(result.ResultId, finalSegment);
              
              // Add to sync queue (with the correct index)
              segmentsToSync.push({
                segment: finalSegment,
                index: baseIndex + idx
              });

              interimTranscript = '';
              interimSpeaker = null;
              if (currentSpeaker) hasShownHint = true;
            });

            // Return updated consultation with new segments
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

          // Sync each segment
          segmentsToSync.forEach(({ segment, index }) => {
            console.info("[useAudioRecording] Syncing final segment", {
              id: segment.id, 
              index, 
              text: segment.text?.substring(0, 20) + (segment.text?.length > 20 ? "..." : "")
            });
            enqueueSegmentsForSync([segment], index);
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
    enqueueSegmentsForSync
  ]);

  /**
   * Pauses the current recording session
   */
  const handlePause = useCallback(() => {
    console.info("[useAudioRecording] Pausing recording session");
    finalizeInterimSegment();
    updateConsultation(activeConsultationId, { sessionState: 'paused' });
  }, [activeConsultationId, updateConsultation, finalizeInterimSegment]);

  /**
   * Resumes the current recording session
   */
  const handleResume = useCallback(() => {
    console.info("[useAudioRecording] Resuming recording session");
    updateConsultation(activeConsultationId, { sessionState: 'recording' });
  }, [activeConsultationId, updateConsultation]);

  /**
   * Stops the current recording session
   * 
   * @param {boolean} closeSocket - Whether to close the WebSocket connection
   * @returns {Promise<void>}
   */
  const stopSession = useCallback(async (closeSocket = true) => {
    if (!activeConsultation) return;
    
    if (
      activeConsultation.sessionState === 'stopped' ||
      activeConsultation.sessionState === 'idle'
    ) {
      return;
    }

    console.info("[useAudioRecording] Stopping recording session");
    updateConsultation(activeConsultationId, { sessionState: 'stopped' });

    // Stop microphone tracks
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((t) => t.stop());
      microphoneStreamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current?.state !== 'closed') {
      try {
        await audioContextRef.current?.close();
      } catch (err) {
        console.warn("[useAudioRecording] Error closing AudioContext:", err);
      }
    }

    // Finalize any interim transcript
    let finalized = false;
    
    if (closeSocket && websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        // Send empty buffer to signal end of audio
        websocketRef.current.send(new ArrayBuffer(0));
        // Wait a bit for any final results
        await new Promise((r) => setTimeout(r, 700));
        finalized = !activeConsultation.interimTranscript;
      } catch (err) {
        console.warn("[useAudioRecording] Error during WebSocket cleanup:", err);
      }
      
      try {
        websocketRef.current?.close();
        websocketRef.current = null;
      } catch (err) {
        console.warn("[useAudioRecording] Error closing WebSocket:", err);
      }
    }
    
    if (!finalized) {
      finalizeInterimSegment();
    }
  }, [activeConsultation, activeConsultationId, updateConsultation, finalizeInterimSegment]);

  /**
   * Generates a clinical note based on the transcript
   * 
   * @param {string} noteTypeOverride - Optional override for note type
   * @returns {Promise<void>}
   */
  const handleGenerateNote = useCallback(async (noteTypeOverride) => {
    if (!activeConsultation) {
      console.warn("[useAudioRecording] Cannot generate note: no active consultation");
      return;
    }

    const noteTypeToUse = noteTypeOverride || activeConsultation.noteType;
    console.info("[useAudioRecording] Generating note with type:", noteTypeToUse);

    // Build transcript from all segments
    let transcript = '';
    Array.from(activeConsultation.transcriptSegments.values()).forEach((seg) => {
      transcript += `[${getFriendlySpeakerLabel(seg.speaker, activeConsultation.speakerRoles)}]: ${
        seg.displayText
      }\n`;
    });
    
    if (!transcript.trim()) {
      updateConsultation(activeConsultationId, {
        error: 'Transcript is empty. Nothing to generate.'
      });
      return;
    }

    // Prepare patient information for the API request
    const patientInfo = {};
    if (activeConsultation.patientProfile.name) {
      patientInfo.name = activeConsultation.patientProfile.name;
    }
    if (activeConsultation.patientProfile.sex) {
      patientInfo.sex = activeConsultation.patientProfile.sex;
    }
    if (activeConsultation.patientProfile.dateOfBirth) {
      const age = calculateAge(activeConsultation.patientProfile.dateOfBirth);
      if (age) patientInfo.age = age;
    }
    if (activeConsultation.patientProfile.referringPhysician) {
      patientInfo.referring_physician = activeConsultation.patientProfile.referringPhysician;
    }
    if (activeConsultation.additionalContext) {
      patientInfo.additional_context = activeConsultation.additionalContext;
    }
    
    // Update consultation state to show loading
    updateConsultation(activeConsultationId, { loading: true, error: null, notes: null });
    
    try {
      const requestBody = {
        full_transcript: transcript,
        note_type: noteTypeToUse
      };

      if (Object.keys(patientInfo).length > 0) {
        requestBody.patient_info = patientInfo;
      }

      console.info("[useAudioRecording] Sending note generation request:", {
        transcriptLength: transcript.length,
        noteType: noteTypeToUse,
        hasPatientInfo: Object.keys(patientInfo).length > 0
      });

      // Call the API to generate the note
      const resp = await fetch(`${BACKEND_API_URL}/generate-final-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await resp.json();
      
      if (!resp.ok) {
        throw new Error(data.detail || 'An unknown server error occurred.');
      }

      console.info("[useAudioRecording] Note generation successful");
      
      // Update consultation with the generated note
      updateConsultation(activeConsultationId, { 
        notes: data.notes, 
        noteType: noteTypeToUse,
        // Set these fields to help with sync
        noteId: activeConsultationId,
        notesCreatedAt: new Date().toISOString(),
        notesUpdatedAt: new Date().toISOString()
      });

      // Set consultation timestamp on first note generation
      if (finalizeConsultationTimestamp) {
        finalizeConsultationTimestamp(activeConsultationId);
      }
    } catch (err) {
      console.error("[useAudioRecording] Note generation failed:", err);
      updateConsultation(activeConsultationId, {
        error: `Failed to generate final note: ${err.message}`
      });
    } finally {
      updateConsultation(activeConsultationId, { loading: false });
    }
  }, [activeConsultation, activeConsultationId, updateConsultation, finalizeConsultationTimestamp]);

  return {
    startSession,
    stopSession,
    handlePause,
    handleResume,
    handleGenerateNote,
    finalizeInterimSegment // Export this for potential direct use
  };
};