import { useRef } from 'react';
import { BACKEND_WS_URL, BACKEND_API_URL } from '../utils/constants';
import { getAssetPath, getFriendlySpeakerLabel, calculateAge, to16BitPCM } from '../utils/helpers';

export const useAudioRecording = (
  activeConsultation,
  activeConsultationId,
  updateConsultation,
  resetConsultation,
  setConsultations
) => {
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const sessionStateRef = useRef("idle");

  // Sync session state ref whenever consultation changes
  if (activeConsultation) {
    sessionStateRef.current = activeConsultation.sessionState;
  }

  const finalizeInterimSegment = () => {
    if (!activeConsultation) return;
    const text = (activeConsultation.interimTranscript || "").trim();
    if (!text) return;
    const id = `local-final-${Date.now()}`;
    const newSegments = new Map(activeConsultation.transcriptSegments);
    newSegments.set(id, {
      id,
      speaker: activeConsultation.interimSpeaker,
      text,
      entities: [],
      translatedText: null,
      displayText: text,
    });
    updateConsultation(activeConsultationId, {
      transcriptSegments: newSegments,
      interimTranscript: "",
      interimSpeaker: null,
    });
  };

  const startMicrophone = async () => {
    if (!activeConsultation) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;
      await context.audioWorklet.addModule(getAssetPath("/audio-processor.js"));
      const source = context.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(context, "audio-downsampler-processor");
      audioWorkletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (
          sessionStateRef.current === "recording" &&
          websocketRef.current?.readyState === WebSocket.OPEN
        ) {
          websocketRef.current.send(to16BitPCM(new Float32Array(event.data)));
        }
      };

      source.connect(workletNode);
      updateConsultation(activeConsultationId, { sessionState: "recording" });
    } catch (err) {
      console.error("Microphone Error:", err);
      updateConsultation(activeConsultationId, {
        error: "Could not access microphone. Please check browser permissions.",
        connectionStatus: "error",
      });
      stopSession(false);
    }
  };

  const startSession = async () => {
    if (!activeConsultation) return;
    resetConsultation(activeConsultationId);
    updateConsultation(activeConsultationId, {
      sessionState: "connecting",
      connectionStatus: "connecting",
      activeTab: "transcript",
    });

    try {
      const ws = new WebSocket(
        `${BACKEND_WS_URL}?language_code=${encodeURIComponent(activeConsultation.language)}`
      );
      websocketRef.current = ws;

      ws.onopen = () => {
        updateConsultation(activeConsultationId, { connectionStatus: "connected" });
        startMicrophone();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.Transcript?.Results?.length || !data.Transcript.Results[0].Alternatives?.length)
            return;
          const result = data.Transcript.Results[0];
          const alt = result.Alternatives[0];
          const transcriptText = alt.Transcript;
          const firstWord = alt.Items?.find((i) => i.Type === "pronunciation");
          const currentSpeaker = firstWord ? firstWord.Speaker : null;

          setConsultations((prevConsultations) => {
            const consultation = prevConsultations.find((c) => c.id === activeConsultationId);
            if (!consultation) return prevConsultations;

            if (result.IsPartial) {
              return prevConsultations.map((c) =>
                c.id === activeConsultationId
                  ? {
                      ...c,
                      interimTranscript: transcriptText,
                      interimSpeaker: currentSpeaker,
                    }
                  : c
              );
            } else {
              const finalSegment = {
                id: result.ResultId,
                speaker: currentSpeaker,
                text: transcriptText,
                entities: data.ComprehendEntities || [],
                translatedText: data.TranslatedText || null,
                displayText: data.DisplayText || transcriptText,
              };
              const newSegments = new Map(consultation.transcriptSegments);
              newSegments.set(result.ResultId, finalSegment);
              return prevConsultations.map((c) =>
                c.id === activeConsultationId
                  ? {
                      ...c,
                      transcriptSegments: newSegments,
                      interimTranscript: "",
                      interimSpeaker: null,
                      hasShownHint: currentSpeaker ? true : c.hasShownHint,
                    }
                  : c
              );
            }
          });
        } catch (e) {
          console.error("Error processing message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        updateConsultation(activeConsultationId, {
          error: "Connection to the transcription service failed.",
          connectionStatus: "error",
        });
        stopSession(false);
      };
      ws.onclose = () => {
        updateConsultation(activeConsultationId, { connectionStatus: "disconnected" });
      };
    } catch (e) {
      updateConsultation(activeConsultationId, {
        error: "Could not connect to backend. Is it running?",
        connectionStatus: "error",
        sessionState: "idle",
      });
    }
  };

  const handlePause = () => {
    finalizeInterimSegment();
    updateConsultation(activeConsultationId, { sessionState: "paused" });
  };

  const handleResume = () => {
    updateConsultation(activeConsultationId, { sessionState: "recording" });
  };

  const stopSession = async (closeSocket = true) => {
    if (!activeConsultation) return;
    if (activeConsultation.sessionState === "stopped" || activeConsultation.sessionState === "idle")
      return;

    updateConsultation(activeConsultationId, { sessionState: "stopped" });

    microphoneStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== "closed")
      audioContextRef.current?.close();

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

    let transcript = "";
    Array.from(activeConsultation.transcriptSegments.values()).forEach((seg) => {
      transcript += `[${getFriendlySpeakerLabel(seg.speaker, activeConsultation.speakerRoles)}]: ${
        seg.displayText
      }\n`;
    });
    if (!transcript.trim()) {
      updateConsultation(activeConsultationId, {
        error: "Transcript is empty. Nothing to generate.",
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
        note_type: noteTypeToUse,
      };

      if (Object.keys(patientInfo).length > 0) {
        requestBody.patient_info = patientInfo;
      }

      const resp = await fetch(`${BACKEND_API_URL}/generate-final-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "An unknown server error occurred.");
      updateConsultation(activeConsultationId, { notes: data.notes, noteType: noteTypeToUse });
    } catch (err) {
      updateConsultation(activeConsultationId, {
        error: `Failed to generate final note: ${err.message}`,
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
    handleGenerateNote,
  };
};