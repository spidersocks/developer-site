import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  blankRoutine,
  formatDuration,
  newId,
  sessionTotalSec,
} from "./routines.js";
import {
  deleteRoutine,
  fetchCatalog,
  reorderRoutines,
  resetCatalogToSeed,
  saveCatalog,
  saveRoutine,
} from "./api.js";
import "./editor.css";

const UNDO_LIMIT = 40;
const DURATION_PRESETS = [30, 45, 60, 90];

function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="ce-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ce-modal">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="ce-modal__actions">
          <button type="button" className="ce-btn ce-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`ce-btn ${danger ? "ce-btn--danger" : "ce-btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Editor({ initialCatalog }) {
  const [catalog, setCatalog] = useState(() => cloneCatalog(initialCatalog));
  const [selectedId, setSelectedId] = useState(
    () => initialCatalog.routines[0]?.id ?? null
  );
  const [undoStack, setUndoStack] = useState([]);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const dragRoutine = useRef(null);
  const dragSegment = useRef(null);
  const fileRef = useRef(null);

  const selected = useMemo(
    () => catalog.routines.find((r) => r.id === selectedId) ?? null,
    [catalog.routines, selectedId]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  function pushUndo(snapshot = catalog) {
    setUndoStack((stack) => {
      const next = [...stack, cloneCatalog(snapshot)];
      return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
    });
  }

  function applyLocal(nextCatalog, { recordUndo = true } = {}) {
    if (recordUndo) pushUndo(catalog);
    setCatalog(cloneCatalog(nextCatalog));
  }

  async function persistCatalog(nextCatalog, { recordUndo = true, message } = {}) {
    setBusy(true);
    setStatus({ kind: "idle", text: "Saving…" });
    try {
      const saved = await saveCatalog(nextCatalog);
      applyLocal(saved, { recordUndo });
      setStatus({ kind: "ok", text: message || "Saved to server." });
      setToast(message || "Saved");
      return saved;
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Save failed" });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function persistRoutine(routine, { recordUndo = true } = {}) {
    setBusy(true);
    setStatus({ kind: "idle", text: "Saving routine…" });
    try {
      if (recordUndo) pushUndo(catalog);
      const saved = await saveRoutine(routine);
      setCatalog(cloneCatalog(saved));
      setSelectedId(routine.id);
      setStatus({ kind: "ok", text: "Routine saved." });
      setToast("Routine saved");
      return saved;
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Save failed" });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function updateSelected(patch) {
    if (!selected) return;
    const next = {
      ...catalog,
      routines: catalog.routines.map((r) =>
        r.id === selected.id ? { ...r, ...patch } : r
      ),
    };
    applyLocal(next);
  }

  function updateSegment(segId, patch) {
    if (!selected) return;
    const segments = selected.segments.map((s) =>
      s.id === segId ? { ...s, ...patch } : s
    );
    updateSelected({ segments });
  }

  async function handleUndo() {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setBusy(true);
      saveCatalog(prev)
        .then((saved) => {
          setCatalog(cloneCatalog(saved));
          setStatus({ kind: "ok", text: "Undid last change." });
          setToast("Undone");
          if (!saved.routines.some((r) => r.id === selectedId)) {
            setSelectedId(saved.routines[0]?.id ?? null);
          }
        })
        .catch((err) => {
          setStatus({ kind: "err", text: err.message || "Undo failed" });
        })
        .finally(() => setBusy(false));
      return stack.slice(0, -1);
    });
  }

  async function handleSaveSelected() {
    if (!selected) return;
    await persistRoutine(selected);
  }

  async function handleSaveAll() {
    await persistCatalog(catalog, { message: "Catalog saved." });
  }

  function handleNewRoutine() {
    const routine = blankRoutine();
    const next = { ...catalog, routines: [...catalog.routines, routine] };
    applyLocal(next);
    setSelectedId(routine.id);
  }

  function handleDuplicate() {
    if (!selected) return;
    const copy = {
      ...cloneCatalog(selected),
      id: newId("routine"),
      name: `${selected.name}-copy`,
      title: `${selected.title} (copy)`,
      segments: selected.segments.map((s) => ({ ...s, id: newId("seg") })),
    };
    const next = { ...catalog, routines: [...catalog.routines, copy] };
    applyLocal(next);
    setSelectedId(copy.id);
  }

  function requestDeleteRoutine() {
    if (!selected) return;
    setConfirm({
      title: "Delete routine?",
      body: `“${selected.title}” and all of its exercises will be removed from the server.`,
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        setConfirm(null);
        pushUndo(catalog);
        setBusy(true);
        try {
          const saved = await deleteRoutine(selected.id);
          setCatalog(cloneCatalog(saved));
          setSelectedId(saved.routines[0]?.id ?? null);
          setStatus({ kind: "ok", text: "Routine deleted." });
          setToast("Deleted");
        } catch (err) {
          setStatus({ kind: "err", text: err.message || "Delete failed" });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function requestResetSeed() {
    setConfirm({
      title: "Reset to seed data?",
      body: "This replaces the whole catalog with the bundled DEMO + R1–R5 defaults.",
      confirmLabel: "Reset",
      danger: true,
      run: async () => {
        setConfirm(null);
        pushUndo(catalog);
        setBusy(true);
        try {
          const saved = await resetCatalogToSeed();
          setCatalog(cloneCatalog(saved));
          setSelectedId(saved.routines[0]?.id ?? null);
          setStatus({ kind: "ok", text: "Reset to seed." });
          setToast("Reset to seed");
        } catch (err) {
          setStatus({ kind: "err", text: err.message || "Reset failed" });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clozzz-routines-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Exported JSON");
  }

  async function handleImportFile(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await persistCatalog(parsed, { message: "Imported catalog." });
      setSelectedId(parsed.routines?.[0]?.id ?? null);
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Import failed" });
    }
  }

  function addSegment() {
    if (!selected) return;
    updateSelected({
      segments: [
        ...selected.segments,
        { id: newId("seg"), label: "New exercise", durationSec: 60 },
      ],
    });
  }

  function duplicateSegment(segId) {
    if (!selected) return;
    const idx = selected.segments.findIndex((s) => s.id === segId);
    if (idx < 0) return;
    const src = selected.segments[idx];
    const copy = { ...src, id: newId("seg"), label: `${src.label} (copy)` };
    const segments = [...selected.segments];
    segments.splice(idx + 1, 0, copy);
    updateSelected({ segments });
  }

  function requestDeleteSegment(segId) {
    if (!selected) return;
    if (selected.segments.length <= 1) {
      setStatus({ kind: "err", text: "A routine needs at least one exercise." });
      return;
    }
    const seg = selected.segments.find((s) => s.id === segId);
    setConfirm({
      title: "Delete exercise?",
      body: `Remove “${seg?.label || "this exercise"}” from the routine?`,
      confirmLabel: "Delete",
      danger: true,
      run: () => {
        setConfirm(null);
        updateSelected({
          segments: selected.segments.filter((s) => s.id !== segId),
        });
      },
    });
  }

  async function onRoutineDrop(targetId) {
    const fromId = dragRoutine.current;
    dragRoutine.current = null;
    if (!fromId || fromId === targetId) return;
    const ids = catalog.routines.map((r) => r.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    pushUndo(catalog);
    setBusy(true);
    try {
      const saved = await reorderRoutines(ids);
      setCatalog(cloneCatalog(saved));
      setToast("Order updated");
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Reorder failed" });
    } finally {
      setBusy(false);
    }
  }

  function onSegmentDrop(targetId) {
    if (!selected) return;
    const fromId = dragSegment.current;
    dragSegment.current = null;
    if (!fromId || fromId === targetId) return;
    const list = selected.segments.map((s) => s.id);
    const from = list.indexOf(fromId);
    const to = list.indexOf(targetId);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    const byId = Object.fromEntries(selected.segments.map((s) => [s.id, s]));
    updateSelected({ segments: list.map((id) => byId[id]) });
  }

  return (
    <div className="clozzz-editor">
      <header className="clozzz-editor__top">
        <div className="clozzz-editor__brand">
          <img src="/clozzz/clozzz-logo.png" alt="" width="40" height="40" />
          <div>
            <h1>Clozzz routines</h1>
            <p>Edit catalog · OBS loads on Browser Source open</p>
          </div>
        </div>
        <div className="clozzz-editor__actions">
          <button
            type="button"
            className="ce-btn"
            disabled={!undoStack.length || busy}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button type="button" className="ce-btn" disabled={busy} onClick={handleNewRoutine}>
            New
          </button>
          <button
            type="button"
            className="ce-btn"
            disabled={!selected || busy}
            onClick={handleDuplicate}
          >
            Duplicate
          </button>
          <button type="button" className="ce-btn" disabled={busy} onClick={handleExport}>
            Export
          </button>
          <button
            type="button"
            className="ce-btn"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleImportFile(file);
            }}
          />
          <button
            type="button"
            className="ce-btn ce-btn--danger"
            disabled={busy}
            onClick={requestResetSeed}
          >
            Reset seed
          </button>
          <button
            type="button"
            className="ce-btn ce-btn--primary"
            disabled={busy}
            onClick={handleSaveAll}
          >
            Save all
          </button>
          <a className="ce-btn ce-btn--ghost" href="/clozzz-overlay">
            Overlay
          </a>
        </div>
        {status.text ? (
          <div
            className={`clozzz-editor__status${
              status.kind === "ok"
                ? " clozzz-editor__status--ok"
                : status.kind === "err"
                  ? " clozzz-editor__status--err"
                  : ""
            }`}
          >
            {status.text}
            {catalog.updatedAt ? ` · server ${catalog.updatedAt}` : ""}
          </div>
        ) : null}
      </header>

      <div className="clozzz-editor__body">
        <aside className="ce-sidebar">
          <div className="ce-sidebar__head">
            <h2>Library · {catalog.routines.length}</h2>
            <button type="button" className="ce-btn" disabled={busy} onClick={handleNewRoutine}>
              +
            </button>
          </div>
          <ul className="ce-routine-list">
            {catalog.routines.map((routine) => (
              <li key={routine.id}>
                <button
                  type="button"
                  className={`ce-routine-item${
                    routine.id === selectedId ? " is-active" : ""
                  }`}
                  draggable
                  onDragStart={() => {
                    dragRoutine.current = routine.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onRoutineDrop(routine.id)}
                  onClick={() => setSelectedId(routine.id)}
                >
                  <span className="ce-drag-handle" title="Drag to reorder" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span>
                    <strong>{routine.title}</strong>
                    <span>
                      {routine.routineId} · {routine.segments.length} exercises ·{" "}
                      {formatDuration(sessionTotalSec(routine))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="ce-main">
          {!selected ? (
            <div className="ce-empty">
              <p>No routine selected. Create one to get started.</p>
            </div>
          ) : (
            <section className="ce-card">
              <div className="ce-card__title-row">
                <h2>{selected.title || "Untitled"}</h2>
                <div className="clozzz-editor__actions">
                  <button
                    type="button"
                    className="ce-btn ce-btn--primary"
                    disabled={busy}
                    onClick={handleSaveSelected}
                  >
                    Save routine
                  </button>
                  <button
                    type="button"
                    className="ce-btn ce-btn--danger"
                    disabled={busy}
                    onClick={requestDeleteRoutine}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="ce-fields">
                <div className="ce-field">
                  <label htmlFor="ce-title">Title</label>
                  <input
                    id="ce-title"
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                  />
                </div>
                <div className="ce-field">
                  <label htmlFor="ce-routine-id">Display id (e.g. R1)</label>
                  <input
                    id="ce-routine-id"
                    value={selected.routineId}
                    onChange={(e) => updateSelected({ routineId: e.target.value })}
                  />
                </div>
                <div className="ce-field">
                  <label htmlFor="ce-id">Stable id</label>
                  <input id="ce-id" value={selected.id} readOnly />
                </div>
                <div className="ce-field">
                  <label htmlFor="ce-name">URL slug / name</label>
                  <input
                    id="ce-name"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <div className="ce-field">
                  <label htmlFor="ce-space">Space</label>
                  <input
                    id="ce-space"
                    value={selected.space}
                    onChange={(e) => updateSelected({ space: e.target.value })}
                  />
                </div>
                <div className="ce-field ce-field--wide">
                  <label htmlFor="ce-intent">Intent</label>
                  <textarea
                    id="ce-intent"
                    value={selected.intent}
                    onChange={(e) => updateSelected({ intent: e.target.value })}
                  />
                </div>
              </div>

              <div className="ce-segments">
                <div className="ce-segments__head">
                  <h3>
                    Exercises · {selected.segments.length} ·{" "}
                    {formatDuration(sessionTotalSec(selected))}
                  </h3>
                  <button type="button" className="ce-btn" onClick={addSegment}>
                    Add exercise
                  </button>
                </div>
                <ul className="ce-segment-list">
                  {selected.segments.map((seg) => (
                    <li
                      key={seg.id}
                      className="ce-segment"
                      draggable
                      onDragStart={() => {
                        dragSegment.current = seg.id;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onSegmentDrop(seg.id)}
                    >
                      <span className="ce-drag-handle" aria-hidden="true">
                        ⋮⋮
                      </span>
                      <input
                        aria-label="Exercise name"
                        value={seg.label}
                        onChange={(e) => updateSegment(seg.id, { label: e.target.value })}
                      />
                      <div className="ce-seg-duration">
                        <input
                          aria-label="Duration seconds"
                          type="number"
                          min={1}
                          value={seg.durationSec}
                          onChange={(e) =>
                            updateSegment(seg.id, {
                              durationSec: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                        <div className="ce-presets">
                          {DURATION_PRESETS.map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => updateSegment(seg.id, { durationSec: sec })}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ce-seg-actions">
                        <button
                          type="button"
                          className="ce-btn"
                          onClick={() => duplicateSegment(seg.id)}
                        >
                          Dup
                        </button>
                        <button
                          type="button"
                          className="ce-btn ce-btn--danger"
                          onClick={() => requestDeleteSegment(seg.id)}
                        >
                          Del
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </main>
      </div>

      {confirm ? (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={confirm.run}
        />
      ) : null}

      {toast ? <div className="ce-toast">{toast}</div> : null}
    </div>
  );
}

export async function loadEditorCatalog(fallback) {
  try {
    return await fetchCatalog();
  } catch {
    return cloneCatalog(fallback);
  }
}
