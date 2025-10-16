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
// Import debug utility
import './utils/debugUtils';

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
    hydrationState,
    forceHydrate,
  } = useConsultations(ownerUserId);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSynced: null,
    error: null
  });

  const transcriptEndRef = useRef(null);
  console.info("[App] ENABLE_BACKGROUND_SYNC =", ENABLE_BACKGROUND_SYNC);
  console.info("[App] ownerUserId =", ownerUserId);

  // Function to ensure all transcript data is synced
  const ensureSyncComplete = async () => {
    if (!ENABLE_BACKGROUND_SYNC) return;
    
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    console.info("[App] Forcing sync flush to ensure data persistence");
    
    try {
      await syncService.flushAll("manual-trigger");
      setSyncStatus({ 
        isSyncing: false, 
        lastSynced: new Date().toISOString(),
        error: null 
      });
      console.info("[App] Sync flush completed successfully");
    } catch (error) {
      setSyncStatus({ 
        isSyncing: false, 
        lastSynced: null,
        error: error.message
      });
      console.error("[App] Error during manual sync flush:", error);
    }
  };

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
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));
      try {
        await syncService.flushAll("sign-out");
        setSyncStatus({ 
          isSyncing: false, 
          lastSynced: new Date().toISOString(),
          error: null 
        });
      } catch (error) {
        console.error(
          "[MedicalScribeApp] Final sync before sign-out failed:",
          error
        );
        setSyncStatus({ 
          isSyncing: false, 
          lastSynced: null,
          error: error.message 
        });
      }
    }

    await signOut();
  };

  // Auto-scroll transcript to bottom when new content arrives
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    activeConsultation?.transcriptSegments,
    activeConsultation?.interimTranscript,
  ]);

  useEffect(() => {
  if (!ENABLE_BACKGROUND_SYNC) return;
  
  const handleBeforeUnload = () => {
    // This is a synchronous operation that runs before page unload
    syncService.flushAll("page-unload");
    return null; // No confirmation dialog
  };
  
  window.addEventListener("beforeunload", handleBeforeUnload);
  
  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, []);

  // Handle page unload and sync event listeners
  useEffect(() => {
    if (!ENABLE_BACKGROUND_SYNC) return undefined;

    let isUnmounted = false;
    const FLUSH_INTERVAL_MS = 4000;

    const flush = async (reason) => {
      if (isUnmounted) return;
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));
      try {
        await syncService.flushAll(reason);
        if (!isUnmounted) {
          setSyncStatus({ 
            isSyncing: false, 
            lastSynced: new Date().toISOString(),
            error: null 
          });
        }
      } catch (error) {
        console.error(
          `[MedicalScribeApp] Background sync flush failed (${reason}):`,
          error
        );
        if (!isUnmounted) {
          setSyncStatus({ 
            isSyncing: false, 
            lastSynced: null,
            error: error.message 
          });
        }
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
    
    // Critical - handle page unload to ensure data is preserved
    const handleBeforeUnload = () => {
      // This is synchronous and runs before the page unloads
      syncService.flushAll("page-unload");
      return null; // No confirmation dialog
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);

    flush("mount");

    return () => {
      isUnmounted = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBeforeUnload);
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
    
    // Force sync transcript data before generating note
    if (ENABLE_BACKGROUND_SYNC) {
      await ensureSyncComplete();
    }
    
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
        
        {/* Force sync button */}
        {ENABLE_BACKGROUND_SYNC && activeConsultation.sessionState === "recording" && (
          <button 
            onClick={ensureSyncComplete}
            className="button button-secondary" 
            disabled={syncStatus.isSyncing}
            title="Force sync transcript to database"
          >
            {syncStatus.isSyncing ? "Syncing..." : "Force Sync"}
          </button>
        )}
      </div>
    );
  };

  // Render sync status indicator
  const renderSyncStatus = () => {
    if (!ENABLE_BACKGROUND_SYNC) return null;
    
    let statusText = "Not synced";
    let statusClass = "sync-status-neutral";
    
    if (syncStatus.isSyncing) {
      statusText = "Syncing...";
      statusClass = "sync-status-syncing";
    } else if (syncStatus.error) {
      statusText = `Sync error: ${syncStatus.error}`;
      statusClass = "sync-status-error";
    } else if (syncStatus.lastSynced) {
      const date = new Date(syncStatus.lastSynced);
      statusText = `Last synced: ${date.toLocaleTimeString()}`;
      statusClass = "sync-status-success";
    }
    
    return (
      <div className={`sync-status-indicator ${statusClass}`}>
        <span className="sync-status-dot"></span>
        <span className="sync-status-text">{statusText}</span>
      </div>
    );
  };
  
  const hasPatientInfo = activeConsultation
    ? hasPatientProfileContent(activeConsultation.patientProfile)
    : false;

  // Handle hydration error state
  const handleRetryHydration = () => {
    if (forceHydrate) {
      forceHydrate();
    }
  };

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
      
      {/* Sync status indicator */}
      {ENABLE_BACKGROUND_SYNC && renderSyncStatus()}

      <div className="app-main">
        <button
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon />
        </button>

        {/* Hydration error state */}
        {hydrationState?.status === "error" && (
          <div className="hydration-error-overlay">
            <div className="hydration-error-content">
              <h3>Data Sync Error</h3>
              <p>There was a problem syncing your data: {hydrationState.error}</p>
              <button onClick={handleRetryHydration} className="button button-primary">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main content rendering logic */}
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
                
                {/* Loading indicator during hydration */}
                {hydrationState?.status === "loading" && (
                  <div className="hydration-loading-indicator">
                    <div className="loading-spinner"></div>
                    <span>{hydrationState.message || "Loading data..."}</span>
                  </div>
                )}
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