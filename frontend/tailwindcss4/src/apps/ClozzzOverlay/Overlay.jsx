import React, { useEffect, useState } from "react";
import { SESSIONS, findSession, sessionTotalSec } from "./routines.js";
import "./overlay.css";

function formatClock(totalSec) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(totalSec) {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** Session key from `?session=` or trailing path after /clozzz-overlay[/].html. */
export function readSessionKey(location = window.location) {
  const fromQuery = new URLSearchParams(location.search).get("session");
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  const path = location.pathname.replace(/\/+$/, "");
  const match = path.match(/\/clozzz-overlay(?:\.html)?(?:\/([^/]+))?$/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

function sessionHref(key) {
  const path = window.location.pathname;
  if (/clozzz-overlay\.html/i.test(path)) {
    return `?session=${encodeURIComponent(key)}`;
  }
  return `/clozzz-overlay/${encodeURIComponent(key)}`;
}

function useStageClass(mode) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("clozzz-stage-dark", "clozzz-stage-preview");
    if (mode === "dark") root.classList.add("clozzz-stage-dark");
    if (mode === "preview") root.classList.add("clozzz-stage-preview");
    return () => {
      root.classList.remove("clozzz-stage-dark", "clozzz-stage-preview");
    };
  }, [mode]);
}

function wantsPreview(location = window.location) {
  return new URLSearchParams(location.search).get("preview") === "1";
}

function SessionPicker() {
  useStageClass("dark");
  return (
    <div className="clozzz-overlay clozzz-overlay--picker">
      <p className="clozzz-kicker">Clozzz</p>
      <h1 className="clozzz-picker-title">OBS overlay sessions</h1>
      <p className="clozzz-picker-lead">
        Pick a named session for Browser Source, or open{" "}
        <code>/clozzz-overlay/&lt;id-or-name&gt;</code> (or{" "}
        <code>?session=</code>) directly. Timers auto-advance; no on-screen
        controls in v1.
      </p>
      <ul className="clozzz-session-list">
        {SESSIONS.map((session) => {
          const total = sessionTotalSec(session);
          return (
            <li key={session.id}>
              <a href={sessionHref(session.id)}>
                <strong>
                  {session.routineId} — {session.title}
                </strong>
                <span>
                  {session.name} · {session.segments.length} segments ·{" "}
                  {formatDuration(total)} · {session.intent}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionNotFound({ keyTried }) {
  useStageClass("dark");
  const home =
    /clozzz-overlay\.html/i.test(window.location.pathname)
      ? window.location.pathname
      : "/clozzz-overlay";
  return (
    <div className="clozzz-overlay clozzz-overlay--picker">
      <p className="clozzz-kicker">Clozzz</p>
      <p className="clozzz-error">
        Unknown session “{keyTried}”. <a href={home}>Browse sessions</a>
      </p>
    </div>
  );
}

function RunningOverlay({ session }) {
  useStageClass(wantsPreview() ? "preview" : null);
  const [index, setIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(
    () => session.segments[0].durationSec * 1000
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let segmentIndex = 0;
    let segmentStarted = performance.now();
    let raf = 0;

    setIndex(0);
    setRemainingMs(session.segments[0].durationSec * 1000);
    setDone(false);

    const tick = (now) => {
      if (cancelled) return;

      const seg = session.segments[segmentIndex];
      const durationMs = seg.durationSec * 1000;
      const elapsed = now - segmentStarted;

      if (elapsed >= durationMs) {
        if (segmentIndex + 1 >= session.segments.length) {
          setIndex(segmentIndex);
          setRemainingMs(0);
          setDone(true);
          return;
        }
        segmentIndex += 1;
        segmentStarted = now;
        const nextSeg = session.segments[segmentIndex];
        setIndex(segmentIndex);
        setRemainingMs(nextSeg.durationSec * 1000);
      } else {
        setRemainingMs(durationMs - elapsed);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [session]);

  const current = session.segments[index];
  const next = done ? null : session.segments[index + 1] ?? null;
  const progress =
    current && !done
      ? Math.min(1, Math.max(0, remainingMs / (current.durationSec * 1000)))
      : 0;
  const remainingSec = remainingMs / 1000;
  const warn = !done && remainingSec <= 10;

  return (
    <div className="clozzz-overlay" aria-live="polite">
      <p className="clozzz-kicker">
        {session.routineId} · {session.title}
      </p>

      {done ? (
        <>
          <h1 className="clozzz-current clozzz-anim" key="done-title">
            Routine complete
          </h1>
          <p className="clozzz-timer clozzz-timer--done">Nice work</p>
          <p className="clozzz-meta">
            {session.segments.length} segments ·{" "}
            {formatDuration(sessionTotalSec(session))} total
          </p>
        </>
      ) : (
        <>
          <h1 className="clozzz-current clozzz-anim" key={current.id}>
            {current.label}
          </h1>
          {current.cue ? <p className="clozzz-cue">{current.cue}</p> : null}
          <p
            className={`clozzz-timer${warn ? " clozzz-timer--warn" : ""}`}
          >
            {formatClock(remainingSec)}
          </p>
          <div className="clozzz-progress" aria-hidden="true">
            <div
              className="clozzz-progress__bar"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <p className="clozzz-meta">
            Segment {index + 1} / {session.segments.length}
          </p>
        </>
      )}

      {next ? (
        <aside className="clozzz-next">
          <p className="clozzz-next__label">Next</p>
          <p className="clozzz-next__title">{next.label}</p>
          <p className="clozzz-next__time">{formatClock(next.durationSec)}</p>
        </aside>
      ) : null}
    </div>
  );
}

export default function Overlay() {
  const [sessionKey, setSessionKey] = useState(() => readSessionKey());

  useEffect(() => {
    const sync = () => setSessionKey(readSessionKey());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  if (!sessionKey) {
    return <SessionPicker />;
  }

  const session = findSession(sessionKey);
  if (!session) {
    return <SessionNotFound keyTried={sessionKey} />;
  }

  return <RunningOverlay key={session.id} session={session} />;
}
