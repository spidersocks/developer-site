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
  saveRoutine,
} from "./api.js";
import "./editor.css";

const UNDO_LIMIT = 40;
const DURATION_STEP = 15;

function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

function formatLastEdited(iso) {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not saved yet";
  return `Last edited ${d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatMmSs(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseMmSs(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Math.max(1, Number(text));
  const match = text.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  return Math.max(1, minutes * 60 + seconds);
}

function PencilIcon() {
  return (
    <svg className="ce-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.7 1.3a1.5 1.5 0 0 1 2.1 2.1L5.4 12 2 13l1-3.4 8.7-8.3Zm-8 9.9.5 1.6 1.6.5 7.8-7.8-2.1-2.1-7.8 7.8Z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="ce-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 8a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 3 8Zm6.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM14.5 8a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"
      />
    </svg>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="ce-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ce-modal">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="ce-modal__actions">
          <button type="button" className="ce-btn" onClick={onCancel}>
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

function DurationField({ value, onChange, ariaLabel }) {
  const [draft, setDraft] = useState(formatMmSs(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(formatMmSs(value));
  }, [value, editing]);

  function commit(raw = draft) {
    const parsed = parseMmSs(raw);
    setEditing(false);
    if (parsed == null) {
      setDraft(formatMmSs(value));
      return;
    }
    onChange(parsed);
    setDraft(formatMmSs(parsed));
  }

  function nudge(delta) {
    onChange(Math.max(1, (Number(value) || 1) + delta));
  }

  return (
    <div className="ce-duration" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="ce-duration__step"
        aria-label="Decrease duration"
        onClick={() => nudge(-DURATION_STEP)}
      >
        −
      </button>
      {editing ? (
        <input
          className="ce-duration__input"
          value={draft}
          autoFocus
          inputMode="numeric"
          aria-label={ariaLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
              setDraft(formatMmSs(value));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              nudge(DURATION_STEP);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              nudge(-DURATION_STEP);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="ce-duration__value"
          onClick={() => setEditing(true)}
          title="Click to type m:ss"
        >
          {formatMmSs(value)}
        </button>
      )}
      <button
        type="button"
        className="ce-duration__step"
        aria-label="Increase duration"
        onClick={() => nudge(DURATION_STEP)}
      >
        +
      </button>
    </div>
  );
}

function OverflowMenu({ open, onToggle, onClose, items }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="ce-overflow" ref={rootRef}>
      <button
        type="button"
        className="ce-icon-btn"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div className="ce-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`ce-menu__item${item.danger ? " is-danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function obsPath(routine) {
  return `/clozzz-overlay/${encodeURIComponent(routine.id)}`;
}

export default function Editor({ initialCatalog }) {
  const [catalog, setCatalog] = useState(() => cloneCatalog(initialCatalog));
  const [openId, setOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuKey, setMenuKey] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [draggingRoutine, setDraggingRoutine] = useState(null);
  const [overRoutine, setOverRoutine] = useState(null);
  const [draggingSegment, setDraggingSegment] = useState(null);
  const [overSegment, setOverSegment] = useState(null);
  const dragRoutine = useRef(null);
  const dragSegment = useRef(null);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

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
        if (r.localOnly && patch.title != null) {
          merged.name = `${r.id}-${slugify(patch.title)}`;
        }
        return merged;
      }),
    };
    applyLocal(next);
  }

  function beginRename(routine) {
    setRenamingId(routine.id);
    setRenameDraft(routine.title);
  }

  function commitRename(routine) {
    const nextTitle = renameDraft.trim() || routine.title;
    setRenamingId(null);
    if (nextTitle !== routine.title) {
      updateRoutine(routine.id, { title: nextTitle });
    }
  }

  async function persistRoutine(routine) {
    setBusy(true);
    setStatus({ kind: "idle", text: "Saving…" });
    try {
      pushUndo(catalog);
      const saved = await saveRoutine(toServerRoutine(routine));
      setCatalog(cloneCatalog(saved));
      setOpenId(routine.id);
      setStatus({ kind: "ok", text: "Saved" });
      setToast("Saved");
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
      setCatalog(cloneCatalog(prev));
      setStatus({ kind: "ok", text: "Undone locally — save a routine to sync" });
      setToast("Undone");
      return stack.slice(0, -1);
    });
  }

  function handleNew() {
    const routine = blankRoutine(catalog.routines);
    applyLocal({ ...catalog, routines: [...catalog.routines, routine] });
    setOpenId(routine.id);
    beginRename(routine);
    setToast("Draft created");
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
      updatedAt: undefined,
    };
    applyLocal({ ...catalog, routines: [...catalog.routines, copy] });
    setOpenId(copy.id);
  }

  function requestDelete(routine) {
    setConfirm({
      title: "Delete routine?",
      body: routine.localOnly
        ? `Remove draft “${routine.title}”? It was never saved.`
        : `Delete “${routine.title}”?`,
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
      body: "Replace the catalog with the bundled DEMO + R1–R5 seed.",
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
          setToast("Reset to defaults");
        } catch (err) {
          setStatus({ kind: "err", text: err.message || "Reset failed" });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function onRoutineDrop(targetId) {
    const fromId = dragRoutine.current;
    dragRoutine.current = null;
    setDraggingRoutine(null);
    setOverRoutine(null);
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
    if (
      serverIds.length !== catalog.routines.filter((r) => !r.localOnly).length
    ) {
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

  function duplicateSegment(routine, seg) {
    const idx = routine.segments.findIndex((s) => s.id === seg.id);
    const copy = {
      ...seg,
      id: newId("seg"),
      label: `${seg.label} (copy)`,
    };
    const segments = [...routine.segments];
    segments.splice(idx + 1, 0, copy);
    updateRoutine(routine.id, { segments });
  }

  function onSegmentDrop(routineId, targetId) {
    const routine = catalog.routines.find((r) => r.id === routineId);
    if (!routine) return;
    const fromId = dragSegment.current;
    dragSegment.current = null;
    setDraggingSegment(null);
    setOverSegment(null);
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
            <img src="/clozzz/clozzz-logo.png" alt="" width="32" height="32" />
            <h1>Evening exercise routines</h1>
          </div>
          <div className="clozzz-editor__actions">
            <button
              type="button"
              className="ce-btn ce-btn--subtle"
              disabled={!undoStack.length || busy}
              onClick={handleUndo}
            >
              Undo
            </button>
            <button
              type="button"
              className="ce-btn ce-btn--subtle"
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
              New
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
              New
            </button>
          </div>
        ) : (
          <ul className="ce-list">
            {catalog.routines.map((routine) => {
              const open = openId === routine.id;
              const renaming = renamingId === routine.id;
              return (
                <li
                  key={routine.id}
                  className={`ce-item${open ? " is-open" : ""}${
                    draggingRoutine === routine.id ? " is-dragging" : ""
                  }${overRoutine === routine.id && draggingRoutine !== routine.id ? " is-drag-over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingRoutine && draggingRoutine !== routine.id) {
                      setOverRoutine(routine.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (overRoutine === routine.id) setOverRoutine(null);
                  }}
                  onDrop={() => onRoutineDrop(routine.id)}
                >
                  <div className="ce-item__row">
                    <button
                      type="button"
                      className="ce-drag-handle"
                      title="Drag to reorder"
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        dragRoutine.current = routine.id;
                        setDraggingRoutine(routine.id);
                      }}
                      onDragEnd={() => {
                        dragRoutine.current = null;
                        setDraggingRoutine(null);
                        setOverRoutine(null);
                      }}
                      aria-label={`Reorder ${routine.title}`}
                    >
                      ⋮⋮
                    </button>
                    <div className="ce-item__main">
                      {renaming ? (
                        <input
                          ref={renameInputRef}
                          className="ce-item__rename"
                          value={renameDraft}
                          aria-label="Routine title"
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(routine)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(routine);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setRenamingId(null);
                              setRenameDraft(routine.title);
                            }
                          }}
                        />
                      ) : (
                        <p
                          className="ce-item__title"
                          title="Double-click to rename"
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            beginRename(routine);
                          }}
                        >
                          {routine.title}
                        </p>
                      )}
                      <p className="ce-item__meta">
                        {routine.segments.length} exercises ·{" "}
                        {formatDuration(sessionTotalSec(routine))} ·{" "}
                        {routine.localOnly
                          ? "Not saved yet"
                          : formatLastEdited(routine.updatedAt)}
                      </p>
                    </div>
                    <div className="ce-item__actions">
                      {!routine.localOnly ? (
                        <a className="ce-btn ce-btn--open" href={obsPath(routine)}>
                          Open
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="ce-edit-link"
                        onClick={() => setOpenId(open ? null : routine.id)}
                        aria-expanded={open}
                      >
                        <PencilIcon />
                        <span>{open ? "Done" : "Edit"}</span>
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="ce-item__body">
                      <div className="ce-item__toolbar">
                        <button
                          type="button"
                          className="ce-btn ce-btn--primary"
                          disabled={busy}
                          onClick={() => persistRoutine(routine)}
                        >
                          Save
                        </button>
                        {routine.localOnly ? <span className="ce-badge">Draft</span> : null}
                        <div className="ce-item__toolbar-spacer" />
                        <OverflowMenu
                          open={menuKey === `routine:${routine.id}`}
                          onToggle={() =>
                            setMenuKey((k) =>
                              k === `routine:${routine.id}` ? null : `routine:${routine.id}`
                            )
                          }
                          onClose={() => setMenuKey(null)}
                          items={[
                            {
                              label: "Duplicate",
                              onSelect: () => handleDuplicate(routine),
                              disabled: busy,
                            },
                            {
                              label: "Delete",
                              danger: true,
                              onSelect: () => requestDelete(routine),
                              disabled: busy,
                            },
                          ]}
                        />
                      </div>

                      <div className="ce-fields">
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

                      <div className="ce-segments">
                        <div className="ce-segments__head">
                          <h3>Exercises</h3>
                          <button
                            type="button"
                            className="ce-btn ce-btn--subtle"
                            onClick={() => addSegment(routine.id)}
                          >
                            Add exercise
                          </button>
                        </div>
                        <ul className="ce-segment-list">
                          {routine.segments.map((seg) => (
                            <li
                              key={seg.id}
                              className={`ce-segment${
                                draggingSegment === seg.id ? " is-dragging" : ""
                              }${
                                overSegment === seg.id && draggingSegment !== seg.id
                                  ? " is-drag-over"
                                  : ""
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (draggingSegment && draggingSegment !== seg.id) {
                                  setOverSegment(seg.id);
                                }
                              }}
                              onDrop={() => onSegmentDrop(routine.id, seg.id)}
                            >
                              <button
                                type="button"
                                className="ce-drag-handle"
                                draggable
                                onDragStart={() => {
                                  dragSegment.current = seg.id;
                                  setDraggingSegment(seg.id);
                                }}
                                onDragEnd={() => {
                                  dragSegment.current = null;
                                  setDraggingSegment(null);
                                  setOverSegment(null);
                                }}
                                aria-label={`Reorder ${seg.label}`}
                              >
                                ⋮⋮
                              </button>
                              <input
                                className="ce-segment__name"
                                aria-label="Exercise name"
                                value={seg.label}
                                onChange={(e) =>
                                  updateSegment(routine.id, seg.id, {
                                    label: e.target.value,
                                  })
                                }
                              />
                              <DurationField
                                value={seg.durationSec}
                                ariaLabel={`Duration for ${seg.label}`}
                                onChange={(durationSec) =>
                                  updateSegment(routine.id, seg.id, { durationSec })
                                }
                              />
                              <OverflowMenu
                                open={menuKey === `seg:${routine.id}:${seg.id}`}
                                onToggle={() =>
                                  setMenuKey((k) =>
                                    k === `seg:${routine.id}:${seg.id}`
                                      ? null
                                      : `seg:${routine.id}:${seg.id}`
                                  )
                                }
                                onClose={() => setMenuKey(null)}
                                items={[
                                  {
                                    label: "Duplicate",
                                    onSelect: () => duplicateSegment(routine, seg),
                                  },
                                  {
                                    label: "Delete",
                                    danger: true,
                                    onSelect: () => requestDeleteSegment(routine, seg.id),
                                  },
                                ]}
                              />
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
