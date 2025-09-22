import React, { useState, useRef, useEffect } from "react";
import "./App.css";

// Backend URLs (env or defaults)
const BACKEND_WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:8000/client-transcribe";
const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:8000";

// Helpers
const getFriendlySpeakerLabel = (speakerId, speakerRoles) => {
  if (!speakerId) return "...";
  if (speakerRoles[speakerId]) return speakerRoles[speakerId];
  const speakerNum = parseInt(String(speakerId).replace("spk_", ""), 10);
  return !isNaN(speakerNum) ? `Speaker ${speakerNum + 1}` : speakerId;
};

// Entity-highlighted text
const HighlightedText = React.memo(({ text, entities }) => {
  if (!text || !entities || entities.length === 0) return <>{text}</>;

  // Filter out dominated entities to prevent nested overlaps
  const nonDominatedEntities = entities.filter(
    (entityA) =>
      !entities.some(
        (entityB) =>
          entityA !== entityB &&
          entityA.BeginOffset >= entityB.BeginOffset &&
          entityA.EndOffset <= entityB.EndOffset &&
          (entityB.BeginOffset < entityA.BeginOffset ||
            entityB.EndOffset > entityA.EndOffset)
      )
  );

  // Deduplicate same ranges
  const uniqueRangeEntities = new Map();
  nonDominatedEntities.forEach((entity) => {
    const key = `${entity.BeginOffset}-${entity.EndOffset}`;
    if (!uniqueRangeEntities.has(key)) uniqueRangeEntities.set(key, entity);
  });

  const finalEntities = Array.from(uniqueRangeEntities.values());
  const sorted = finalEntities.sort((a, b) => a.BeginOffset - b.BeginOffset);

  let lastIndex = 0;
  const parts = [];
  sorted.forEach((entity, index) => {
    if (entity.BeginOffset > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex, entity.BeginOffset)}
        </span>
      );
    }
    const tooltipText = entity.Category.replace(/_/g, " ");
    parts.push(
      <span
        key={`entity-${index}`}
        className={`entity entity-${entity.Category}`}
        data-tooltip={tooltipText}
      >
        {text.substring(entity.BeginOffset, entity.EndOffset)}
      </span>
    );
    lastIndex = entity.EndOffset;
  });

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>
    );
  }

  return <>{parts}</>;
});

// Transcript segment block
const TranscriptSegment = React.memo(
  ({ segment, speakerRoles, onSpeakerRoleToggle }) => {
    const isEnglishSession = !segment.translatedText;
    const speakerLabel = getFriendlySpeakerLabel(segment.speaker, speakerRoles);
    return (
      <div className="transcript-segment-container">
        <p
          className={
            isEnglishSession ? "english-only-transcript" : "original-transcript-text"
          }
        >
          <strong
            className="speaker-label-clickable"
            onClick={() => onSpeakerRoleToggle(segment.speaker)}
            title="Click to change role"
          >
            [{speakerLabel}]:
          </strong>{" "}
          {isEnglishSession ? (
            <HighlightedText text={segment.text} entities={segment.entities} />
          ) : (
            segment.displayText
          )}
        </p>
        {!isEnglishSession && (
          <p className="translated-transcript-text">
            <HighlightedText
              text={segment.translatedText}
              entities={segment.entities}
            />
          </p>
        )}
      </div>
    );
  }
);

const EditPencilIcon = () => (
  <svg
    className="edit-pencil-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    width="16"
    height="16"
  >
    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
    <path
      fillRule="evenodd"
      d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
      clipRule="evenodd"
    />
  </svg>
);

// Command bar and modal
const CommandBar = ({ notes, setNotes }) => {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [modalTitle, setModalTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const handleModalClose = () => {
    setModalContent(null);
    setCopied(false);
  };

  const handleCopyResult = () => {
    if (!modalContent) return;
    navigator.clipboard.writeText(modalContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!command.trim() || !notes) return;

    setIsLoading(true);
    try {
      const resp = await fetch(`${BACKEND_API_URL}/execute-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: notes, command }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "An unknown server error occurred.");
      setModalTitle(`Result for: "${command}"`);
      setModalContent(data.result);
    } catch (err) {
      setModalTitle("Error");
      setModalContent(err.message);
    } finally {
      setIsLoading(false);
      setCommand("");
    }
  };

  return (
    <>
      <div className="command-bar-container">
        <form onSubmit={handleSubmit} className="command-bar-form">
          <input
            type="text"
            className="command-bar-input"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder='e.g., "Write a referral letter to a cardiologist for atrial fibrillation"'
            disabled={!notes || isLoading}
          />
          <button
            type="submit"
            className="button command-bar-button"
            disabled={!notes || isLoading}
          >
            {isLoading ? "Working..." : "Execute"}
          </button>
        </form>
      </div>

      {modalContent && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modalTitle}</h3>
              <button className="modal-close-button" onClick={handleModalClose}>
                &times;
              </button>
            </div>
            <div className="modal-body">{modalContent}</div>
            <div className="modal-footer">
              <button onClick={handleCopyResult} className="button button-copy">
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Notes panel
const NotesPanel = ({ notes, setNotes, loading, error }) => {
  const [editingKey, setEditingKey] = useState(null);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && editingKey !== null) handleCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingKey]);

  const handleEditClick = (key, currentItems) => {
    setEditingKey(key);
    if (Array.isArray(currentItems)) {
      setEditText(currentItems.map((item) => item.text).join("\n"));
    } else {
      setEditText(currentItems?.replace(/\\n/g, "\n") || "");
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditText("");
  };

  const handleSave = () => {
    if (editingKey === null) return;
    const originalItems = notes[editingKey];
    let newItems;
    if (
      Array.isArray(originalItems) &&
      originalItems.every((i) => typeof i === "object" && "text" in i)
    ) {
      newItems = editText
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => ({ text: line.trim() }));
    } else {
      newItems = editText;
    }
    setNotes({ ...notes, [editingKey]: newItems });
    handleCancel();
  };

  const handleCopy = () => {
    if (!notes) return;
    const noteString = Object.entries(notes)
      .map(([section, items]) => {
        const sectionTitle = section.replace(/([A-Z])/g, " $1").trim();
        let content = "";
        if (typeof items === "string") {
          content = items.replace(/\\n/g, "\n");
        } else if (Array.isArray(items) && items.length > 0) {
          content = items.map((item) => `- ${item.text}`).join("\n");
        }
        return `${sectionTitle}:\n${content}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(noteString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (loading)
      return (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Generating initial note...</p>
        </div>
      );
    if (error) return <div className="error-box">{error}</div>;
    if (notes) {
      return (
        <ul className="notes-list">
          {Object.entries(notes).map(([section, items]) => {
            if (!items || (Array.isArray(items) && items.length === 0))
              return null;
            const isEditing = editingKey === section;
            const isAssessmentPlan =
              section === "Assessment and Plan" && typeof items === "string";
            const isNarrative = typeof items === "string";
            return (
              <li key={section} className="notes-list-item">
                <strong>{section.replace(/([A-Z])/g, " $1").trim()}:</strong>
                {isEditing ? (
                  <div className="note-edit-container">
                    <textarea
                      className="note-editor"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={
                        Array.isArray(items)
                          ? Math.max(3, items.length)
                          : 8
                      }
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button onClick={handleSave} className="button button-save">
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="button button-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="editable-section"
                    onClick={() => handleEditClick(section, items)}
                  >
                    <EditPencilIcon />
                    {isNarrative && items === "None" ? (
                      <p className="narrative-text none-text">{items}</p>
                    ) : isNarrative && isAssessmentPlan ? (
                      <div className="assessment-plan">
                        {items
                          .split("\n")
                          .map((line, index) =>
                            line.trim() ? <p key={index}>{line.trim()}</p> : null
                          )}
                      </div>
                    ) : isNarrative ? (
                      <p className="narrative-text">{items}</p>
                    ) : (
                      <ul className="notes-sublist">
                        {items.map((item, index) => (
                          <li key={index}>{item.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <p className="placeholder-text">
        Select a language and click "Start Session" to begin.
      </p>
    );
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Clinical Note</h2>
        {notes && (
          <button onClick={handleCopy} className="button button-copy">
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
      <div className="notes-content">{renderContent()}</div>
      <CommandBar notes={notes} setNotes={setNotes} />
    </div>
  );
};

export default function MedicalScribeApp() {
  // Session and connection state
  const [sessionState, setSessionState] = useState("idle");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  // Transcription state
  const [transcriptSegments, setTranscriptSegments] = useState(new Map());
  const [interimTranscript, setInterimTranscript] = useState("");
  const [interimSpeaker, setInterimSpeaker] = useState(null);

  // Notes state
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Language dropdown (controls backend behavior)
  // If zh-HK or zh-TW selected: that Chinese is primary, English backup.
  // If en-US selected: English primary, Cantonese backup (handled by backend).
  const [language, setLanguage] = useState("en-US");
  // Speaker roles
  const [speakerRoles, setSpeakerRoles] = useState(() => {
    try {
      const savedRoles = localStorage.getItem("scribe-speaker-roles");
      return savedRoles ? JSON.parse(savedRoles) : {};
    } catch (e) {
      console.error("Failed to parse speaker roles from localStorage", e);
      return {};
    }
  });

  // Hints and refs
  const [showSpeakerHint, setShowSpeakerHint] = useState(false);
  const hasShownHintRef = useRef(false);
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const sessionStateRef = useRef(sessionState);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptSegments, interimTranscript]);

  useEffect(() => {
    try {
      localStorage.setItem("scribe-speaker-roles", JSON.stringify(speakerRoles));
    } catch (e) {
      console.error("Failed to save speaker roles to localStorage", e);
    }
  }, [speakerRoles]);

  useEffect(() => {
    if (showSpeakerHint) {
      const timer = setTimeout(() => setShowSpeakerHint(false), 7000);
      return () => clearTimeout(timer);
    }
  }, [showSpeakerHint]);

  // Reset app state to idle
  const resetApp = () => {
    setTranscriptSegments(new Map());
    setInterimTranscript("");
    setInterimSpeaker(null);
    setNotes(null);
    setError(null);
    setSessionState("idle");
    setConnectionStatus("disconnected");
    hasShownHintRef.current = false;
  };

  const handleSpeakerRoleToggle = (speakerId) => {
    if (!speakerId) return;
    const currentRole = speakerRoles[speakerId];
    const rolesCycle = [undefined, "Clinician", "Patient"];
    const currentIndex = rolesCycle.indexOf(currentRole);
    const nextRole = rolesCycle[(currentIndex + 1) % rolesCycle.length];
    setSpeakerRoles((prev) => ({ ...prev, [speakerId]: nextRole }));
  };

  // Start session: open WS, then start microphone on open
  const startSession = async () => {
    resetApp();
    setSessionState("connecting");
    setConnectionStatus("connecting");
    try {
      // Pass the selected language to the backend
      const wsUrl = `${BACKEND_WS_URL}?language_code=${encodeURIComponent(language)}`;
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        startMicrophone();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            !data.Transcript?.Results?.length ||
            !data.Transcript.Results[0].Alternatives?.length
          )
            return;

          const result = data.Transcript.Results[0];
          const alternative = result.Alternatives[0];
          const transcriptText = alternative.Transcript;
          const firstWord = alternative.Items?.find(
            (item) => item.Type === "pronunciation"
          );
          const currentSpeaker = firstWord ? firstWord.Speaker : null;

          if (result.IsPartial) {
            setInterimTranscript(transcriptText);
            setInterimSpeaker(currentSpeaker);
          } else {
            if (currentSpeaker && !hasShownHintRef.current) {
              setShowSpeakerHint(true);
              hasShownHintRef.current = true;
            }
            const finalSegment = {
              id: result.ResultId,
              speaker: currentSpeaker,
              text: transcriptText,
              entities: data.ComprehendEntities || [],
              translatedText: data.TranslatedText || null,
              displayText: data.DisplayText || transcriptText,
            };
            setTranscriptSegments((prev) =>
              new Map(prev).set(result.ResultId, finalSegment)
            );
            setInterimTranscript("");
            setInterimSpeaker(null);
          }
        } catch (e) {
          console.error("Error processing transcript message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setError("Connection to the transcription service failed.");
        setConnectionStatus("error");
        stopSession(false);
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
      };
    } catch (err) {
      setError("Could not connect to backend. Is it running?");
      setConnectionStatus("error");
      setSessionState("idle");
    }
  };

  // Start microphone capture and worklet
  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;

      await context.audioWorklet.addModule("/audio-processor.js");

      const source = context.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(
        context,
        "audio-downsampler-processor"
      );
      audioWorkletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (
          sessionStateRef.current === "recording" &&
          websocketRef.current?.readyState === WebSocket.OPEN
        ) {
          websocketRef.current.send(
            to16BitPCM(new Float32Array(event.data))
          );
        }
      };

      source.connect(workletNode);
      setSessionState("recording");
    } catch (err) {
      console.error("Microphone Error:", err);
      setError("Could not access microphone. Please check browser permissions.");
      setConnectionStatus("error");
      stopSession(false);
    }
  };

  const handlePause = () => setSessionState("paused");
  const handleResume = () => setSessionState("recording");

  const stopSession = (closeSocket = true) => {
    if (sessionStateRef.current === "stopped" || sessionStateRef.current === "idle")
      return;
    setSessionState("stopped");
    microphoneStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== "closed")
      audioContextRef.current?.close();
    if (closeSocket && websocketRef.current?.readyState === WebSocket.OPEN)
      websocketRef.current?.close();
  };

  const to16BitPCM = (input) => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  const handleGenerateNote = async () => {
    let transcriptWithRoles = "";
    Array.from(transcriptSegments.values()).forEach((seg) => {
      transcriptWithRoles += `[${getFriendlySpeakerLabel(
        seg.speaker,
        speakerRoles
      )}]: ${seg.displayText}\n`;
    });
    if (!transcriptWithRoles.trim()) {
      setError("Transcript is empty. Nothing to generate.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotes(null);
    try {
      const resp = await fetch(`${BACKEND_API_URL}/generate-final-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_transcript: transcriptWithRoles }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "An unknown server error occurred.");
      setNotes(data.notes);
    } catch (err) {
      setError(`Failed to generate final note: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Status display
  const getStatusDisplay = () => {
    if (connectionStatus === "error")
      return <span className="status-text status-error">Connection Error</span>;
    switch (sessionState) {
      case "recording":
        return (
          <>
            <div className="recording-indicator"></div>{" "}
            <span className="status-text">Recording</span>
          </>
        );
      case "paused":
        return (
          <>
            <div className="recording-indicator paused"></div>{" "}
            <span className="status-text">Paused</span>
          </>
        );
      case "stopped":
        return <span className="status-text">Session Ended</span>;
      case "connecting":
        return <span className="status-text">Connecting...</span>;
      default:
        return <span className="status-text">Ready</span>;
    }
  };

  // Action buttons
  const renderActionButtons = () => {
    const primaryButton = () => {
      switch (sessionState) {
        case "idle":
        case "stopped":
          return (
            <button onClick={startSession} className="button button-primary">
              {sessionState === "idle" ? "Start Session" : "New Session"}
            </button>
          );
        case "recording":
          return (
            <button onClick={handlePause} className="button button-primary">
              Pause
            </button>
          );
        case "paused":
          return (
            <button onClick={handleResume} className="button button-primary">
              Resume
            </button>
          );
        case "connecting":
          return (
            <button className="button button-primary" disabled>
              Connecting...
            </button>
          );
        default:
          return null;
      }
    };
    return (
      <div className="action-buttons">
        {primaryButton()}
        {(sessionState === "recording" || sessionState === "paused") && (
          <button onClick={() => stopSession()} className="button button-secondary">
            Stop Session
          </button>
        )}
        {sessionState === "stopped" && (
          <button
            onClick={handleGenerateNote}
            className="button button-generate"
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Note"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <img
          src="/stethoscribe.png"
          alt="StethoscribeAI Logo"
          className="logo-image"
        />
        <div className="session-controls">
          <div className="language-selector-container">
            <label htmlFor="language-select">Language</label>
            <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={!(sessionState === "idle" || sessionState === "stopped")}
            className="language-selector">

            <option value="en-US">English</option>

            <option value="zh-HK">Cantonese (粵語)</option>

            <option value="zh-TW">Mandarin (Traditional) (國語)</option>

            </select>
          </div>

          <div className="status-display">{getStatusDisplay()}</div>

          {renderActionButtons()}
        </div>
      </header>

      <main className="content-container">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Live Transcript</h2>
            {showSpeakerHint && (
              <div className="speaker-hint">
                Tip: Click a speaker label to assign a role.
              </div>
            )}
          </div>

          <div className="transcript-box">
            {transcriptSegments.size > 0 ||
            ["recording", "paused"].includes(sessionState) ? (
              <>
                {Array.from(transcriptSegments.values()).map((seg) => (
                  <TranscriptSegment
                    key={seg.id}
                    segment={seg}
                    speakerRoles={speakerRoles}
                    onSpeakerRoleToggle={handleSpeakerRoleToggle}
                  />
                ))}
                {interimTranscript && (
                  <p className="interim-transcript">
                    [{getFriendlySpeakerLabel(interimSpeaker, speakerRoles)}]:{" "}
                    {interimTranscript}
                  </p>
                )}
                <div ref={transcriptEndRef} />
              </>
            ) : (
              <p className="placeholder-text">
                Select a language and click "Start Session" to begin.
              </p>
            )}
          </div>
        </div>

        <NotesPanel notes={notes} setNotes={setNotes} loading={loading} error={error} />
      </main>
    </div>
  );
}