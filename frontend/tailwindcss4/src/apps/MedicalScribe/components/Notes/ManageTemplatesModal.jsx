import React, { useState } from "react";
import { NewNoteTemplateModal } from "./NewNoteTemplateModal";
import styles from "./ManageTemplatesModal.module.css";

export const ManageTemplatesModal = ({ onClose }) => {
  const [showNew, setShowNew] = useState(false);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <>
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className={`modal-content ${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Manage Templates</h3>
            <button className="modal-close-button" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className={styles.empty}>
              <p>No custom templates yet.</p>
              <p className={styles.subtle}>Storage and syncing will be added later.</p>
            </div>
          </div>

          <div className="modal-footer modal-footer-buttons">
            <button className="button button-secondary" onClick={() => setShowNew(true)}>
              + New Template
            </button>
            <button className="button button-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>

      {showNew && (
        <NewNoteTemplateModal
          onClose={() => setShowNew(false)}
          onSave={(payload) => {
            // No-op for now; wire this to your backend later
            console.log("[Templates] Create payload:", payload);
          }}
        />
      )}
    </>
  );
};