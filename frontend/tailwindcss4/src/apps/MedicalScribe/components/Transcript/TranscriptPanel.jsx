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
  showLanguageSelector = true,
}) => {
  const noSegmentsYet = activeConsultation.transcriptSegments.size === 0;
  const isIdleOrStopped = ["idle", "stopped"].includes(activeConsultation.sessionState);

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
        {noSegmentsYet && isIdleOrStopped ? (
          <LoadingAnimation message="Loading transcript..." />
        ) : activeConsultation.transcriptSegments.size > 0 ||
          ["recording", "paused"].includes(activeConsultation.sessionState) ? (
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