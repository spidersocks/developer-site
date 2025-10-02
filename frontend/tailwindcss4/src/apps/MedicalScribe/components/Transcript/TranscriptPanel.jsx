import React from 'react';
import { TranscriptSegment } from './TranscriptSegment';
import { getFriendlySpeakerLabel } from '../../utils/helpers';

export const TranscriptPanel = ({
  activeConsultation,
  transcriptEndRef,
  onSpeakerRoleToggle,
  renderActionButtons,
  getStatusDisplay,
  updateConsultation,
  activeConsultationId,
}) => {
  return (
    <>
      {activeConsultation.sessionState === "idle" && (
        <div className="in-transcript-controls">
          <div className="language-selector-container">
            <label htmlFor="language-select">Primary Language</label>
            <select
              id="language-select"
              value={activeConsultation.language}
              onChange={(e) =>
                updateConsultation(activeConsultationId, { language: e.target.value })
              }
              className="language-selector"
            >
              <option value="en-US">English</option>
              <option value="zh-HK">Cantonese (粵語)</option>
              <option value="zh-TW">Mandarin Traditional (國語)</option>
            </select>
          </div>
          {renderActionButtons()}
        </div>
      )}
      {activeConsultation.sessionState !== "idle" && (
        <div className="recording-controls-bar">
          <div className="status-display">{getStatusDisplay()}</div>
          {renderActionButtons()}
        </div>
      )}
      <div className="transcript-box">
        {activeConsultation.transcriptSegments.size > 0 ||
        ["recording", "paused"].includes(activeConsultation.sessionState) ? (
          <>
            {Array.from(activeConsultation.transcriptSegments.values()).map((seg) => (
              <TranscriptSegment
                key={seg.id}
                segment={seg}
                speakerRoles={activeConsultation.speakerRoles}
                onSpeakerRoleToggle={onSpeakerRoleToggle}
              />
            ))}
            {activeConsultation.interimTranscript && (
              <p className="interim-transcript">
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