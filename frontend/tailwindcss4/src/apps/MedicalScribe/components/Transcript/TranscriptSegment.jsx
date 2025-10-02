import React from 'react';
import { getFriendlySpeakerLabel } from '../../utils/helpers';
import { HighlightedText } from './HighlightedText';

export const TranscriptSegment = React.memo(({ segment, speakerRoles, onSpeakerRoleToggle }) => {
  const isEnglishSession = !segment.translatedText;
  const speakerLabel = getFriendlySpeakerLabel(segment.speaker, speakerRoles);
  
  return (
    <div className="transcript-segment-container">
      <p className={isEnglishSession ? "english-only-transcript" : "original-transcript-text"}>
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
          <HighlightedText text={segment.translatedText} entities={segment.entities} />
        </p>
      )}
    </div>
  );
});