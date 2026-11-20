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

/** Timer urgency band from remaining fraction of the segment. */
function timerBand(progress, remainingSec, done) {
  if (done) return "done";
  if (remainingSec <= 5) return "critical";
  if (remainingSec <= 10 || progress <= 0.18) return "warn";
  if (progress <= 0.4) return "late";
  return "calm";
}

function BrandLockup({ backed = false }) {
  return (
    <div className={`clozzz-brand${backed ? " clozzz-brand--backed" : ""}`}>
      <span className="clozzz-brand__mark" aria-hidden="true">
        <img
          className="clozzz-brand__logo"
          src="/clozzz/clozzz-logo.png"
          alt=""
          width="40"
          height="40"
          decoding="async"
        />
      </span>
      <span className="clozzz-brand__text">
        <span className="clozzz-brand__name">Clozzz Sleep</span>
      </span>
    </div>
  );
}

function MetaChips({ routineId, space, showSpace = true }) {
  return (
    <div className="clozzz-chips" aria-label="Session meta">
      <span className="clozzz-chip clozzz-chip--routine">{routineId}</span>
      {showSpace ? (
        <span className="clozzz-chip clozzz-chip--space">
          <svg
            className="clozzz-chip__icon"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              d="M2.5 13.5h11M4 13.5V5.8L8 2.5l4 3.3v7.7M6.2 13.5V9.2h3.6v4.3"
            />
          </svg>
          {space}
        </span>
      ) : null}
    </div>
  );
}

function TimerIcon() {
  return (
    <svg
      className="clozzz-timer__icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="13"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        d="M12 9.5v3.7l2.2 1.4M9.5 4.2h5"
      />
    </svg>
  );
}

function SessionPicker() {
  useStageClass("dark");
  return (
    <div className="clozzz-overlay clozzz-overlay--picker">
      <BrandLockup />
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
                  {session.space} · {session.name} · {session.segments.length}{" "}
                  segments · {formatDuration(total)}
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
  const home = "/clozzz-overlay";
  return (
    <div className="clozzz-overlay clozzz-overlay--picker">
      <BrandLockup />
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
  const band = timerBand(progress, remainingSec, done);

  return (
    <div className="clozzz-overlay clozzz-overlay--live" aria-live="polite">
      <header className="clozzz-corner clozzz-corner--tl">
        <BrandLockup backed />
      </header>

      <div className="clozzz-corner clozzz-corner--tr">
        <div className={`clozzz-timer clozzz-timer--${band}`}>
          <TimerIcon />
          <span className="clozzz-timer__value">
            {done ? "0:00" : formatClock(remainingSec)}
          </span>
          <span
            className="clozzz-timer__ring"
            style={{ "--clozzz-progress": progress }}
            aria-hidden="true"
          />
        </div>
      </div>

      <section className="clozzz-corner clozzz-corner--bl clozzz-current-panel">
        {done ? (
          <>
            <h1 className="clozzz-current clozzz-anim" key="done-title">
              Routine complete
            </h1>
            <p className="clozzz-exercise-count">
              {session.segments.length} exercises ·{" "}
              {formatDuration(sessionTotalSec(session))}
            </p>
          </>
        ) : (
          <>
            <h1 className="clozzz-current clozzz-anim" key={current.id}>
              {current.label}
            </h1>
            <p className="clozzz-exercise-count">
              Exercise {index + 1} of {session.segments.length}
            </p>
            <p className="clozzz-up-next">
              {next ? `Up next: ${next.label}` : "Up next: Rest"}
            </p>
          </>
        )}
      </section>
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
