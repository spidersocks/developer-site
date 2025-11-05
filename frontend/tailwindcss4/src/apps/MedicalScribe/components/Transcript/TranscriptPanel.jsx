import React, { useEffect } from "react";
import { TranscriptSegment } from "./TranscriptSegment";
import { getFriendlySpeakerLabel } from "../../utils/helpers";
import { LoadingAnimation } from "../shared/LoadingAnimation";
import styles from "./TranscriptPanel.module.css";

export const TranscriptPanel = ({
  activeConsultation,
  transcriptEndRef,
  onSpeakerRoleToggle,
  renderActionButtons,
  getStatusDisplay,
  updateConsultation,
  activeConsultationId,
  showLanguageSelector = true,
}) => {
  const noSegmentsYet = activeConsultation.transcriptSegments.size === 0;
  const isIdleOrStopped = ["idle", "stopped"].includes(activeConsultation.sessionState);
  const isActiveSession = ["recording", "paused", "connecting"].includes(
    activeConsultation.sessionState
  );

  // Show loader only when truly loading and not during an active/connecting session
  const shouldShowLoader =
    activeConsultation.transcriptLoading && !isActiveSession;

  // --- Auto speaker role heuristic: first speaker is doctor, rest patient ---
  useEffect(() => {
    if (
      !activeConsultation || 
      !activeConsultation.transcriptSegments || 
      activeConsultation.transcriptSegments.size === 0
    ) {
      return;
    }

    // Get all unique speakers from segments
    const speakers = Array.from(activeConsultation.transcriptSegments.values())
      .map(seg => seg.speaker)
      .filter(Boolean);

    const uniqueSpeakers = Array.from(new Set(speakers));
    const currentRoles = activeConsultation.speakerRoles || {};

    // Check if all unique speakers have a role already set
    // Only run the heuristic if none are set
    const anyRoleAssigned = uniqueSpeakers.some(s => !!currentRoles[s]);

    if (!anyRoleAssigned && uniqueSpeakers.length > 0) {
      // First speaker (ordered by first appearance) is doctor, rest are patient
      const newRoles = {};
      uniqueSpeakers.forEach((speaker, idx) => {
        newRoles[speaker] = idx === 0 ? 'Clinician' : 'Patient';
      });
      updateConsultation(activeConsultationId, { speakerRoles: newRoles });
    }
  }, [
    activeConsultation?.transcriptSegments,
    activeConsultation?.speakerRoles,
    activeConsultationId,
    updateConsultation
  ]);
  // --- End heuristic ---

  return (
    <>
      {activeConsultation.sessionState === "idle" && (
        <div className={styles.inTranscriptControls}>
          {showLanguageSelector && (
            <div className={styles.languageSelectorContainer}>
              <label htmlFor="language-select">Primary Language</label>
              <select
                id="language-select"
                value={activeConsultation.language}
                onChange={(e) =>
                  updateConsultation(activeConsultationId, {
                    language: e.target.value,
                  })
                }
                className={styles.languageSelector}
              >
                <option value="en-US">English</option>
                <option value="zh-HK">Cantonese (粵語)</option>
                <option value="zh-TW">Mandarin Traditional (國語)</option>
              </select>
            </div>
          )}
          {renderActionButtons()}
        </div>
      )}
      {activeConsultation.sessionState !== "idle" && (
        <div className={styles.recordingControlsBar}>
          <div className={styles.statusDisplay}>{getStatusDisplay()}</div>
          {renderActionButtons()}
        </div>
      )}
      <div className={styles.transcriptBox}>
        {shouldShowLoader ? (
          <div className={styles.loadingContainer}>
            <LoadingAnimation message="Loading transcript..." />
          </div>
        ) : noSegmentsYet && isIdleOrStopped ? (
          <div className={styles.emptyTranscript}>
            <h4>No transcript yet</h4>
            <p>Start a recording to see the live transcript here.</p>
          </div>
        ) : activeConsultation.transcriptSegments.size > 0 ||
          ["recording", "paused", "connecting"].includes(
            activeConsultation.sessionState
          ) ? (
          <>
            {Array.from(activeConsultation.transcriptSegments.values()).map(
              (seg) => (
                <TranscriptSegment
                  key={seg.id}
                  segment={seg}
                  speakerRoles={activeConsultation.speakerRoles}
                  onSpeakerRoleToggle={onSpeakerRoleToggle}
                />
              )
            )}
            {activeConsultation.interimTranscript && (
              <p className={styles.interimTranscript}>
                [
                {getFriendlySpeakerLabel(
                  activeConsultation.interimSpeaker,
                  activeConsultation.speakerRoles
                )}
                ]: {activeConsultation.interimTranscript}
              </p>
            )}
            <div ref={transcriptEndRef} />
          </>
        ) : null}
      </div>
    </>
  );
};