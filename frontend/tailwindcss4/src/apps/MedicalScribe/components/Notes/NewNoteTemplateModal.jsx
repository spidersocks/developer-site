import React, { useState, useEffect, useRef } from "react";
import styles from "./NewNoteTemplateModal.module.css";

export const NewNoteTemplateModal = ({
  onClose,
  onSave,
  initialValue = null,
}) => {
  const [name, setName] = useState(initialValue?.name || "");
  const [sections, setSections] = useState(
    initialValue?.sections?.length
      ? initialValue.sections.map((s, i) => ({
          id: s.id || `sec_${i + 1}`,
          name: s.name || "",
          description: s.description || "",
        }))
      : [{ id: "sec_1", name: "", description: "" }]
  );
  const [exampleNoteText, setExampleNoteText] = useState(initialValue?.exampleNoteText || "");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, sections]);

  const validate = () => {
    if (!name.trim()) {
      setError("Template name is required.");
      return false;
    }
    if (sections.length < 1 || sections.length > 8) {
      setError("Templates must have between 1 and 8 sections.");
      return false;
    }
    const invalid = sections.some((s) => !s.name.trim() || !s.description.trim());
    if (invalid) {
      setError("Each section needs a name and a description.");
      return false;
    }
    setError("");
    return true;
  };

  const addSection = () => {
    if (sections.length >= 8) return;
    setSections((prev) => [...prev, { id: `sec_${prev.length + 1}`, name: "", description: "" }]);
  };

  const removeSection = (idx) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSection = (idx, field, value) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    // Keep it simple for now: accept text/markdown only
    if (!/^text\/(plain|markdown)$/.test(file.type)) {
      alert("Please upload a plain text or markdown file.");
      return;
    }
    const text = await file.text().catch(() => "");
    setExampleNoteText((prev) => (prev ? `${prev}\n\n${text}` : text));
    setSelectedFileName(file.name || "");
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      name: name.trim(),
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name.trim(),
        description: s.description.trim(),
      })),
      exampleNoteText: exampleNoteText || "",
    };
    // No persistence here — parent can wire this later
    try {
      onSave?.(payload);
    } finally {
      onClose?.();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-content ${styles.modalContent}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{initialValue ? "Edit Template" : "New Note Template"}</h3>
          <button className="modal-close-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className={styles.field}>
            <label className={styles.label}>
              Template Name <span className={styles.req}>*</span>
            </label>
            <input
              type="text"
              className={styles.control}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Oncology Follow-up Note"
              autoFocus
            />
          </div>

          <div className={styles.sectionsHeader}>
            <span>Sections</span>
            <button type="button" className={styles.smallButton} onClick={addSection} disabled={sections.length >= 8}>
              + Add section
            </button>
          </div>

          <div className={styles.sectionsList}>
            {sections.map((sec, idx) => (
              <div key={sec.id} className={styles.sectionRow}>
                <div className={styles.sectionCol}>
                  <label className={styles.smallLabel}>Section name</label>
                  <input
                    type="text"
                    className={styles.control}
                    value={sec.name}
                    onChange={(e) => updateSection(idx, "name", e.target.value)}
                    placeholder={`Section ${idx + 1} name`}
                  />
                </div>
                <div className={styles.sectionCol}>
                  <label className={styles.smallLabel}>Description (what to write)</label>
                  <textarea
                    className={styles.control}
                    rows={2}
                    value={sec.description}
                    onChange={(e) => updateSection(idx, "description", e.target.value)}
                    placeholder="Describe what content should go here…"
                  />
                </div>
                <div className={styles.sectionActions}>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeSection(idx)}
                    disabled={sections.length <= 1}
                    title="Remove section"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Example Note (optional)</label>
            <textarea
              className={styles.control}
              rows={6}
              value={exampleNoteText}
              onChange={(e) => setExampleNoteText(e.target.value)}
              placeholder="Paste an example note to guide structure and tone."
            />

            <div className={styles.uploadRow}>
              <input
                ref={fileInputRef}
                className={styles.hiddenFileInput}
                type="file"
                accept=".txt,text/plain,.md,text/markdown"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <button
                type="button"
                className="button button-secondary"
                onClick={triggerFilePicker}
              >
                Attach file
              </button>
              <span className={styles.fileName}>
                {selectedFileName || "No file chosen"}
              </span>
            </div>
          </div>

          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <div className="modal-footer modal-footer-buttons">
          <button className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={handleSave} disabled={!!error}>
            {initialValue ? "Save Changes" : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
};