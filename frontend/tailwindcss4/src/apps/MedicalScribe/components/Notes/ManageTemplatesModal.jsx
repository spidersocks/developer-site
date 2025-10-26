import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthGate";
import { NewNoteTemplateModal } from "./NewNoteTemplateModal";
import styles from "./ManageTemplatesModal.module.css";
import { apiClient } from "../../utils/apiClient";
import { syncService } from "../../utils/syncService";
import { ENABLE_BACKGROUND_SYNC } from "../../utils/constants";

export const ManageTemplatesModal = ({ onClose }) => {
  const { user, accessToken, userId } = useAuth();
  // AuthGate exposes userId and accessToken in your app; if not, adapt to your shape:
  // const auth = useAuth(); const token = auth.accessToken; const ownerUserId = auth.user?.attributes?.sub || auth.userId;

  const ownerUserId = user?.attributes?.sub ?? user?.username ?? userId ?? null;
  const token = accessToken;

  const [showNew, setShowNew] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiClient.listTemplates({ token, userId: ownerUserId });
      if (res.ok && Array.isArray(res.data)) {
        setTemplates(res.data);
      } else {
        setTemplates([]);
        console.warn("[Templates] listTemplates failed", res);
      }
    } catch (err) {
      console.error("[Templates] load error", err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (payload) => {
    try {
      // Call backend create endpoint (includes owner user via query param)
      const body = {
        name: payload.name,
        sections: payload.sections,
        example_text: payload.exampleNoteText ?? "",
      };

      const res = await apiClient.createTemplate({
        token,
        userId: ownerUserId,
        payload: body,
      });

      // Only small additions: console.info before enqueue to make the UI->queue handoff visible.

  if (res.ok && res.data) {
    setTemplates((prev) => [res.data, ...prev]);

    // Also enqueue to background sync (best-effort offline behavior)
    if (ENABLE_BACKGROUND_SYNC && ownerUserId) {
      try {
        // DEBUG: log the exact object we will send to the syncService
        console.info("[Templates] enqueueTemplateUpsert payload about to be sent to syncService", {
          id: res.data.id,
          ownerUserId,
          name: res.data.name,
          sections: res.data.sections,
          example_text: res.data.example_text ?? res.data.exampleNoteText ?? ""
        });

        syncService.enqueueTemplateUpsert({
          id: res.data.id,
          ownerUserId: ownerUserId,
          name: res.data.name,
          sections: res.data.sections,
          example_text: res.data.example_text ?? res.data.exampleNoteText ?? "",
          createdAt: res.data.created_at ?? new Date().toISOString(),
          updatedAt: res.data.updated_at ?? new Date().toISOString(),
        });

        // After enqueue, show queue stats in dev console
        if (import.meta.env.DEV && window.__syncService) {
          console.info("[Templates] syncService stats after enqueue", window.__syncService.getStats());
          console.info("[Templates] syncService queue snapshot", window.__syncService.dumpQueue());
        }
      } catch (e) {
        console.warn("[Templates] enqueueTemplateUpsert failed", e);
      }
    }
  } else {
        const msg = res?.error?.message || `Failed to create template (status ${res?.status})`;
        setError(msg);
      }
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleDeleteLocal = (id) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    // enqueue deletion
    if (ENABLE_BACKGROUND_SYNC && ownerUserId) {
      syncService.enqueueTemplateDeletion(id, ownerUserId);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal-content ${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Manage Templates</h3>
            <button className="modal-close-button" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className={styles.empty}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className={styles.empty}>
                <p>No custom templates yet.</p>
                <p className={styles.subtle}>Create a template to use it when generating notes.</p>
              </div>
            ) : (
              <div className={styles.list}>
                {templates.map((t) => (
                  <div key={t.id} className={styles.templateRow}>
                    <div className={styles.templateInfo}>
                      <div className={styles.templateName}>{t.name}</div>
                      <div className={styles.templateMeta}>
                        <small>{t.sections?.length ?? 0} sections</small>
                        <small>Updated: {new Date(t.updated_at ?? t.updatedAt ?? t.updatedAt).toLocaleString()}</small>
                      </div>
                    </div>
                    <div className={styles.templateActions}>
                      <button
                        className="button button-secondary"
                        onClick={() => navigator.clipboard?.writeText(JSON.stringify(t))}
                        title="Copy template JSON"
                      >
                        Copy
                      </button>
                      <button
                        className="button button-danger"
                        onClick={() => handleDeleteLocal(t.id)}
                        title="Delete template (queued)"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <div className={styles.errorText}>{error}</div>}
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
            handleCreate(payload);
            setShowNew(false);
          }}
        />
      )}
    </>
  );
};