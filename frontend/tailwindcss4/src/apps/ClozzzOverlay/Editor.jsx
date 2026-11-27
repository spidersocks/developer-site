import React, { useEffect, useRef, useState } from "react";
import {
  assertBreakFieldsPersisted,
  blankRoutine,
  clampBreakSec,
  clampCountdownSec,
  DEFAULT_BREAK_SEC,
  DEFAULT_EXERCISE_DURATION_SEC,
  DEFAULT_INTRO_COUNTDOWN_SEC,
  formatDuration,
  newId,
  sessionTotalSec,
  slugify,
  SPACE_OPTIONS,
  toServerRoutine,
} from "./routines.js";
import {
  deleteRoutine,
  fetchCatalog,
  reorderRoutines,
  saveRoutine,
} from "./api.js";
import { clearLastRoutineId } from "./Remote.jsx";
import "./editor.css";

const DURATION_STEP = 15;
/** Pre-stream countdown steppers: ±1 minute, floor ≥1 min. */
const COUNTDOWN_STEP_SEC = 60;

/** + always lands on a multiple of 5; 1 → 15; − by 15 floored at 1. */
export function stepDuration(current, delta) {
  const cur = Math.max(1, Math.round(Number(current) || 1));
  if (delta < 0) {
    return Math.max(1, cur - Math.abs(delta || DURATION_STEP));
  }
  if (cur <= 1) return 15;
  const stepped = cur + Math.abs(delta || DURATION_STEP);
  return Math.ceil(stepped / 5) * 5;
}

/** ±1 minute per press; floor ≥1 minute. */
export function stepCountdownMinutes(current, deltaMinutes) {
  const cur = clampCountdownSec(current, DEFAULT_INTRO_COUNTDOWN_SEC);
  const next = cur + Math.round(Number(deltaMinutes) || 0) * COUNTDOWN_STEP_SEC;
  return clampCountdownSec(next, DEFAULT_INTRO_COUNTDOWN_SEC);
}

function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

function cloneRoutine(routine) {
  return JSON.parse(JSON.stringify(routine));
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

function ChevronDownIcon() {
  return (
    <svg className="ce-tools__chevron" viewBox="0 0 12 12" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.2 4.1a.75.75 0 0 1 1.06.02L6 6.78l2.74-2.66a.75.75 0 1 1 1.04 1.08l-3.26 3.16a.75.75 0 0 1-1.04 0L2.18 5.2a.75.75 0 0 1 .02-1.1Z"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="ce-tools__item-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 1.75A1.75 1.75 0 0 1 5.75 0h4.5A1.75 1.75 0 0 1 12 1.75V3h.25A1.75 1.75 0 0 1 14 4.75v8.5A1.75 1.75 0 0 1 12.25 15h-4.5A1.75 1.75 0 0 1 6 13.25V12H5.75A1.75 1.75 0 0 1 4 10.25v-8.5ZM5.75 1.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25H6V4.75A1.75 1.75 0 0 1 7.75 3H10.5V1.75a.25.25 0 0 0-.25-.25h-4.5ZM7.75 4.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h4.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25h-4.5Z"
      />
    </svg>
  );
}

function OpenExternalIcon() {
  return (
    <svg className="ce-tools__item-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.5 2a.5.5 0 0 0 0 1h2.793L6.146 9.146a.5.5 0 1 0 .708.708L13 3.707V6.5a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-.5-.5h-4ZM3.5 4A1.5 1.5 0 0 0 2 5.5v7A1.5 1.5 0 0 0 3.5 14h7a1.5 1.5 0 0 0 1.5-1.5V9a.5.5 0 0 0-1 0v3.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5H7a.5.5 0 0 0 0-1H3.5Z"
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

/**
 * @param {"exercise" | "countdown"} [mode]
 *        exercise: ±15s snap-5 (floor 1s)
 *        countdown: ±1 minute (floor ≥1 min)
 */
function DurationField({ value, onChange, ariaLabel, mode = "exercise" }) {
  const isCountdown = mode === "countdown";
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
    const next = isCountdown ? clampCountdownSec(parsed) : Math.max(1, parsed);
    onChange(next);
    setDraft(formatMmSs(next));
  }

  function nudge(signedStep) {
    if (isCountdown) {
      onChange(stepCountdownMinutes(value, signedStep > 0 ? 1 : -1));
      return;
    }
    onChange(stepDuration(value, signedStep));
  }

  const stepAmount = isCountdown ? COUNTDOWN_STEP_SEC : DURATION_STEP;

  return (
    <div className="ce-duration" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="ce-duration__step"
        aria-label={isCountdown ? "Decrease by 1 minute" : "Decrease duration"}
        onClick={() => nudge(-stepAmount)}
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
              nudge(stepAmount);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              nudge(-stepAmount);
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
        aria-label={isCountdown ? "Increase by 1 minute" : "Increase duration"}
        onClick={() => nudge(stepAmount)}
      >
        +
      </button>
    </div>
  );
}

function SpacePills({ value, onChange }) {
  const selected = Array.isArray(value) ? value : [];

  function toggle(option) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div
      className="ce-space-pills"
      role="group"
      aria-label="Space — press all that apply"
    >
      {SPACE_OPTIONS.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`ce-space-pill${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        );
      })}
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

/** Microsoft-style Tools control — library header (top right). */
function ToolsMenu({ onCopyObs, onOpenRemote }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`ce-tools${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="ce-tools__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Tools</span>
        <ChevronDownIcon />
      </button>
      {open ? (
        <div className="ce-tools__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="ce-tools__item"
            onClick={() => {
              setOpen(false);
              onCopyObs();
            }}
          >
            <CopyIcon />
            <span>Copy OBS link</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="ce-tools__item"
            onClick={() => {
              setOpen(false);
              onOpenRemote();
            }}
          >
            <OpenExternalIcon />
            <span>Open remote</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EditRoutineModal({
  draft,
  busy,
  error,
  onChange,
  onSave,
  onCancel,
}) {
  const [menuKey, setMenuKey] = useState(null);
  const [draggingSegment, setDraggingSegment] = useState(null);
  const [overSegment, setOverSegment] = useState(null);
  const dragSegment = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  function patchDraft(patch) {
    const next = { ...draft, ...patch };
    if (patch.title != null && draft.localOnly) {
      next.name = `${draft.id}-${slugify(patch.title)}`;
    }
    onChange(next);
  }

  function updateSegment(segId, patch) {
    patchDraft({
      segments: draft.segments.map((s) => (s.id === segId ? { ...s, ...patch } : s)),
    });
  }

  function addSegment() {
    patchDraft({
      segments: [
        ...draft.segments,
        {
          id: newId("seg"),
          label: "New exercise",
          durationSec: DEFAULT_EXERCISE_DURATION_SEC,
        },
      ],
    });
  }

  function duplicateSegment(seg) {
    const idx = draft.segments.findIndex((s) => s.id === seg.id);
    const copy = { ...seg, id: newId("seg"), label: `${seg.label} (copy)` };
    const segments = [...draft.segments];
    segments.splice(idx + 1, 0, copy);
    patchDraft({ segments });
  }

  function removeSegment(segId) {
    if (draft.segments.length <= 1) return;
    patchDraft({
      segments: draft.segments.filter((s) => s.id !== segId),
    });
  }

  function onSegmentDrop(targetId) {
    const fromId = dragSegment.current;
    dragSegment.current = null;
    setDraggingSegment(null);
    setOverSegment(null);
    if (!fromId || fromId === targetId) return;
    const list = draft.segments.map((s) => s.id);
    const from = list.indexOf(fromId);
    const to = list.indexOf(targetId);
    if (from < 0 || to < 0) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    const byId = Object.fromEntries(draft.segments.map((s) => [s.id, s]));
    patchDraft({ segments: list.map((id) => byId[id]) });
  }

  return (
    <div className="ce-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ce-edit-title">
      <div className="ce-edit-dialog">
        <header className="ce-edit-dialog__head">
          <div className="ce-edit-dialog__titles">
            <label className="ce-field-label" htmlFor="ce-edit-title">
              Title
            </label>
            <input
              id="ce-edit-title"
              ref={titleRef}
              className="ce-edit-dialog__title-input"
              value={draft.title}
              onChange={(e) => patchDraft({ title: e.target.value })}
            />
          </div>
          {draft.localOnly ? <span className="ce-badge">Draft</span> : null}
        </header>

        <div className="ce-edit-dialog__body">
          <div className="ce-fields">
            <div className="ce-field">
              <span className="ce-field__label" id="ce-edit-space-label">
                Space
              </span>
              <SpacePills
                value={draft.space}
                onChange={(space) => patchDraft({ space })}
              />
              <span className="ce-field__hint">Press all that apply</span>
            </div>
            <div className="ce-field">
              <label htmlFor="ce-edit-description">Description</label>
              <textarea
                id="ce-edit-description"
                value={draft.description || ""}
                onChange={(e) => patchDraft({ description: e.target.value })}
              />
            </div>
          </div>

          <div className="ce-stream-opts" aria-label="Stream graphics">
            <div className="ce-toggle-block">
              <label className="ce-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(draft.introCountdownEnabled)}
                  onChange={(e) =>
                    patchDraft({
                      introCountdownEnabled: e.target.checked,
                      introCountdownSec:
                        draft.introCountdownSec >= 60
                          ? draft.introCountdownSec
                          : DEFAULT_INTRO_COUNTDOWN_SEC,
                    })
                  }
                />
                <span className="ce-toggle__ui" aria-hidden="true" />
                <span className="ce-toggle__copy">
                  <span className="ce-toggle__title">Pre-stream countdown</span>
                  <span className="ce-toggle__hint">
                    Display a frozen countdown on OBS before the routine starts
                  </span>
                </span>
              </label>
              {draft.introCountdownEnabled ? (
                <div className="ce-toggle-block__expand ce-toggle-block__expand--intro">
                  <div className="ce-toggle-block__field">
                    <span className="ce-toggle-block__label">Duration</span>
                    <DurationField
                      mode="countdown"
                      value={
                        draft.introCountdownSec || DEFAULT_INTRO_COUNTDOWN_SEC
                      }
                      ariaLabel="Pre-stream countdown duration"
                      onChange={(introCountdownSec) =>
                        patchDraft({
                          introCountdownSec:
                            clampCountdownSec(introCountdownSec),
                        })
                      }
                    />
                  </div>
                  <div className="ce-toggle-block__field ce-toggle-block__field--msg">
                    <label
                      className="ce-toggle-block__label"
                      htmlFor="ce-intro-msg"
                    >
                      Message
                    </label>
                    <input
                      id="ce-intro-msg"
                      className="ce-toggle-block__input"
                      value={draft.introCountdownMessage || ""}
                      placeholder="{Routine} begins in"
                      onChange={(e) =>
                        patchDraft({ introCountdownMessage: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ce-toggle-block">
              <label className="ce-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(draft.streamEndedEnabled)}
                  onChange={(e) =>
                    patchDraft({
                      streamEndedEnabled: e.target.checked,
                    })
                  }
                />
                <span className="ce-toggle__ui" aria-hidden="true" />
                <span className="ce-toggle__copy">
                  <span className="ce-toggle__title">Stream ended graphic</span>
                  <span className="ce-toggle__hint">
                    Display an ended screen after the last exercise
                  </span>
                </span>
              </label>
              {draft.streamEndedEnabled ? (
                <div className="ce-toggle-block__expand">
                  <div className="ce-toggle-block__field ce-toggle-block__field--msg">
                    <label
                      className="ce-toggle-block__label"
                      htmlFor="ce-ended-msg"
                    >
                      Message
                    </label>
                    <input
                      id="ce-ended-msg"
                      className="ce-toggle-block__input"
                      value={draft.streamEndedMessage || ""}
                      placeholder="Thanks for watching"
                      onChange={(e) =>
                        patchDraft({ streamEndedMessage: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ce-toggle-block">
              <label className="ce-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(draft.breaksEnabled)}
                  onChange={(e) =>
                    patchDraft({
                      breaksEnabled: e.target.checked,
                      breakSec:
                        draft.breakSec >= 1
                          ? draft.breakSec
                          : DEFAULT_BREAK_SEC,
                    })
                  }
                />
                <span className="ce-toggle__ui" aria-hidden="true" />
                <span className="ce-toggle__copy">
                  <span className="ce-toggle__title">Breaks between exercises</span>
                  <span className="ce-toggle__hint">
                    Insert a rest countdown between each exercise
                  </span>
                </span>
              </label>
              {draft.breaksEnabled ? (
                <div className="ce-toggle-block__expand">
                  <div className="ce-toggle-block__field">
                    <span className="ce-toggle-block__label">Duration</span>
                    <DurationField
                      value={draft.breakSec || DEFAULT_BREAK_SEC}
                      ariaLabel="Break duration between exercises"
                      onChange={(breakSec) =>
                        patchDraft({ breakSec: clampBreakSec(breakSec) })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ce-segments">
            <div className="ce-segments__head">
              <h3>Exercises · {formatDuration(sessionTotalSec(draft))}</h3>
            </div>
            <ul className="ce-segment-list">
              {draft.segments.map((seg) => (
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
                  onDrop={() => onSegmentDrop(seg.id)}
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
                    onChange={(e) => updateSegment(seg.id, { label: e.target.value })}
                  />
                  <DurationField
                    value={seg.durationSec}
                    ariaLabel={`Duration for ${seg.label}`}
                    onChange={(durationSec) => updateSegment(seg.id, { durationSec })}
                  />
                  <OverflowMenu
                    open={menuKey === seg.id}
                    onToggle={() =>
                      setMenuKey((k) => (k === seg.id ? null : seg.id))
                    }
                    onClose={() => setMenuKey(null)}
                    items={[
                      {
                        label: "Duplicate",
                        onSelect: () => duplicateSegment(seg),
                      },
                      {
                        label: "Delete",
                        danger: true,
                        disabled: draft.segments.length <= 1,
                        onSelect: () => removeSegment(seg.id),
                      },
                    ]}
                  />
                </li>
              ))}
              <li className="ce-add-row">
                <button
                  type="button"
                  className="ce-add-row__btn"
                  onClick={addSegment}
                >
                  <span className="ce-add-row__plus" aria-hidden="true">
                    +
                  </span>
                  Add exercise
                </button>
              </li>
            </ul>
          </div>
        </div>

        <footer className="ce-edit-dialog__foot">
          {error ? <p className="ce-edit-dialog__error">{error}</p> : null}
          <div className="ce-edit-dialog__actions">
            <button
              type="button"
              className="ce-btn"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ce-btn ce-btn--primary"
              disabled={busy || !draft.title.trim()}
              onClick={onSave}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

const OPEN_DISPLAY_PATH = "/clozzz-overlay";
const REMOTE_HOME = "/clozzz-remote";

function openDisplayUrl() {
  if (typeof window === "undefined") return OPEN_DISPLAY_PATH;
  return `${window.location.origin}${OPEN_DISPLAY_PATH}`;
}

function openRemoteHome() {
  window.open(REMOTE_HOME, "_blank", "noopener,noreferrer");
}

function makeDuplicate(source, existingRoutines) {
  const codes = blankRoutine(existingRoutines);
  return {
    ...cloneRoutine(source),
    id: codes.id,
    routineId: codes.routineId,
    name: `${codes.id}-${slugify(source.title)}-copy`,
    title: `${source.title} (copy)`,
    segments: source.segments.map((s) => ({ ...s, id: newId("seg") })),
    localOnly: true,
    updatedAt: undefined,
  };
}

export default function Editor({ initialCatalog }) {
  const [catalog, setCatalog] = useState(() => cloneCatalog(initialCatalog));
  const [editDraft, setEditDraft] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuKey, setMenuKey] = useState(null);
  const [status, setStatus] = useState({ kind: "idle", text: "" });
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
  const [draggingRoutine, setDraggingRoutine] = useState(null);
  const [overRoutine, setOverRoutine] = useState(null);
  const dragRoutine = useRef(null);
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

  function openEdit(routine) {
    setEditDraft(cloneRoutine(routine));
    setEditError("");
    setMenuKey(null);
  }

  function closeEdit() {
    setEditDraft(null);
    setEditError("");
  }

  function beginRename(routine) {
    setRenamingId(routine.id);
    setRenameDraft(routine.title);
  }

  async function commitRename(routine) {
    const nextTitle = renameDraft.trim() || routine.title;
    setRenamingId(null);
    if (nextTitle === routine.title) return;

    const updated = {
      ...routine,
      title: nextTitle,
      ...(routine.localOnly
        ? { name: `${routine.id}-${slugify(nextTitle)}` }
        : {}),
    };
    setCatalog({
      ...catalog,
      routines: catalog.routines.map((r) => (r.id === routine.id ? updated : r)),
    });

    if (routine.localOnly) return;

    setBusy(true);
    try {
      const saved = await saveRoutine(toServerRoutine(updated));
      setCatalog(cloneCatalog(saved));
      setToast("Saved");
    } catch (err) {
      setStatus({ kind: "err", text: err.message || "Rename failed" });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editDraft) return;
    setBusy(true);
    setEditError("");
    try {
      const payload = {
        ...editDraft,
        title: editDraft.title.trim() || editDraft.title,
        localOnly: undefined,
      };
      const sent = toServerRoutine(payload);
      const saved = await saveRoutine(sent);
      assertBreakFieldsPersisted(sent, saved);
      setCatalog(cloneCatalog(saved));
      closeEdit();
      setStatus({ kind: "ok", text: "Saved" });
      setToast("Saved");
    } catch (err) {
      setEditError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function handleNew() {
    openEdit(blankRoutine(catalog.routines));
  }

  function handleDuplicate(routine) {
    openEdit(makeDuplicate(routine, catalog.routines));
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
          setCatalog({
            ...catalog,
            routines: catalog.routines.filter((r) => r.id !== routine.id),
          });
          if (editDraft?.id === routine.id) closeEdit();
          setToast("Draft discarded");
          return;
        }
        setBusy(true);
        try {
          const saved = await deleteRoutine(routine.id);
          clearLastRoutineId(routine.id);
          setCatalog(cloneCatalog(saved));
          if (editDraft?.id === routine.id) closeEdit();
          setToast("Deleted");
        } catch (err) {
          setStatus({ kind: "err", text: err.message || "Delete failed" });
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
    setCatalog(nextLocal);

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

  return (
    <div className="clozzz-editor">
      <div className="clozzz-editor__shell">
        <header className="clozzz-editor__top">
          <div className="clozzz-editor__brand">
            <img src="/clozzz/clozzz-logo.png" alt="" width="32" height="32" />
            <h1>Evening exercise routines</h1>
          </div>
          <div className="clozzz-editor__top-actions">
            <ToolsMenu
              onCopyObs={async () => {
                const url = openDisplayUrl();
                try {
                  await navigator.clipboard.writeText(url);
                  setToast("OBS display URL copied");
                } catch {
                  window.prompt("Copy OBS display URL", url);
                }
              }}
              onOpenRemote={openRemoteHome}
            />
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

        <ul className="ce-list">
          {catalog.routines.map((routine) => {
            const renaming = renamingId === routine.id;
            const renameChars = Math.max(renameDraft.length, 1);
            return (
              <li
                key={routine.id}
                className={`ce-item${
                  draggingRoutine === routine.id ? " is-dragging" : ""
                }${
                  overRoutine === routine.id && draggingRoutine !== routine.id
                    ? " is-drag-over"
                    : ""
                }`}
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
                        size={renameChars}
                        style={{ width: `calc(${renameChars}ch + 0.8rem)` }}
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
                    <OverflowMenu
                      open={menuKey === `routine:${routine.id}`}
                      onToggle={() =>
                        setMenuKey((k) =>
                          k === `routine:${routine.id}`
                            ? null
                            : `routine:${routine.id}`
                        )
                      }
                      onClose={() => setMenuKey(null)}
                      items={[
                        {
                          label: "Edit",
                          disabled: busy || !!editDraft,
                          onSelect: () => openEdit(routine),
                        },
                        {
                          label: "Duplicate",
                          disabled: busy || !!editDraft,
                          onSelect: () => handleDuplicate(routine),
                        },
                        {
                          label: "Delete",
                          danger: true,
                          disabled: busy || !!editDraft,
                          onSelect: () => requestDelete(routine),
                        },
                      ]}
                    />
                  </div>
                </div>
              </li>
            );
          })}
          <li className="ce-add-row ce-add-row--list">
            <button
              type="button"
              className="ce-add-row__btn"
              disabled={busy || !!editDraft}
              onClick={handleNew}
            >
              <span className="ce-add-row__plus" aria-hidden="true">
                +
              </span>
              Add new routine
            </button>
          </li>
        </ul>

      </div>

      {editDraft ? (
        <EditRoutineModal
          draft={editDraft}
          busy={busy}
          error={editError}
          onChange={setEditDraft}
          onSave={saveEdit}
          onCancel={closeEdit}
        />
      ) : null}

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
