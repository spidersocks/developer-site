import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { useAuth } from "./AuthGate";
import { getAssetPath, hasPatientProfileContent } from "./utils/helpers";
import { MenuIcon } from "./components/shared/Icons";
import { useConsultations } from "./hooks/useConsultations";
import { useAudioRecording } from "./hooks/useAudioRecording";
import { TranscriptPanel } from "./components/Transcript/TranscriptPanel";
import { PatientInfoPanel } from "./components/Patient/PatientInfoPanel";
import { NewPatientModal } from "./components/Patient/NewPatientModal";
import { NoteEditor } from "./components/Notes/NoteEditor";
import { CommandBar } from "./components/Notes/CommandBar";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ENABLE_BACKGROUND_SYNC } from "./utils/constants";
import { syncService } from "./utils/syncService";

export default function MedicalScribeApp() {
  const { user, signOut } = useAuth();

  const ownerUserId =
    user?.attributes?.sub ?? user?.username ?? user?.userId ?? null;

  const {
    consultations,
    patients,
    activeConsultation,
    activeConsultationId,
    setActiveConsultationId,
    addNewPatient,
    addConsultationForPatient,
    updateConsultation,
    deleteConsultation,
    deletePatient,
    resetConsultation,
    finalizeConsultationTimestamp,
    setConsultations,
  } = useConsultations(ownerUserId);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  const transcriptEndRef = useRef(null);
  console.info("[App] ENABLE_BACKGROUND_SYNC =", ENABLE_BACKGROUND_SYNC);
  console.info("[App] ownerUserId =", ownerUserId);

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
    setConsultations,
    finalizeConsultationTimestamp
  );

  const handleSignOut = async () => {
    if (ENABLE_BACKGROUND_SYNC) {
      try {
        await syncService.flushAll();
      } catch (error) {
        console.error(
          "[MedicalScribeApp] Final sync before sign-out failed:",
          error
        );
      }
    }

    await signOut();
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    activeConsultation?.transcriptSegments,
    activeConsultation?.interimTranscript,
  ]);

  useEffect(() => {
    if (!ENABLE_BACKGROUND_SYNC) return undefined;

    let isUnmounted = false;
    const FLUSH_INTERVAL_MS = 4000;

    const flush = async (reason) => {
      if (isUnmounted) return;
      try {
        await syncService.flushAll();
      } catch (error) {
        console.error(
          `[MedicalScribeApp] Background sync flush failed (${reason}):`,
          error
        );
      }
    };

    const intervalId = window.setInterval(
      () => flush("interval"),
      FLUSH_INTERVAL_MS
    );

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        flush("visibilitychange");
      }
    };

    const handleOnline = () => flush("online");
    const handleFocus = () => flush("focus");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    flush("mount");

    return () => {
      isUnmounted = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleRenameConsultation = (id, newName) => {
    updateConsultation(id, { name: newName, customNameSet: true });
  };

  const handleDeleteConsultation = (id) => {
    deleteConsultation(id);
  };

  const handleDeletePatient = (patientId) => {
    deletePatient(patientId);
  };

  const handleTabChange = (tab) => {
    if (!activeConsultation) return;
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

  const handleAddNewPatient = (patientData) => {
    addNewPatient(patientData);
    setShowNewPatientModal(false);
    setSidebarOpen(false);
  };

  const getStatusDisplay = () => {
    if (!activeConsultation) return null;
    if (activeConsultation.connectionStatus === "error")
      return <span className="status-text status-error">Connection Error</span>;
    switch (activeConsultation.sessionState) {
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
              {activeConsultation.sessionState === "idle"
                ? "Start Recording"
                : "New Recording"}
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
          <button
            onClick={handleStopAndGenerate}
            className="button button-secondary"
          >
            Stop Session
          </button>
        )}
      </div>
    );
  };

  const hasPatientInfo = activeConsultation
    ? hasPatientProfileContent(activeConsultation.patientProfile)
    : false;

  return (
    <div className="app-shell">
      <Sidebar
        consultations={consultations}
        patients={patients}
        activeConsultationId={activeConsultationId}
        onConsultationSelect={setActiveConsultationId}
        onAddConsultationForPatient={addConsultationForPatient}
        onAddNewPatient={() => setShowNewPatientModal(true)}
        onRenameConsultation={handleRenameConsultation}
        onDeleteConsultation={handleDeleteConsultation}
        onDeletePatient={handleDeletePatient}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <button
        type="button"
        className="global-signout-button"
        onClick={handleSignOut}
        aria-label="Sign out of StethoscribeAI"
      >
        Sign out
      </button>

      <div className="app-main">
        <button
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon />
        </button>

        {consultations.length === 0 && patients.length === 0 ? (
          <main className="workspace">
            <div className="panel start-screen-panel">
              <img
                src={getAssetPath("/stethoscribe_icon.png")}
                alt="StethoscribeAI Icon"
                className="start-logo"
              />
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "var(--text-primary)",
                }}
              >
                Welcome to StethoscribeAI
              </h2>
              <p
                style={{
                  fontSize: "1rem",
                  color: "var(--text-secondary)",
                  marginBottom: "2rem",
                  textAlign: "center",
                  maxWidth: "400px",
                }}
              >
                Add your first patient to get started
              </p>
              <button
                className="button button-primary start-button"
                onClick={() => setShowNewPatientModal(true)}
              >
                + Add New Patient
              </button>
            </div>
          </main>
        ) : activeConsultation ? (
          <main className="workspace">
            <div className="panel">
              <div className="panel-header-sticky">
                <div className="tabs-container">
                  <button
                    className={`tab-link ${
                      activeConsultation.activeTab === "patient" ? "active" : ""
                    }`}
                    onClick={() => handleTabChange("patient")}
                  >
                    Patient Information
                  </button>

                  <button
                    className={`tab-link ${
                      activeConsultation.activeTab === "transcript"
                        ? "active"
                        : ""
                    }`}
                    onClick={() => handleTabChange("transcript")}
                  >
                    Live Transcript
                  </button>

                  <button
                    className={`tab-link ${
                      activeConsultation.activeTab === "note" ? "active" : ""
                    }`}
                    onClick={() => handleTabChange("note")}
                  >
                    Clinical Note
                  </button>
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
                    onRegenerateNote={handleGenerateNote}
                  />
                ) : (
                  <>
                    <div className="notes-content">
                      <NoteEditor
                        notes={activeConsultation.notes}
                        setNotes={(newNotes) =>
                          updateConsultation(activeConsultationId, {
                            notes: newNotes,
                          })
                        }
                        loading={activeConsultation.loading}
                        error={activeConsultation.error}
                        noteType={activeConsultation.noteType}
                        onNoteTypeChange={handleNoteTypeChange}
                        onRegenerate={handleGenerateNote}
                        transcriptSegments={
                          activeConsultation.transcriptSegments
                        }
                      />
                    </div>
                    <CommandBar
                      notes={activeConsultation.notes}
                      setNotes={(newNotes) =>
                        updateConsultation(activeConsultationId, {
                          notes: newNotes,
                        })
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </main>
        ) : (
          <main className="workspace">
            <div className="panel start-screen-panel">
              <img
                src={getAssetPath("/stethoscribe_icon.png")}
                alt="StethoscribeAI Icon"
                className="start-logo"
              />
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "600",
                  marginBottom: "0.5rem",
                  color: "var(--text-primary)",
                }}
              >
                Select a consultation
              </h2>
              <p
                style={{
                  fontSize: "1rem",
                  color: "var(--text-secondary)",
                  marginBottom: "2rem",
                  textAlign: "center",
                  maxWidth: "400px",
                }}
              >
                Choose a patient from the sidebar or add a new one
              </p>
              <button
                className="button button-primary start-button"
                onClick={() => setShowNewPatientModal(true)}
              >
                + Add New Patient
              </button>
            </div>
          </main>
        )}
      </div>

      {showNewPatientModal && (
        <NewPatientModal
          onClose={() => setShowNewPatientModal(false)}
          onSave={handleAddNewPatient}
        />
      )}
    </div>
  );
}