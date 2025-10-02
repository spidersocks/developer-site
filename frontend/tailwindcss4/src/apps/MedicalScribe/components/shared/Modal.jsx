import React from 'react';

export const NoteTypeConfirmationModal = ({ 
  show, 
  noteTypeName, 
  warning, 
  recommendedType, 
  recommendedTypeName, 
  onConfirm, 
  onCancel 
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content note-type-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚠️ Confirm Note Type</h3>
          <button className="modal-close-button" onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-warning-text">{warning}</p>
          <p className="modal-recommendation">
            <strong>Recommended:</strong> {recommendedTypeName}
          </p>
          <p className="modal-question">Continue with {noteTypeName} anyway?</p>
        </div>
        <div className="modal-footer modal-footer-buttons">
          <button onClick={onCancel} className="button button-secondary">
            Use {recommendedTypeName}
          </button>
          <button onClick={onConfirm} className="button button-primary">
            Continue with {noteTypeName}
          </button>
        </div>
      </div>
    </div>
  );
};