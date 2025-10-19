import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { useAuth } from "./AuthGate";
import { getAssetPath } from "./utils/helpers";
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
import { LoadingAnimation } from "./components/shared/LoadingAnimation";
import './utils/debugUtils';

// Extracted components for better organization
const EmptyStateView = ({ onAddNewPatient }) => (
  <div className="panel start-screen-panel">
    <img
      src={getAssetPath("/stethoscribe_icon.png")}
      alt="StethoscribeAI Icon"
      className="start-logo"
    />
    <h2 className="start-screen-title">Select a consultation</h2>
    <p className="start-screen-subtitle">
      Choose a patient from the sidebar or add a new one
    </p>
    <button
      className="button button-primary start-button"
      onClick={onAddNewPatient}
    >
      + Add New Patient
    </button>
  </div>
);

const WelcomeScreen = ({ onAddNewPatient }) => (
  <div className="panel start-screen-panel">
    <img
      src={getAssetPath("/stethoscribe_icon.png")}
      alt="StethoscribeAI Icon"
      className="start-logo"
    />
    <h2 className="start-screen-title">Welcome to StethoscribeAI</h2>
    <p className="start-screen-subtitle">
      Add your first patient to get started
    </p>
    <button
      className="button button-primary start-button"
      onClick={onAddNewPatient}
    >
      + Add New Patient
    </button>
  </div>
);

const HydrationErrorOverlay = ({ error, onRetry }) => (
  <div className="hydration-error-overlay">
    <div className="hydration-error-content">
      <h3>Data Sync Error</h3>
      <p>There was a problem syncing your data: {error}</p>
      <button onClick={onRetry} className="button button-primary">
        Retry
      </button>
    </div>
  </div>
);

const SyncStatusIndicator = ({ status }) => {
  if (!ENABLE_BACKGROUND_SYNC) return null;
  
  let statusText = "Not synced";
  let statusClass = "sync-status-neutral";
  
  if (status.isSyncing) {
    statusText = "Syncing...";
    statusClass = "sync-status-syncing";
  } else if (status.error) {
    statusText = `Sync error: ${status.error}`;
    statusClass = "sync-status-error";
  } else if (status.lastSynced) {
    const date = new Date(status.lastSynced);
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

export default function MedicalScribeApp() {
  const { user, signOut } = useAuth();
  const ownerUserId = user?.attributes?.sub ?? user?.username ?? user?.userId ?? null;

  // Core application state
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
    ensureSegmentsLoaded, // NEW
  } = useConsultations(ownerUserId);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSynced: null,
    error: null
  });

  // Refs
  const transcriptEndRef = useRef(null);
  
  // Audio recording control
  const {
    startSession,
    stopSession,
    handlePause,
    handleResume,
    handleGenerateNote,
    debugTranscriptSegments,
    syncAllTranscriptSegments, // Using the new function
  } = useAudioRecording(
    activeConsultation,
    activeConsultationId,
    updateConsultation,
    resetConsultation,
    setConsultations,
    finalizeConsultationTimestamp
  );

  // Force sync of all data
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

  // Handle sign out with sync
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
        console.error("[MedicalScribeApp] Final sync before sign-out failed:", error);
        setSyncStatus({ 
          isSyncing: false, 
          lastSynced: null,
          error: error.message 
        });
      }
    }
    await signOut();
  };

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    activeConsultation?.transcriptSegments,
    activeConsultation?.interimTranscript,
  ]);

  // Handle page unload sync
  useEffect(() => {
    if (!ENABLE_BACKGROUND_SYNC) return;
  
    const handleBeforeUnload = () => {
      syncService.flushAll("page-unload");
      return null;
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!activeConsultationId || !activeConsultation) return;
    if (activeConsultation.activeTab === "transcript") {
      // Quick load then enrich in background
      ensureSegmentsLoaded(activeConsultationId, true);
    } else {
      // Quick load without highlights (cache-only expansion)
      ensureSegmentsLoaded(activeConsultationId, false);
    }
  }, [activeConsultationId, activeConsultation?.activeTab, ensureSegmentsLoaded]);

  // Set up regular background sync
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
        console.error(`[MedicalScribeApp] Background sync flush failed (${reason}):`, error);
        if (!isUnmounted) {
          setSyncStatus({ 
            isSyncing: false, 
            lastSynced: null,
            error: error.message 
          });
        }
      }
    };

    const intervalId = window.setInterval(() => flush("interval"), FLUSH_INTERVAL_MS);
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

  // User interaction handlers
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

    // If switching to transcript, ensure highlights are loaded
    if (tab === "transcript" && activeConsultationId) {
      ensureSegmentsLoaded(activeConsultationId, true);
    }
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

  // Debugging function that now syncs ALL transcript segments
  const triggerTranscriptTest = () => {
    console.info("Triggering transcript segments sync test...");
    
    if (!activeConsultation) {
      console.warn("No active consultation to test!");
      return;
    }
    
    console.info(`Attempting to sync ALL segments for consultation: ${activeConsultationId}`);
    
    // Use syncAllTranscriptSegments to sync ALL existing segments
    const result = syncAllTranscriptSegments();
    
    console.info("Full transcript sync completed", result);
    
    // Force sync flush to check for any errors
    console.info("Forcing sync flush to check for errors...");
    syncService.flushAll("debug").then(() => {
      console.info("Sync flush completed successfully");
    }).catch(err => {
      console.error("Sync flush failed:", err);
    });
  };

  // Status display helper
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

  // Action buttons generator
  const renderActionButtons = () => {
    if (!activeConsultation) return null;
    
    // Primary action button based on state
    const renderPrimaryButton = () => {
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
        {renderPrimaryButton()}
        
        {/* Stop session button */}
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

  // Tab content renderer
  const renderTabContent = () => {
    if (!activeConsultation) return null;

    switch (activeConsultation.activeTab) {
      case "transcript":
        return (
          <TranscriptPanel
            activeConsultation={activeConsultation}
            transcriptEndRef={transcriptEndRef}
            onSpeakerRoleToggle={handleSpeakerRoleToggle}
            renderActionButtons={renderActionButtons}
            getStatusDisplay={getStatusDisplay}
            updateConsultation={updateConsultation}
            activeConsultationId={activeConsultationId}
          />
        );
      case "patient":
        return (
          <PatientInfoPanel
            activeConsultation={activeConsultation}
            updateConsultation={updateConsultation}
            activeConsultationId={activeConsultationId}
            onRegenerateNote={handleGenerateNote}
          />
        );
      case "note":
        return (
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
                transcriptSegments={activeConsultation.transcriptSegments}
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
        );
      default:
        return null;
    }
  };

  // Main render
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
      
      <SyncStatusIndicator status={syncStatus} />

      <div className="app-main">
        <button
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon />
        </button>

        {hydrationState?.status === "error" && (
          <HydrationErrorOverlay 
            error={hydrationState.error}
            onRetry={forceHydrate}
          />
        )}

        <main className="workspace">
          {consultations.length === 0 && patients.length === 0 ? (
            <WelcomeScreen onAddNewPatient={() => setShowNewPatientModal(true)} />
          ) : activeConsultation ? (
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
                      activeConsultation.activeTab === "transcript" ? "active" : ""
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
                
                {hydrationState?.status === "loading" && (
                  <div className="hydration-loading-indicator">
                    <div className="loading-spinner"></div>
                    <span>{hydrationState.message || "Loading data..."}</span>
                  </div>
                )}
              </div>

              <div className="tab-content">
                {renderTabContent()}
              </div>
            </div>
          ) : (
            <EmptyStateView onAddNewPatient={() => setShowNewPatientModal(true)} />
          )}
        </main>
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