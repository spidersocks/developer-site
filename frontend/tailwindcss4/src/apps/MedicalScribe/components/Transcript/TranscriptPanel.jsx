import React from "react";
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
  // showLanguageSelector = true, // REMOVED, not needed anymore
}) => {
  const noSegmentsYet = activeConsultation.transcriptSegments.size === 0;
  const isIdleOrStopped = ["idle", "stopped"].includes(activeConsultation.sessionState);
  const isActiveSession = ["recording", "paused", "connecting"].includes(
    activeConsultation.sessionState
  );

  // Show loader only when truly loading and not during an active/connecting session
  const shouldShowLoader =
    activeConsultation.transcriptLoading && !isActiveSession;

  return (
    <>
      {activeConsultation.sessionState === "idle" && (
        <div className={styles.inTranscriptControls}>
          {/* Removed language selector dropdown */}
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