import React, { useEffect, useRef, useState } from "react";
import {
  blankRoutine,
  formatDuration,
  newId,
  sessionTotalSec,
  slugify,
  toServerRoutine,
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

function obsPath(routine) {
  return `/clozzz-overlay/${encodeURIComponent(routine.id)}`;
}

export default function Editor({ initialCatalog }) {
  const [catalog, setCatalog] = useState(() => cloneCatalog(initialCatalog));
  const [openId, setOpenId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const dragRoutine = useRef(null);
  const dragSegment = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 2600);
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

  function updateRoutine(id, patch) {
    const next = {
      ...catalog,
      routines: catalog.routines.map((r) => {
        if (r.id !== id) return r;
        const merged = { ...r, ...patch };
        // Keep URL slug loosely aligned with title for unsaved routines.
        if (r.localOnly && patch.title != null) {
          merged.name = `${r.id}-${slugify(patch.title)}`;
        }
        return merged;
      }),
    };
    applyLocal(next);
  }

  async function persistRoutine(routine) {
    setBusy(true);
    setStatus({ kind: "idle", text: "Saving…" });
    try {
      pushUndo(catalog);
      const saved = await saveRoutine(toServerRoutine(routine));
      setCatalog(cloneCatalog(saved));
      setOpenId(routine.id);
      setStatus({ kind: "ok", text: "Saved." });
      setToast("Saved");
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function persistWholeCatalog(nextCatalog, message) {
    setBusy(true);
    setStatus({ kind: "idle", text: "Saving…" });
    try {
      const payload = {
        ...nextCatalog,
        routines: nextCatalog.routines.map(toServerRoutine),
      };
      const saved = await saveCatalog(payload);
      applyLocal(saved, { recordUndo: true });
      setStatus({ kind: "ok", text: message || "Saved." });
      setToast(message || "Saved");
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  function handleUndo() {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setBusy(true);
      saveCatalog({
        ...prev,
        routines: prev.routines.filter((r) => !r.localOnly).map(toServerRoutine),
      })
        .then((saved) => {
          // Re-attach any local-only drafts that were in the undo snapshot.
          const locals = prev.routines.filter((r) => r.localOnly);
          const merged = {
            ...saved,
            routines: [...saved.routines, ...locals.filter((l) => !saved.routines.some((s) => s.id === l.id))],
          };
          setCatalog(cloneCatalog(merged));
          setStatus({ kind: "ok", text: "Undone." });
          setToast("Undone");
        })
        .catch((err) => setStatus({ kind: "err", text: err.message || "Undo failed" }))
        .finally(() => setBusy(false));
      return stack.slice(0, -1);
    });
  }

  function handleNew() {
    const routine = blankRoutine(catalog.routines);
    applyLocal({ ...catalog, routines: [...catalog.routines, routine] });
    setOpenId(routine.id);
    setToast("Draft routine created — save when ready");
  }

  function handleDuplicate(routine) {
    const codes = blankRoutine(catalog.routines);
    const copy = {
      ...cloneCatalog(routine),
      id: codes.id,
      routineId: codes.routineId,
      name: `${codes.id}-${slugify(routine.title)}-copy`,
      title: `${routine.title} (copy)`,
      segments: routine.segments.map((s) => ({ ...s, id: newId("seg") })),
      localOnly: true,
    };
    applyLocal({ ...catalog, routines: [...catalog.routines, copy] });
    setOpenId(copy.id);
  }

  function requestDelete(routine) {
    setConfirm({
      title: "Delete routine?",
      body: routine.localOnly
        ? `Remove draft “${routine.title}”? It was never saved to the server.`
        : `Delete “${routine.title}” from the server?`,
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        setConfirm(null);
        if (routine.localOnly) {
          applyLocal({
            ...catalog,
            routines: catalog.routines.filter((r) => r.id !== routine.id),
          });
          if (openId === routine.id) setOpenId(null);
          setToast("Draft discarded");
          return;
        }
        pushUndo(catalog);
        setBusy(true);
        try {
          const saved = await deleteRoutine(routine.id);
          setCatalog(cloneCatalog(saved));
          if (openId === routine.id) setOpenId(null);
          setStatus({ kind: "ok", text: "Deleted." });
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
      title: "Reset to defaults?",
      body: "Replace the whole catalog with the bundled DEMO + R1–R5 seed.",
      confirmLabel: "Reset",
      danger: true,
      run: async () => {
        setConfirm(null);
        pushUndo(catalog);
        setBusy(true);
        try {
          const saved = await resetCatalogToSeed();
          setCatalog(cloneCatalog(saved));
          setOpenId(null);
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
    const payload = {
      ...catalog,
      routines: catalog.routines.map(toServerRoutine),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
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
      const parsed = JSON.parse(await file.text());
      await persistWholeCatalog(parsed, "Imported catalog.");
      setOpenId(null);
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Import failed" });
    }
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
    const byId = Object.fromEntries(catalog.routines.map((r) => [r.id, r]));
    const nextLocal = { ...catalog, routines: ids.map((id) => byId[id]) };
    applyLocal(nextLocal);

    const serverIds = ids.filter((id) => !byId[id].localOnly);
    if (serverIds.length !== catalog.routines.filter((r) => !r.localOnly).length) {
      return;
    }
    setBusy(true);
    try {
      const saved = await reorderRoutines(serverIds);
      const locals = nextLocal.routines.filter((r) => r.localOnly);
      setCatalog({
        ...saved,
        routines: [
          ...saved.routines,
          ...locals.filter((l) => !saved.routines.some((s) => s.id === l.id)),
        ],
      });
      setToast("Order updated");
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Reorder failed" });
    } finally {
      setBusy(false);
    }
  }

  function updateSegment(routineId, segId, patch) {
    const routine = catalog.routines.find((r) => r.id === routineId);
    if (!routine) return;
    updateRoutine(routineId, {
      segments: routine.segments.map((s) => (s.id === segId ? { ...s, ...patch } : s)),
    });
  }

  function addSegment(routineId) {
    const routine = catalog.routines.find((r) => r.id === routineId);
    if (!routine) return;
    updateRoutine(routineId, {
      segments: [
        ...routine.segments,
        { id: newId("seg"), label: "New exercise", durationSec: 60 },
      ],
    });
  }

  function onSegmentDrop(routineId, targetId) {
    const routine = catalog.routines.find((r) => r.id === routineId);
    if (!routine) return;
    const fromId = dragSegment.current;
    dragSegment.current = null;
    if (!fromId || fromId === targetId) return;
    const list = routine.segments.map((s) => s.id);
    const from = list.indexOf(fromId);
    const to = list.indexOf(targetId);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    const byId = Object.fromEntries(routine.segments.map((s) => [s.id, s]));
    updateRoutine(routineId, { segments: list.map((id) => byId[id]) });
  }

  function requestDeleteSegment(routine, segId) {
    if (routine.segments.length <= 1) {
      setStatus({ kind: "err", text: "Keep at least one exercise." });
      return;
    }
    const seg = routine.segments.find((s) => s.id === segId);
    setConfirm({
      title: "Delete exercise?",
      body: `Remove “${seg?.label || "this exercise"}”?`,
      confirmLabel: "Delete",
      danger: true,
      run: () => {
        setConfirm(null);
        updateRoutine(routine.id, {
          segments: routine.segments.filter((s) => s.id !== segId),
        });
      },
    });
  }

  return (
    <div className="clozzz-editor">
      <div className="clozzz-editor__shell">
        <header className="clozzz-editor__top">
          <div className="clozzz-editor__brand">
            <img src="/clozzz/clozzz-logo.png" alt="" width="44" height="44" />
            <div>
              <h1>Clozzz routines</h1>
              <p>Click a routine to edit · open its OBS link when you stream</p>
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
              Reset
            </button>
            <button
              type="button"
              className="ce-btn ce-btn--primary"
              disabled={busy}
              onClick={handleNew}
            >
              New routine
            </button>
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
            </div>
          ) : null}
        </header>

        {!catalog.routines.length ? (
          <div className="ce-empty">
            <p>No routines yet.</p>
            <button type="button" className="ce-btn ce-btn--primary" onClick={handleNew}>
              Create one
            </button>
          </div>
        ) : (
          <ul className="ce-list">
            {catalog.routines.map((routine) => {
              const open = openId === routine.id;
              return (
                <li
                  key={routine.id}
                  className={`ce-item${open ? " is-open" : ""}`}
                  draggable
                  onDragStart={() => {
                    dragRoutine.current = routine.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onRoutineDrop(routine.id)}
                >
                  <button
                    type="button"
                    className="ce-item__summary"
                    onClick={() => setOpenId(open ? null : routine.id)}
                    aria-expanded={open}
                  >
                    <span className="ce-drag-handle" title="Drag to reorder" aria-hidden="true">
                      ⋮⋮
                    </span>
                    <span>
                      <strong>{routine.title}</strong>
                      <span>
                        {routine.segments.length} exercises ·{" "}
                        {formatDuration(sessionTotalSec(routine))}
                        {routine.localOnly ? " · unsaved draft" : ""}
                      </span>
                    </span>
                    <span className="ce-item__chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>

                  {open ? (
                    <div className="ce-item__body">
                      <div className="ce-item__toolbar">
                        <button
                          type="button"
                          className="ce-btn ce-btn--primary ce-btn--small"
                          disabled={busy}
                          onClick={() => persistRoutine(routine)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="ce-btn ce-btn--small"
                          disabled={busy}
                          onClick={() => handleDuplicate(routine)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="ce-btn ce-btn--danger ce-btn--small"
                          disabled={busy}
                          onClick={() => requestDelete(routine)}
                        >
                          Delete
                        </button>
                        {routine.localOnly ? (
                          <span className="ce-badge">Draft</span>
                        ) : null}
                      </div>

                      <div className="ce-fields">
                        <div className="ce-field">
                          <label htmlFor={`title-${routine.id}`}>Title</label>
                          <input
                            id={`title-${routine.id}`}
                            value={routine.title}
                            onChange={(e) =>
                              updateRoutine(routine.id, { title: e.target.value })
                            }
                          />
                        </div>
                        <div className="ce-field">
                          <label htmlFor={`space-${routine.id}`}>Space</label>
                          <input
                            id={`space-${routine.id}`}
                            value={routine.space}
                            onChange={(e) =>
                              updateRoutine(routine.id, { space: e.target.value })
                            }
                          />
                        </div>
                        <div className="ce-field">
                          <label htmlFor={`intent-${routine.id}`}>Intent</label>
                          <textarea
                            id={`intent-${routine.id}`}
                            value={routine.intent}
                            onChange={(e) =>
                              updateRoutine(routine.id, { intent: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="ce-meta" style={{ marginTop: "0.75rem" }}>
                        <span>
                          OBS link{" "}
                          <a href={obsPath(routine)}>
                            <code>{obsPath(routine)}</code>
                          </a>
                        </span>
                      </div>

                      <div className="ce-segments">
                        <div className="ce-segments__head">
                          <h3>Exercises</h3>
                          <button
                            type="button"
                            className="ce-btn ce-btn--small"
                            onClick={() => addSegment(routine.id)}
                          >
                            Add exercise
                          </button>
                        </div>
                        <ul className="ce-segment-list">
                          {routine.segments.map((seg) => (
                            <li
                              key={seg.id}
                              className="ce-segment"
                              draggable
                              onDragStart={() => {
                                dragSegment.current = seg.id;
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => onSegmentDrop(routine.id, seg.id)}
                            >
                              <span className="ce-drag-handle" aria-hidden="true">
                                ⋮⋮
                              </span>
                              <input
                                aria-label="Exercise name"
                                value={seg.label}
                                onChange={(e) =>
                                  updateSegment(routine.id, seg.id, {
                                    label: e.target.value,
                                  })
                                }
                              />
                              <div className="ce-seg-duration">
                                <input
                                  aria-label="Duration seconds"
                                  type="number"
                                  min={1}
                                  value={seg.durationSec}
                                  onChange={(e) =>
                                    updateSegment(routine.id, seg.id, {
                                      durationSec: Math.max(
                                        1,
                                        Number(e.target.value) || 1
                                      ),
                                    })
                                  }
                                />
                                <div className="ce-presets">
                                  {DURATION_PRESETS.map((sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() =>
                                        updateSegment(routine.id, seg.id, {
                                          durationSec: sec,
                                        })
                                      }
                                    >
                                      {sec}s
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="ce-seg-actions">
                                <button
                                  type="button"
                                  className="ce-btn ce-btn--small"
                                  onClick={() => {
                                    const idx = routine.segments.findIndex(
                                      (s) => s.id === seg.id
                                    );
                                    const copy = {
                                      ...seg,
                                      id: newId("seg"),
                                      label: `${seg.label} (copy)`,
                                    };
                                    const segments = [...routine.segments];
                                    segments.splice(idx + 1, 0, copy);
                                    updateRoutine(routine.id, { segments });
                                  }}
                                >
                                  Dup
                                </button>
                                <button
                                  type="button"
                                  className="ce-btn ce-btn--danger ce-btn--small"
                                  onClick={() => requestDeleteSegment(routine, seg.id)}
                                >
                                  Del
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
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
