import React, { useEffect, useMemo, useState } from "react";
import {
  FALLBACK_CATALOG,
  findSessionIn,
  formatDuration,
  normalizeCatalog,
  sessionTotalSec,
} from "./routines.js";
import { ensureLiveToken, fetchCatalog, fetchLive, rememberLiveToken } from "./api.js";
import Editor from "./Editor.jsx";
import Remote from "./Remote.jsx";
import ModeChooser from "./ModeChooser.jsx";
import "./overlay.css";

const LIVE_POLL_MS = 400;

function formatClock(totalSec) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Stamp a live snapshot with the client receive time so remaining time can
 * advance smoothly between polls (serverNowMs alone freezes the clock).
 */
function stampLive(snap) {
  if (!snap || typeof snap !== "object") return snap;
  return { ...snap, _receivedAtMs: Date.now() };
}

export function isEditorPath(location = window.location) {
  const path = location.pathname.replace(/\/+$/, "");
  return /\/clozzz-overlay(?:\.html)?\/edit$/i.test(path);
}

export function isModePath(location = window.location) {
  const path = location.pathname.replace(/\/+$/, "");
  return /\/clozzz-overlay(?:\.html)?\/mode$/i.test(path);
}

export function isRemotePath(location = window.location) {
  const path = location.pathname.replace(/\/+$/, "");
  return /\/clozzz-overlay(?:\.html)?\/[^/]+\/remote$/i.test(path);
}

/** Session key from `?session=` or trailing path after /clozzz-overlay[/].html. */
export function readSessionKey(location = window.location) {
  const fromQuery = new URLSearchParams(location.search).get("session");
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  const path = location.pathname.replace(/\/+$/, "");
  const remoteMatch = path.match(
    /\/clozzz-overlay(?:\.html)?\/([^/]+)\/remote$/i
  );
  if (remoteMatch?.[1]) {
    try {
      return decodeURIComponent(remoteMatch[1]);
    } catch {
      return remoteMatch[1];
    }
  }

  const match = path.match(/\/clozzz-overlay(?:\.html)?(?:\/([^/]+))?$/i);
  if (match?.[1]) {
    let key = match[1];
    try {
      key = decodeURIComponent(match[1]);
    } catch {
      /* keep raw */
    }
    const lower = key.toLowerCase();
    if (lower === "edit" || lower === "mode") return null;
    return key;
  }
  return null;
}

function useStageClass(mode) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "clozzz-stage-dark",
      "clozzz-stage-preview",
      "clozzz-stage-editor",
      "clozzz-stage-remote"
    );
    if (mode === "dark") root.classList.add("clozzz-stage-dark");
    if (mode === "preview") root.classList.add("clozzz-stage-preview");
    if (mode === "editor") root.classList.add("clozzz-stage-editor");
    if (mode === "remote") root.classList.add("clozzz-stage-remote");
    return () => {
      root.classList.remove(
        "clozzz-stage-dark",
        "clozzz-stage-preview",
        "clozzz-stage-editor",
        "clozzz-stage-remote"
      );
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

function SessionNotFound({ keyTried }) {
  useStageClass("editor");
  const home = "/clozzz-overlay";
  return (
    <div className="clozzz-editor">
      <div className="clozzz-editor__shell">
        <BrandLockup />
        <p style={{ marginTop: "1rem" }}>
          Unknown session “{keyTried}”. <a href={home}>Back to routines</a>
        </p>
      </div>
    </div>
  );
}

/**
 * Derive remaining ms from a server LiveRun snapshot + local clock.
 * Skew is fixed at poll receive time (`_receivedAtMs`); wall clock then
 * advances smoothly via rAF without waiting on the next poll.
 */
export function remainingFromLive(live, nowMs = Date.now()) {
  if (!live) return { remainingMs: 0, done: false, armed: true };
  const status = live.status;
  const receivedAt =
    typeof live._receivedAtMs === "number" ? live._receivedAtMs : nowMs;
  const skew =
    typeof live.serverNowMs === "number" ? receivedAt - live.serverNowMs : 0;
  const serverNow = nowMs - skew;

  if (status === "countdown") {
    const durationMs = (live.countdownDurationSec || 180) * 1000;
    if (live.countdownStartedAtMs != null) {
      const elapsed = serverNow - live.countdownStartedAtMs;
      return {
        remainingMs: Math.max(0, durationMs - elapsed),
        done: false,
        armed: false,
        countdown: true,
        durationMs,
      };
    }
    return {
      remainingMs: durationMs,
      done: false,
      armed: false,
      countdown: true,
      durationMs,
    };
  }

  if (status === "stream_ended") {
    const durationMs =
      (live.streamEndedDurationSec || live.streamEndedSec || 45) * 1000;
    if (live.streamEndedStartedAtMs != null) {
      const elapsed = serverNow - live.streamEndedStartedAtMs;
      return {
        remainingMs: Math.max(0, durationMs - elapsed),
        done: false,
        armed: false,
        streamEnded: true,
        durationMs,
      };
    }
    return {
      remainingMs: durationMs,
      done: false,
      armed: false,
      streamEnded: true,
      durationMs,
    };
  }

  const durationMs = (live.segmentDurationSec || 0) * 1000;

  if (status === "done") {
    return { remainingMs: 0, done: true, armed: false };
  }
  if (status === "idle" || status === "paused") {
    const rem =
      typeof live.pausedRemainingMs === "number"
        ? live.pausedRemainingMs
        : durationMs;
    return {
      remainingMs: Math.max(0, rem),
      done: false,
      armed: status === "idle",
      paused: status === "paused",
    };
  }
  if (status === "running" && live.segmentStartedAtMs != null) {
    const elapsed = serverNow - live.segmentStartedAtMs;
    return {
      remainingMs: Math.max(0, durationMs - elapsed),
      done: false,
      armed: false,
      paused: false,
    };
  }
  return { remainingMs: durationMs, done: false, armed: true };
}

function CountdownStage({ remainingSec, durationMs, remainingMs, title }) {
  const progress =
    durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0;
  const critical = remainingSec <= 10;

  return (
    <div className="clozzz-countdown" aria-live="polite">
      <video
        className="clozzz-countdown__bg"
        src="/clozzz/bg1.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="clozzz-countdown__veil" aria-hidden="true" />
      <header className="clozzz-countdown__brand">
        <BrandLockup backed />
      </header>
      <div className="clozzz-countdown__center">
        <p className="clozzz-countdown__eyebrow">Starting soon</p>
        <div
          className={`clozzz-countdown__ring${critical ? " clozzz-countdown__ring--critical" : ""}`}
          style={{ "--clozzz-cd-progress": progress }}
        >
          <div className="clozzz-countdown__face">
            <span className="clozzz-countdown__digits">
              {formatClock(remainingSec)}
            </span>
          </div>
        </div>
        <p className="clozzz-countdown__title">{title}</p>
      </div>
    </div>
  );
}

function StreamEndedStage({ remainingSec, durationMs, remainingMs, title, message }) {
  const progress =
    durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0;
  return (
    <div className="clozzz-countdown clozzz-countdown--ended" aria-live="polite">
      <video
        className="clozzz-countdown__bg"
        src="/clozzz/bg1.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="clozzz-countdown__veil" aria-hidden="true" />
      <header className="clozzz-countdown__brand">
        <BrandLockup backed />
      </header>
      <div className="clozzz-countdown__center">
        <p className="clozzz-countdown__eyebrow">Stream ended</p>
        <div
          className="clozzz-countdown__ring"
          style={{ "--clozzz-cd-progress": progress }}
        >
          <div className="clozzz-countdown__face">
            <span className="clozzz-countdown__digits">
              {formatClock(remainingSec)}
            </span>
          </div>
        </div>
        <p className="clozzz-countdown__title">
          {message || title || "Thanks for watching"}
        </p>
      </div>
    </div>
  );
}

function RunningOverlay({ session, sessionKey }) {
  useStageClass(wantsPreview() ? "preview" : null);
  const [live, setLive] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      fetchLive(sessionKey)
        .then((snap) => {
          if (!cancelled) setLive(stampLive(snap));
        })
        .catch(() => {
          /* keep last snapshot */
        });
    };
    pull();
    const poll = setInterval(pull, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [sessionKey]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const derived = remainingFromLive(live, now);
  const index = live?.segmentIndex ?? 0;
  const segments = live?.segments?.length
    ? live.segments
    : session.segments;
  const done = derived.done || live?.status === "done";
  const current = segments[index] || session.segments[0];
  const next = done ? null : segments[index + 1] ?? null;
  const durationMs = (current?.durationSec || live?.segmentDurationSec || 0) * 1000;
  const progress =
    current && !done && durationMs > 0
      ? Math.min(1, Math.max(0, derived.remainingMs / durationMs))
      : 0;
  const remainingSec = derived.remainingMs / 1000;
  const band = timerBand(progress, remainingSec, done);
  const armed = derived.armed && !done;
  const chromeVisible = live?.chromeVisible !== false;
  const inCountdown = Boolean(derived.countdown);
  const inStreamEnded = Boolean(derived.streamEnded);

  if (inCountdown) {
    return (
      <CountdownStage
        remainingSec={remainingSec}
        remainingMs={derived.remainingMs}
        durationMs={derived.durationMs || 180000}
        title={live?.title || session.title || session.name}
      />
    );
  }

  if (inStreamEnded) {
    return (
      <StreamEndedStage
        remainingSec={remainingSec}
        remainingMs={derived.remainingMs}
        durationMs={derived.durationMs || 45000}
        title={live?.title || session.title || session.name}
        message={live?.streamEndedMessage}
      />
    );
  }

  return (
    <div className="clozzz-overlay clozzz-overlay--live" aria-live="polite">
      <header className="clozzz-corner clozzz-corner--tl">
        <BrandLockup backed />
      </header>

      {chromeVisible ? (
        <>
          <div className="clozzz-corner clozzz-corner--tr">
            <div
              className={`clozzz-timer clozzz-timer--${band}${armed ? " clozzz-timer--armed" : ""}${derived.paused ? " clozzz-timer--paused" : ""}`}
              style={{
                "--clozzz-elapsed": done
                  ? 1
                  : Math.min(1, Math.max(0, 1 - progress)),
              }}
            >
              <TimerIcon />
              <span className="clozzz-timer__value">
                {done ? "0:00" : formatClock(remainingSec)}
              </span>
            </div>
          </div>

          <section className="clozzz-corner clozzz-corner--bl clozzz-current-panel">
            {done ? (
              <>
                <h1 className="clozzz-current clozzz-anim" key="done-title">
                  Routine complete
                </h1>
                <p className="clozzz-exercise-count">
                  {segments.length} exercises ·{" "}
                  {formatDuration(sessionTotalSec({ segments }))}
                </p>
              </>
            ) : (
              <>
                <h1
                  className="clozzz-current clozzz-anim"
                  key={current?.id || index}
                >
                  {current?.label || live?.currentLabel || "…"}
                </h1>
                <p className="clozzz-exercise-count">
                  Exercise {index + 1} of {segments.length}
                  {armed
                    ? " · Waiting for Start"
                    : derived.paused
                      ? " · Paused"
                      : ""}
                </p>
                <p className="clozzz-up-next">
                  {next ? `Up next: ${next.label}` : "Up next: Rest"}
                </p>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function useCatalog() {
  const [catalog, setCatalog] = useState(() => normalizeCatalog(FALLBACK_CATALOG));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((data) => {
        if (!cancelled && data?.routines?.length) {
          setCatalog(normalizeCatalog(data));
        }
      })
      .catch(() => {
        /* keep bundled fallback */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, ready };
}

function LibraryApp({ catalog: initial }) {
  useStageClass("editor");
  return <Editor initialCatalog={initial} />;
}

function LibraryLoading() {
  useStageClass("editor");
  return (
    <div className="clozzz-editor">
      <div className="clozzz-editor__shell">
        <p>Loading routines…</p>
      </div>
    </div>
  );
}

function RemoteApp({ sessionKey, catalog }) {
  useStageClass("remote");
  useEffect(() => {
    ensureLiveToken();
  }, []);
  const session = findSessionIn(catalog.routines, sessionKey);
  return (
    <Remote
      sessionKey={session?.id || sessionKey}
      sessionTitle={session?.title}
    />
  );
}

function ChooserApp({ catalog }) {
  useStageClass("editor");
  return <ModeChooser catalog={catalog} />;
}

export default function Overlay() {
  const [sessionKey, setSessionKey] = useState(() => readSessionKey());
  const [remote, setRemote] = useState(() => isRemotePath());
  const [modePage, setModePage] = useState(() => isModePath());
  const { catalog, ready } = useCatalog();

  useEffect(() => {
    // Capture liveToken if auth page left it on the URL hash/query (legacy) —
    // primary path is unlock JSON + ensureLiveToken.
    ensureLiveToken().then((token) => {
      if (token) rememberLiveToken(token);
    });
  }, []);

  useEffect(() => {
    // Old /edit URL → library at base route.
    if (isEditorPath()) {
      window.history.replaceState({}, "", "/clozzz-overlay");
      setSessionKey(null);
      setRemote(false);
      setModePage(false);
    }
    const sync = () => {
      setSessionKey(readSessionKey());
      setRemote(isRemotePath());
      setModePage(isModePath());
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const resolvedSession = useMemo(() => {
    if (!sessionKey) return null;
    return findSessionIn(catalog.routines, sessionKey);
  }, [catalog, sessionKey]);

  if (!ready) {
    if (sessionKey && !remote && !modePage) {
      return <div className="clozzz-overlay clozzz-overlay--live" aria-busy="true" />;
    }
    return <LibraryLoading />;
  }

  if (modePage) {
    return <ChooserApp catalog={catalog} />;
  }

  if (!sessionKey) {
    return <LibraryApp catalog={catalog} />;
  }

  if (!resolvedSession) {
    return <SessionNotFound keyTried={sessionKey} />;
  }

  if (remote) {
    return (
      <RemoteApp sessionKey={resolvedSession.id} catalog={catalog} />
    );
  }

  return (
    <RunningOverlay
      key={resolvedSession.id}
      session={resolvedSession}
      sessionKey={resolvedSession.id}
    />
  );
}
