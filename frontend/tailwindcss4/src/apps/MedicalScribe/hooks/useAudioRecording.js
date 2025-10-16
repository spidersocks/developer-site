import { useRef } from 'react';
import { BACKEND_WS_URL, BACKEND_API_URL, ENABLE_BACKGROUND_SYNC } from '../utils/constants';
import { getAssetPath, getFriendlySpeakerLabel, calculateAge, to16BitPCM } from '../utils/helpers';
import { syncService } from '../utils/syncService';

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

  const enqueueSegmentsForSync = (segments, baseIndex) => {
    if (
      !ENABLE_BACKGROUND_SYNC ||
      !activeConsultationId ||
      !segments ||
      !segments.length ||
      baseIndex === null ||
      baseIndex === undefined
    ) {
      return;
    }

  const ownerUserId = activeConsultation?.ownerUserId ?? null;
    console.info("[useAudioRecording] enqueueSegmentsForSync payload", {
      activeConsultationId,
      ownerUserId,
      segmentsLength: segments.length,
      baseIndex,
    });
   if (!ownerUserId) {
     console.warn(
       "[useAudioRecording] enqueueSegmentsForSync skipped: missing ownerUserId",
       { activeConsultationId, segmentsLength: segments.length, baseIndex }
     );
     return;
   }
   syncService.enqueueTranscriptSegments(
     activeConsultationId,
     segments,
     baseIndex,
     ownerUserId
   );
 };

  // Sync session state ref whenever consultation changes
  if (activeConsultation) {
    sessionStateRef.current = activeConsultation.sessionState;
  }

  const finalizeInterimSegment = () => {
    if (!activeConsultation) return;
    const text = (activeConsultation.interimTranscript || '').trim();
    if (!text) return;

    const id = `local-final-${Date.now()}`;
    const newSegments = new Map(activeConsultation.transcriptSegments || []);
    const baseIndex = newSegments.size;

    const finalSegment = {
      id,
      speaker: activeConsultation.interimSpeaker,
      text,
      entities: [],
      translatedText: null,
      displayText: text
    };

    newSegments.set(id, finalSegment);

    updateConsultation(activeConsultationId, {
      transcriptSegments: newSegments,
      interimTranscript: '',
      interimSpeaker: null
    });

    enqueueSegmentsForSync([finalSegment], baseIndex);
  };

  const startMicrophone = async () => {
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
      console.error('Microphone Error:', err);
      updateConsultation(activeConsultationId, {
        error: 'Could not access microphone. Please check browser permissions.',
        connectionStatus: 'error'
      });
      stopSession(false);
    }
  };

  const startSession = async () => {
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
        updateConsultation(activeConsultationId, { connectionStatus: 'connected' });
        startMicrophone();
      };

             ws.onmessage = (event) => {
         try {
           const data = JSON.parse(event.data);
           const results = data.Transcript?.Results ?? [];
           if (!results.length) return;
 
           const finalsToQueue = [];
 
           setConsultations((prevConsultations) => {
             const consultation = prevConsultations.find((c) => c.id === activeConsultationId);
             if (!consultation) return prevConsultations;
 
             let interimTranscript = consultation.interimTranscript || '';
             let interimSpeaker = consultation.interimSpeaker || null;
             let hasShownHint = consultation.hasShownHint;
             const newSegments = new Map(consultation.transcriptSegments || []);
 
             results.forEach((result) => {
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
 
               const finalSegment = {
                 id: result.ResultId,
                 speaker: currentSpeaker,
                 text: transcriptText,
                 entities: Array.isArray(data.ComprehendEntities)
                   ? data.ComprehendEntities
                   : [],
                 translatedText: data.TranslatedText || null,
                 displayText: data.DisplayText || transcriptText,
               };
 
               const baseIndex = newSegments.size;
               newSegments.set(result.ResultId, finalSegment);
               finalsToQueue.push({ segments: [finalSegment], baseIndex });
 
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
 
           finalsToQueue.forEach(({ segments, baseIndex }) => {
             enqueueSegmentsForSync(segments, baseIndex);
           });
         } catch (e) {
           console.error('Error processing message:', e);
         }
       };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        updateConsultation(activeConsultationId, {
          error: 'Connection to the transcription service failed.',
          connectionStatus: 'error'
        });
        stopSession(false);
      };

      ws.onclose = () => {
        updateConsultation(activeConsultationId, { connectionStatus: 'disconnected' });
      };
    } catch (e) {
      updateConsultation(activeConsultationId, {
        error: 'Could not connect to backend. Is it running?',
        connectionStatus: 'error',
        sessionState: 'idle'
      });
    }
  };

  const handlePause = () => {
    finalizeInterimSegment();
    updateConsultation(activeConsultationId, { sessionState: 'paused' });
  };

  const handleResume = () => {
    updateConsultation(activeConsultationId, { sessionState: 'recording' });
  };

  const stopSession = async (closeSocket = true) => {
    if (!activeConsultation) return;
    if (
      activeConsultation.sessionState === 'stopped' ||
      activeConsultation.sessionState === 'idle'
    ) {
      return;
    }

    updateConsultation(activeConsultationId, { sessionState: 'stopped' });

    microphoneStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== 'closed') {
      await audioContextRef.current?.close();
    }

    let finalized = false;
    if (closeSocket && websocketRef.current?.readyState === WebSocket.OPEN) {
      try {
        websocketRef.current.send(new ArrayBuffer(0));
      } catch {}
      await new Promise((r) => setTimeout(r, 700));
      finalized = !activeConsultation.interimTranscript;
      websocketRef.current?.close();
    }
    if (!finalized) finalizeInterimSegment();
  };

  const handleGenerateNote = async (noteTypeOverride) => {
    if (!activeConsultation) return;

    const noteTypeToUse = noteTypeOverride || activeConsultation.noteType;

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
    updateConsultation(activeConsultationId, { loading: true, error: null, notes: null });
    try {
      const requestBody = {
        full_transcript: transcript,
        note_type: noteTypeToUse
      };

      if (Object.keys(patientInfo).length > 0) {
        requestBody.patient_info = patientInfo;
      }

      const resp = await fetch(`${BACKEND_API_URL}/generate-final-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'An unknown server error occurred.');

      console.info("[useAudioRecording] updating consultation with note payload", {
        noteTypeToUse,
        notes: data.notes,
      });
      updateConsultation(activeConsultationId, { notes: data.notes, noteType: noteTypeToUse });

      // ✅ Set consultation timestamp on first note generation
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
  };

  return {
    startSession,
    stopSession,
    handlePause,
    handleResume,
    handleGenerateNote
  };
};