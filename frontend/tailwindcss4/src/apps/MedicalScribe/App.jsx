import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { getAssetPath, hasPatientProfileContent, generatePatientName } from "./utils/helpers";
import { PencilIcon, MenuIcon, CloseIcon } from "./components/shared/Icons";
import { useConsultations } from "./hooks/useConsultations";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { TranscriptPanel } from "./components/Transcript/TranscriptPanel";
import { PatientInfoPanel } from "./components/Patient/PatientInfoPanel";
import { NoteEditor } from "./components/Notes/NoteEditor";
import { CommandBar } from "./components/Notes/CommandBar";

export default function MedicalScribeApp() {
  const {
    consultations,
    activeConsultation,
    activeConsultationId,
    setActiveConsultationId,
    addNewConsultation,
    updateConsultation,
    resetConsultation,
    setConsultations,
  } = useConsultations();

  const [editingConsultationId, setEditingConsultationId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const transcriptEndRef = useRef(null);

  const {
    startSession,
    stopSession,
    handlePause,
    handleResume,
    handleGenerateNote,
  } = useAudioRecording(
    activeConsultation,
    activeConsultationId,
    updateConsultation,
    resetConsultation,
    setConsultations
  );

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConsultation?.transcriptSegments, activeConsultation?.interimTranscript]);

  const handleRenameConsultation = (id, newName) => {
    updateConsultation(id, { name: newName, customNameSet: true });
    setEditingConsultationId(null);
    setEditingName("");
  };

  const handleEditClick = (consultationId, currentName) => {
    setEditingConsultationId(consultationId);
    setEditingName(currentName);
  };

  const handleTabChange = (tab) => {
    if (!activeConsultation) return;
    
    if (
      activeConsultation.activeTab === "patient" &&
      tab !== "patient" &&
      !activeConsultation.customNameSet &&
      hasPatientProfileContent(activeConsultation.patientProfile)
    ) {
      const generatedName = generatePatientName(activeConsultation.patientProfile);
      if (generatedName) {
        updateConsultation(activeConsultationId, { name: generatedName, activeTab: tab });
        return;
      }
    }
    
    updateConsultation(activeConsultationId, { activeTab: tab });
  };

  const handleSpeakerRoleToggle = (speakerId) => {
    if (!speakerId || !activeConsultation) return;
    const currentRole = activeConsultation.speakerRoles[speakerId];
    const cycle = [undefined, "Clinician", "Patient"];
    const nextRole = cycle[(cycle.indexOf(currentRole) + 1) % cycle.length];
    updateConsultation(activeConsultationId, {
      speakerRoles: { ...activeConsultation.speakerRoles, [speakerId]: nextRole },
    });
  };

  const handleNoteTypeChange = (newNoteType) => {
    if (!activeConsultation) return;
    updateConsultation(activeConsultationId, { noteType: newNoteType });
  };

  const handleStopAndGenerate = async () => {
    await stopSession();
    if (activeConsultation && activeConsultation.transcriptSegments.size > 0) {
      handleGenerateNote();
    }
  };

  const getStatusDisplay = () => {
    if (!activeConsultation) return null;
    if (activeConsultation.connectionStatus === "error")
      return <span className="status-text status-error">Connection Error</span>;
    switch (activeConsultation.sessionState) {
      case "recording":
        return (
          <>
            <div className="recording-indicator"></div> <span className="status-text">Recording</span>
          </>
        );
      case "paused":
        return (
          <>
            <div className="recording-indicator paused"></div> <span className="status-text">Paused</span>
          </>
        );
      case "stopped":
        return <span className="status-text">Recording Ended</span>;
      case "connecting":
        return <span className="status-text">Connecting...</span>;
      default:
        return <span className="status-text">Ready</span>;
    }
  };

  const renderActionButtons = () => {
    if (!activeConsultation) return null;
    const primary = () => {
      switch (activeConsultation.sessionState) {
        case "idle":
        case "stopped":
          return (
            <button onClick={startSession} className="button button-primary">
              {activeConsultation.sessionState === "idle" ? "Start Recording" : "New Recording"}
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
        {primary()}
        {(activeConsultation.sessionState === "recording" ||
          activeConsultation.sessionState === "paused") && (
          <button onClick={handleStopAndGenerate} className="button button-secondary">
            Stop Session
          </button>
        )}
      </div>
    );
  };

  const hasPatientInfo = activeConsultation ? hasPatientProfileContent(activeConsultation.patientProfile) : false;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Primary">
        <button className="mobile-sidebar-close" onClick={() => setSidebarOpen(false)}>
          <CloseIcon />
        </button>
        <div className="sidebar-brand">
          <img
            src={getAssetPath("/stethoscribe.png")}
            alt="StethoscribeAI"
            className="sidebar-logo"
          />
        </div>

        {consultations.length === 0 ? (
          <div className="sidebar-empty centered">
            <div className="empty-title subtle">No consultations yet</div>
            <div className="empty-sub">Create your first consultation to get started</div>
          </div>
        ) : (
          <nav className="sidebar-nav">
            {consultations.map((consultation) => (
              <div key={consultation.id} className="sidebar-link-wrapper">
                {editingConsultationId === consultation.id ? (
                  <input
                    type="text"
                    className="sidebar-rename-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRenameConsultation(consultation.id, editingName)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameConsultation(consultation.id, editingName);
                      if (e.key === "Escape") {
                        setEditingConsultationId(null);
                        setEditingName("");
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <>
                    <a
                      className={`sidebar-link ${
                        activeConsultationId === consultation.id ? "active" : ""
                      }`}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveConsultationId(consultation.id);
                        setSidebarOpen(false);
                      }}
                      onDoubleClick={() => handleEditClick(consultation.id, consultation.name)}
                    >
                      {consultation.name}
                    </a>
                    <div 
                      className="edit-icon-wrapper"
                      onClick={() => handleEditClick(consultation.id, consultation.name)}
                    >
                      <PencilIcon />
                    </div>
                  </>
                )}
              </div>
            ))}
            <button className="add-consultation-button" onClick={() => {
              addNewConsultation();
              setSidebarOpen(false);
            }}>
              + Add Consultation
            </button>
          </nav>
        )}

        <div className="sidebar-footer">
          <div className="user-block">
            <div className="avatar" aria-hidden="true">
              D
            </div>
            <div className="user-info">
              <div className="user-name">demoUser</div>
              <button className="manage-settings">Placeholder</button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)}>
          <MenuIcon />
        </button>

        {consultations.length === 0 ? (
          <main className="workspace">
            <div className="panel start-screen-panel">
              <img
                src={getAssetPath("/stethoscribe_icon.png")}
                alt="StethoscribeAI Icon"
                className="start-logo"
              />
              <button className="button button-primary start-button" onClick={addNewConsultation}>
                New Consultation +
              </button>
            </div>
          </main>
        ) : activeConsultation ? (
          <main className="workspace">
            <div className="panel">
              <div className="panel-header-sticky">
                <div className="tabs-container">
                  <button
                    className={`tab-link ${activeConsultation.activeTab === "transcript" ? "active" : ""}`}
                    onClick={() => handleTabChange("transcript")}
                  >
                    Live Transcript
                  </button>
                  {hasPatientInfo && (
                    <button
                      className={`tab-link ${activeConsultation.activeTab === "patient" ? "active" : ""}`}
                      onClick={() => handleTabChange("patient")}
                    >
                      Patient Information
                    </button>
                  )}
                  <button
                    className={`tab-link ${activeConsultation.activeTab === "note" ? "active" : ""}`}
                    onClick={() => handleTabChange("note")}
                  >
                    Clinical Note
                  </button>
                  {!hasPatientInfo && (
                    <button
                      className={`tab-link add-patient-tab ${activeConsultation.activeTab === "patient" ? "active" : ""}`}
                      onClick={() => handleTabChange("patient")}
                    >
                      + Patient Information
                    </button>
                  )}
                </div>
              </div>

              <div className="tab-content">
                {activeConsultation.activeTab === "transcript" ? (
                  <TranscriptPanel
                    activeConsultation={activeConsultation}
                    transcriptEndRef={transcriptEndRef}
                    onSpeakerRoleToggle={handleSpeakerRoleToggle}
                    renderActionButtons={renderActionButtons}
                    getStatusDisplay={getStatusDisplay}
                    updateConsultation={updateConsultation}
                    activeConsultationId={activeConsultationId}
                  />
                ) : activeConsultation.activeTab === "patient" ? (
                  <PatientInfoPanel
                    activeConsultation={activeConsultation}
                    updateConsultation={updateConsultation}
                    activeConsultationId={activeConsultationId}
                  />
                ) : (
                  <>
                    <div className="notes-content">
                      <NoteEditor
                        notes={activeConsultation.notes}
                        setNotes={(newNotes) =>
                          updateConsultation(activeConsultationId, { notes: newNotes })
                        }
                        loading={activeConsultation.loading}
                        error={activeConsultation.error}
                        noteType={activeConsultation.noteType}
                        onNoteTypeChange={handleNoteTypeChange}
                        onRegenerate={handleGenerateNote}
                        transcriptSegments={activeConsultation.transcriptSegments}
                      />
                    </div>
                    <CommandBar
                      notes={activeConsultation.notes}
                      setNotes={(newNotes) =>
                        updateConsultation(activeConsultationId, { notes: newNotes })
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </main>
        ) : null}
      </div>
    </div>
  );
}