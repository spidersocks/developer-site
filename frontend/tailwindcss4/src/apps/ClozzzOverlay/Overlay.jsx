import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FALLBACK_CATALOG,
  findSessionIn,
  formatDuration,
  normalizeCatalog,
  sessionTotalSec,
} from "./routines.js";
import {
  ensureLiveToken,
  fetchCatalog,
  fetchLive,
  fetchStudioDisplay,
  rememberLiveToken,
} from "./api.js";
import Editor from "./Editor.jsx";
import Remote, {
  canonicalizeRemoteUrl,
  clearLastRoutineId,
  readLastRoutineId,
  rememberLastRoutineId,
  resolveChannelId,
} from "./Remote.jsx";
import ModeChooser from "./ModeChooser.jsx";
import { applyClozzzPwa, detectClozzzPwaSurface } from "./pwa.js";
import "./overlay.css";

const LIVE_POLL_MS = 400;
const OPEN_DISPLAY = "/clozzz-overlay";
const REMOTE_HOME = "/clozzz-remote";
const ROUTINES_HOME = "/clozzz-routines";

function formatClock(totalSec) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Padded MM:SS for full-screen countdown stages (TimerHub-style). */
function formatClockPad(totalSec) {
  const sec = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Stamp a live snapshot with the client receive time so remaining time can
 * advance smoothly between polls (serverNowMs alone freezes the clock).
 */
function stampLive(snap) {
  if (!snap || typeof snap !== "object") return snap;
  return { ...snap, _receivedAtMs: Date.now() };
}

function normalizePath(location = window.location) {
  return location.pathname.replace(/\/+$/, "") || "/";
}

/** Password-gated routine library + editor. */
export function isRoutinesSurface(location = window.location) {
  const path = normalizePath(location);
  return path === ROUTINES_HOME || path.startsWith(`${ROUTINES_HOME}/`);
}

/** Password-gated control surface (remote / mode). */
export function isRemoteSurface(location = window.location) {
  const path = normalizePath(location);
  return (
    path === REMOTE_HOME ||
    path.startsWith(`${REMOTE_HOME}/`) ||
    // Legacy per-routine remote under overlay → still treat as remote surface.
    /\/clozzz-overlay(?:\.html)?\/[^/]+\/remote$/i.test(path)
  );
}

/** Open dumb OBS display (no editor/remote chrome). */
export function isOpenDisplayPath(location = window.location) {
  const path = normalizePath(location);
  if (isRemoteSurface(location) || isRoutinesSurface(location)) return false;
  return (
    path === OPEN_DISPLAY ||
    path === `${OPEN_DISPLAY}.html` ||
    path.startsWith(`${OPEN_DISPLAY}/`) ||
    path.startsWith(`${OPEN_DISPLAY}.html/`)
  );
}

export function isEditorPath(location = window.location) {
  const path = normalizePath(location);
  return (
    /\/clozzz-routines\/edit$/i.test(path) ||
    /\/clozzz-remote\/edit$/i.test(path) ||
    /\/clozzz-overlay(?:\.html)?\/edit$/i.test(path)
  );
}

export function isModePath(location = window.location) {
  const path = normalizePath(location);
  return (
    /\/clozzz-remote\/mode$/i.test(path) ||
    /\/clozzz-overlay(?:\.html)?\/mode$/i.test(path)
  );
}

/** Bare `/clozzz-remote` — single control surface (channel from memory/state). */
export function isBareRemotePath(location = window.location) {
  return normalizePath(location) === REMOTE_HOME;
}

/** Decode a single path segment. */
function decodeSeg(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Deep-link / legacy routine id only — product URL is bare `/clozzz-remote`.
 * From `?session=`, `/clozzz-remote/<id>`, or legacy `/clozzz-overlay/<id>/remote`.
 */
export function readSessionKey(location = window.location) {
  const fromQuery = new URLSearchParams(location.search).get("session");
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  const path = normalizePath(location);

  const legacyRemote = path.match(
    /\/clozzz-overlay(?:\.html)?\/([^/]+)\/remote$/i
  );
  if (legacyRemote?.[1]) return decodeSeg(legacyRemote[1]);

  const remote = path.match(/^\/clozzz-remote\/([^/]+)(?:\/remote)?$/i);
  if (remote?.[1]) {
    const key = decodeSeg(remote[1]);
    const lower = key.toLowerCase();
    if (lower === "edit" || lower === "mode") return null;
    return key;
  }

  return null;
}

/** True when path is a per-id remote deep link that should fold into bare remote. */
export function isRemoteDeepLink(location = window.location) {
  return Boolean(readSessionKey(location)) && !isBareRemotePath(location);
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

function BrandLockup({ backed = false, quiet = false, iconOnly = false }) {
  return (
    <div
      className={`clozzz-brand${backed ? " clozzz-brand--backed" : ""}${quiet ? " clozzz-brand--quiet" : ""}${iconOnly ? " clozzz-brand--icon-only" : ""}`}
      aria-label={iconOnly ? "Clozzz Sleep" : undefined}
    >
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
      {iconOnly ? null : (
        <span className="clozzz-brand__text">
          <span className="clozzz-brand__name">Clozzz Sleep</span>
        </span>
      )}
    </div>
  );
}

/** Soft opacity crossfade for exercise name (no flash / translate pulse). */
function CrossfadeTitle({ text }) {
  const [shown, setShown] = useState(text);
  const [outgoing, setOutgoing] = useState(null);

  useEffect(() => {
    if (text === shown) return undefined;
    setOutgoing(shown);
    setShown(text);
    const t = window.setTimeout(() => setOutgoing(null), 420);
    return () => window.clearTimeout(t);
  }, [text, shown]);

  return (
    <span className="clozzz-crossfade">
      {outgoing != null ? (
        <span
          className="clozzz-current clozzz-crossfade__layer is-out"
          aria-hidden="true"
        >
          {outgoing}
        </span>
      ) : null}
      <h1 className="clozzz-current clozzz-crossfade__layer is-in">{shown}</h1>
    </span>
  );
}

function SessionNotFound({ keyTried }) {
  useStageClass("editor");
  return (
    <div className="clozzz-editor">
      <div className="clozzz-editor__shell">
        <BrandLockup />
        <p style={{ marginTop: "1rem" }}>
          Unknown session “{keyTried}”.{" "}
          <a href={ROUTINES_HOME}>Back to routines</a>
        </p>
      </div>
    </div>
  );
}

/** Elegant idle when no channel is selected yet. */
function WaitingChannel() {
  useStageClass("dark");
  return (
    <div className="clozzz-overlay clozzz-overlay--live clozzz-overlay--waiting" aria-live="polite">
      <header className="clozzz-corner clozzz-corner--tl">
        <BrandLockup backed />
      </header>
      <div className="clozzz-waiting">
        <p className="clozzz-waiting__label">Waiting for channel</p>
        <p className="clozzz-waiting__hint">
          Select a routine on the remote — this display follows.
        </p>
      </div>
    </div>
  );
}

/**
 * Derive remaining ms from a server LiveRun snapshot + local clock.
 * Skew is fixed at poll receive time (`_receivedAtMs`); wall clock then
 * advances smoothly via rAF without waiting on the next poll.
 *
 * @param {object | null} live
 * @param {number} [nowMs]
 * @param {{ introCountdownEnabled?: boolean, introCountdownSec?: number } | null} [sessionHints]
 *        Catalog routine flags — used before the first poll and to bridge
 *        stale in-memory live runs that lag an editor toggle.
 */
export function remainingFromLive(
  live,
  nowMs = Date.now(),
  sessionHints = null
) {
  const hintIntro = Boolean(sessionHints?.introCountdownEnabled);
  const hintIntroSec =
    sessionHints?.introCountdownSec ||
    sessionHints?.countdownDurationSec ||
    1800;

  if (!live) {
    if (hintIntro) {
      const introMs = hintIntroSec * 1000;
      return {
        remainingMs: introMs,
        done: false,
        armed: false,
        countdown: true,
        countdownHeld: true,
        durationMs: introMs,
      };
    }
    return { remainingMs: 0, done: false, armed: true };
  }
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
    /* Soft cap ~1h for auto-finish; UI counts up until then / remote skip. */
    const durationMs =
      (live.streamEndedDurationSec || live.streamEndedSec || 3600) * 1000;
    if (live.streamEndedStartedAtMs != null) {
      const elapsed = Math.max(0, serverNow - live.streamEndedStartedAtMs);
      return {
        remainingMs: Math.max(0, durationMs - elapsed),
        /* Count-up display: elapsed since stream ended (not remaining). */
        elapsedMs: elapsed,
        done: false,
        armed: false,
        streamEnded: true,
        durationMs,
      };
    }
    return {
      remainingMs: durationMs,
      elapsedMs: 0,
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
    // Pre-stream intro armed but not started: hold frozen countdown at max.
    // OR catalog hint when live snapshot still has a stale false flag.
    const introEnabled =
      Boolean(live.introCountdownEnabled) ||
      (status === "idle" && !live.introConsumed && hintIntro);
    if (status === "idle" && introEnabled && !live.introConsumed) {
      const introMs =
        (live.countdownDurationSec ||
          live.introCountdownSec ||
          hintIntroSec ||
          1800) * 1000;
      return {
        remainingMs: introMs,
        done: false,
        armed: false,
        countdown: true,
        countdownHeld: true,
        durationMs: introMs,
      };
    }
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

/** Progressive bg: instant cool gradient → first-frame still → looping video. */
function CountdownBackdrop() {
  const [stillReady, setStillReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  return (
    <>
      <div className="clozzz-countdown__gradient" aria-hidden="true" />
      <img
        className={`clozzz-countdown__still${stillReady ? " is-ready" : ""}`}
        src="/clozzz/bg1.webp"
        alt=""
        decoding="async"
        fetchPriority="high"
        onLoad={() => setStillReady(true)}
      />
      <video
        className={`clozzz-countdown__bg${videoReady ? " is-ready" : ""}`}
        src="/clozzz/bg1.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setVideoReady(true)}
        onPlaying={() => setVideoReady(true)}
      />
    </>
  );
}

/** Premium SVG ring — 12 o'clock origin, elapsed gold fill grows clockwise. */
function TimerProgressRing({ progress, className = "clozzz-timer-ring" }) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  /* Inset so round caps clear the viewBox; Calm/Fitness-style thin stroke. */
  const r = 17.1;
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="clozzz-timer-ring__track" cx="20" cy="20" r={r} />
      <circle
        className="clozzz-timer-ring__sweep"
        cx="20"
        cy="20"
        r={r}
        pathLength={1}
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 1 - p,
        }}
      />
    </svg>
  );
}

function CountdownStage({
  remainingSec,
  title,
  message,
  held = false,
}) {
  const critical = !held && remainingSec <= 10;
  const trimmed = message && String(message).trim();
  const beginsLabel =
    trimmed || (title ? `${title} begins in` : "Begins in");

  return (
    <div
      className={`clozzz-countdown clozzz-countdown--soon${critical ? " is-critical" : ""}${held ? " is-held" : ""}`}
      aria-live="polite"
    >
      <CountdownBackdrop />
      <div className="clozzz-countdown__veil" aria-hidden="true" />
      <header className="clozzz-countdown__brand">
        <BrandLockup />
      </header>
      <div className="clozzz-countdown__center clozzz-countdown__center--minimal">
        <p className="clozzz-countdown__label">{beginsLabel}</p>
        <div className="clozzz-countdown__timer-block">
          <p className="clozzz-countdown__clock">{formatClockPad(remainingSec)}</p>
        </div>
      </div>
    </div>
  );
}

function StreamEndedStage({ elapsedSec, title, message }) {
  /* Same typography language as stream-starting: message/routine line + ivory timer. */
  const trimmed = message && String(message).trim();
  const label =
    trimmed ||
    (title ? `${title} has ended` : "Stream ended");

  return (
    <div
      className="clozzz-countdown clozzz-countdown--ended"
      aria-live="polite"
    >
      <CountdownBackdrop />
      <div className="clozzz-countdown__veil" aria-hidden="true" />
      <header className="clozzz-countdown__brand">
        <BrandLockup />
      </header>
      <div className="clozzz-countdown__center clozzz-countdown__center--minimal">
        <p className="clozzz-countdown__label">{label}</p>
        <div className="clozzz-countdown__timer-block">
          <p className="clozzz-countdown__clock">
            {formatClockPad(elapsedSec)}
          </p>
        </div>
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

  const derived = remainingFromLive(live, now, session);
  const index = live?.segmentIndex ?? 0;
  const segments = live?.segments?.length
    ? live.segments
    : session.segments;
  const done = derived.done || live?.status === "done";
  const current = segments[index] || session.segments[0];
  const next = done ? null : segments[index + 1] ?? null;
  const durationMs = (current?.durationSec || live?.segmentDurationSec || 0) * 1000;
  const remainingFrac =
    current && !done && durationMs > 0
      ? Math.min(1, Math.max(0, derived.remainingMs / durationMs))
      : 0;
  /** Elapsed fraction — gold arc grows from 12:00 clockwise as time passes. */
  const elapsedFrac =
    current && !done && durationMs > 0 ? 1 - remainingFrac : done ? 1 : 0;
  const remainingSec = derived.remainingMs / 1000;
  const band = timerBand(remainingFrac, remainingSec, done);
  const armed = derived.armed && !done;
  const chromeVisible = live?.chromeVisible !== false;
  const inCountdown = Boolean(derived.countdown);
  const inStreamEnded = Boolean(derived.streamEnded);

  if (inCountdown) {
    return (
      <CountdownStage
        remainingSec={remainingSec}
        title={live?.title || session.title || session.name}
        message={
          live?.introCountdownMessage ?? session.introCountdownMessage
        }
        held={Boolean(derived.countdownHeld)}
      />
    );
  }

  if (inStreamEnded) {
    return (
      <StreamEndedStage
        elapsedSec={(derived.elapsedMs || 0) / 1000}
        title={live?.title || session.title || session.name}
        message={live?.streamEndedMessage}
      />
    );
  }

  const moveLabel = current?.label || live?.currentLabel || "…";
  const nextCue = next?.label || "Rest";
  const timerText = done ? "0:00" : formatClock(remainingSec);

  return (
    <div className="clozzz-overlay clozzz-overlay--live" aria-live="polite">
      <header className="clozzz-corner clozzz-corner--tl">
        <BrandLockup quiet iconOnly />
      </header>

      {chromeVisible ? (
        <section className="clozzz-corner clozzz-corner--bl clozzz-current-panel">
          {done ? (
            <>
              <div className="clozzz-move-copy">
                <p className="clozzz-exercise-count">
                  {segments.length} exercises ·{" "}
                  {formatDuration(sessionTotalSec({ segments }))}
                </p>
                <h1 className="clozzz-current">Routine complete</h1>
              </div>
              <span
                className={`clozzz-card-timer clozzz-card-timer--${band}`}
                style={{ "--clozzz-timer-p": 1 }}
              >
                <TimerProgressRing progress={1} />
                <span className="clozzz-card-timer__digits">{timerText}</span>
              </span>
            </>
          ) : (
            <>
              <div className="clozzz-move-copy">
                <p className="clozzz-exercise-count">
                  Exercise {index + 1} of {segments.length}
                  {derived.paused ? " · Paused" : ""}
                </p>
                <CrossfadeTitle text={moveLabel} />
                <p className="clozzz-up-next">Next: {nextCue}</p>
              </div>
              <span
                className={`clozzz-card-timer clozzz-card-timer--${band}${armed ? " is-armed" : ""}${derived.paused ? " is-paused" : ""}`}
                style={{ "--clozzz-timer-p": elapsedFrac }}
              >
                <TimerProgressRing progress={elapsedFrac} />
                <span className="clozzz-card-timer__digits">{timerText}</span>
              </span>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function useCatalog({ refreshKey = 0 } = {}) {
  const [catalog, setCatalog] = useState(() => normalizeCatalog(FALLBACK_CATALOG));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((data) => {
        // Accept empty lists too — otherwise a deleted seed/fallback id can linger.
        if (!cancelled && data && Array.isArray(data.routines)) {
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
  }, [refreshKey]);

  return { catalog, ready, setCatalog };
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

function RemoteApp({ sessionKey, catalog, onChannelChange }) {
  useStageClass("remote");
  useEffect(() => {
    ensureLiveToken();
  }, []);
  const routines = catalog.routines || [];
  const session = findSessionIn(routines, sessionKey);
  // If the active id vanished between renders, hop to a real channel.
  useEffect(() => {
    if (session) return;
    const fallback = resolveChannelId(null, routines);
    onChannelChange(fallback);
  }, [session, sessionKey, catalog.routines, onChannelChange]);
  if (!session) return <LibraryLoading />;
  return (
    <Remote
      sessionKey={session.id}
      sessionTitle={session.title}
      introCountdownEnabled={Boolean(session.introCountdownEnabled)}
      routines={routines}
      onChannelChange={onChannelChange}
    />
  );
}

function ChooserApp({ catalog }) {
  useStageClass("editor");
  return <ModeChooser catalog={catalog} />;
}

/**
 * Open dumb display — always follows server active channel.
 * Fixed URL for OBS; no editor / remote / mode chooser here.
 * Polls /studio/display so a remote channel switch remounts without
 * changing the Browser Source URL.
 */
function OpenDisplayApp() {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      fetchStudioDisplay()
        .then((data) => {
          if (!cancelled) setPayload(data);
        })
        .catch(() => {
          /* keep last */
        });
    };
    pull();
    const poll = setInterval(pull, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  if (!payload) {
    return <div className="clozzz-overlay clozzz-overlay--live" aria-busy="true" />;
  }

  const rid = payload.activeRoutineId;
  const routine = payload.routine;
  if (!rid || !routine) {
    return <WaitingChannel />;
  }

  const session = {
    id: routine.id,
    name: routine.name || routine.id,
    title: routine.title || routine.name || routine.id,
    introCountdownEnabled: Boolean(routine.introCountdownEnabled),
    introCountdownSec: routine.introCountdownSec,
    introCountdownMessage: routine.introCountdownMessage || "",
    segments: routine.segments || [],
  };

  return (
    <RunningOverlay
      key={session.id}
      session={session}
      sessionKey={session.id}
    />
  );
}

export default function Overlay() {
  const deepLinkKey = readSessionKey();
  const [sessionKey, setSessionKey] = useState(() => deepLinkKey || null);
  const [remoteSurface, setRemoteSurface] = useState(() => isRemoteSurface());
  const [bareRemote, setBareRemote] = useState(() => isBareRemotePath());
  const [routinesPage, setRoutinesPage] = useState(() => isRoutinesSurface());
  const [modePage, setModePage] = useState(() => isModePath());
  const [openDisplay, setOpenDisplay] = useState(() => isOpenDisplayPath());
  /** True once a channel is chosen for the single remote surface. */
  const [remoteReady, setRemoteReady] = useState(() => Boolean(deepLinkKey));
  // Refetch catalog when entering remote so deletes from the library aren't ghosts.
  const catalogRefreshKey = remoteSurface || bareRemote ? "remote" : "other";
  const { catalog, ready } = useCatalog({ refreshKey: catalogRefreshKey });

  const onChannelChange = useCallback((id) => {
    if (!id) {
      clearLastRoutineId();
      setSessionKey(null);
      setRemoteReady(false);
      setModePage(true);
      window.history.replaceState({}, "", `${REMOTE_HOME}/mode`);
      return;
    }
    rememberLastRoutineId(id);
    canonicalizeRemoteUrl();
    setSessionKey(id);
    setRemoteReady(true);
    setBareRemote(true);
    setModePage(false);
  }, []);

  useEffect(() => {
    ensureLiveToken().then((token) => {
      if (token) rememberLiveToken(token);
    });
  }, []);

  useEffect(() => {
    applyClozzzPwa(detectClozzzPwaSurface());
  }, [remoteSurface, bareRemote, routinesPage, modePage, openDisplay, sessionKey]);

  useEffect(() => {
    // Canonicalize legacy / deep-link URLs onto single surfaces.
    const path = normalizePath();
    if (isEditorPath()) {
      window.history.replaceState({}, "", ROUTINES_HOME);
      setSessionKey(null);
      setRemoteSurface(false);
      setBareRemote(false);
      setRoutinesPage(true);
      setModePage(false);
      setOpenDisplay(false);
      setRemoteReady(false);
    } else if (
      /\/clozzz-overlay(?:\.html)?\/[^/]+\/remote$/i.test(path) ||
      isRemoteDeepLink()
    ) {
      const key = readSessionKey();
      if (key) {
        rememberLastRoutineId(key);
        setSessionKey(key);
        setRemoteReady(true);
      }
      canonicalizeRemoteUrl();
      setRemoteSurface(true);
      setBareRemote(true);
      setRoutinesPage(false);
      setOpenDisplay(false);
      setModePage(false);
    } else if (
      isOpenDisplayPath() &&
      path !== OPEN_DISPLAY &&
      path !== `${OPEN_DISPLAY}.html`
    ) {
      // /clozzz-overlay/<id> → fixed open display (channel comes from remote).
      window.history.replaceState({}, "", OPEN_DISPLAY);
      setOpenDisplay(true);
      setRemoteSurface(false);
      setBareRemote(false);
      setRoutinesPage(false);
      setModePage(false);
      setSessionKey(null);
      setRemoteReady(false);
    } else if (path === "/clozzz-overlay/mode") {
      window.history.replaceState({}, "", `${REMOTE_HOME}/mode`);
      setModePage(true);
      setOpenDisplay(false);
      setRoutinesPage(false);
      setRemoteSurface(true);
    }

    const sync = () => {
      const key = readSessionKey();
      const bare = isBareRemotePath();
      const deep = isRemoteDeepLink();
      if (deep && key) {
        rememberLastRoutineId(key);
        canonicalizeRemoteUrl();
        setSessionKey(key);
        setRemoteReady(true);
        setBareRemote(true);
        setModePage(false);
      } else {
        setBareRemote(bare);
        if (key) {
          setSessionKey(key);
          setRemoteReady(true);
        }
        setModePage(isModePath());
      }
      setRemoteSurface(isRemoteSurface());
      setRoutinesPage(isRoutinesSurface());
      setOpenDisplay(isOpenDisplayPath());
      applyClozzzPwa(detectClozzzPwaSurface());
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  // Bare /clozzz-remote → last channel (localStorage), else studio, else first
  // remaining / mode. Never keep a deleted/missing routine id.
  useEffect(() => {
    if (!ready || !bareRemote || modePage || routinesPage || !remoteSurface) {
      return;
    }
    const routines = catalog.routines || [];
    if (sessionKey && findSessionIn(routines, sessionKey)) {
      setRemoteReady(true);
      return;
    }
    // Ghost id (deleted Demo, etc.) — drop memory immediately.
    if (sessionKey) clearLastRoutineId(sessionKey);

    let cancelled = false;
    (async () => {
      const fromMemory = readLastRoutineId();
      let pick = null;
      if (fromMemory) {
        const memHit = findSessionIn(routines, fromMemory);
        if (memHit) pick = memHit.id;
        else clearLastRoutineId(fromMemory);
      }
      if (!pick) {
        try {
          const studio = await fetchStudioDisplay();
          const active = studio?.activeRoutineId;
          if (active) {
            const studioHit = findSessionIn(routines, active);
            if (studioHit) pick = studioHit.id;
          }
        } catch {
          /* ignore */
        }
      }
      if (!pick) pick = resolveChannelId(null, routines);
      if (cancelled) return;
      if (pick) {
        rememberLastRoutineId(pick);
        canonicalizeRemoteUrl();
        setSessionKey(pick);
        setRemoteReady(true);
        return;
      }
      clearLastRoutineId();
      setSessionKey(null);
      setRemoteReady(false);
      window.history.replaceState({}, "", `${REMOTE_HOME}/mode`);
      setModePage(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    bareRemote,
    modePage,
    routinesPage,
    remoteSurface,
    catalog,
    sessionKey,
  ]);

  const resolvedSession = useMemo(() => {
    if (!sessionKey) return null;
    return findSessionIn(catalog.routines, sessionKey);
  }, [catalog, sessionKey]);

  // Open OBS display — never shows library/remote.
  if (openDisplay && !remoteSurface && !modePage && !routinesPage) {
    return <OpenDisplayApp />;
  }

  if (!ready) {
    return <LibraryLoading />;
  }

  if (routinesPage) {
    return <LibraryApp catalog={catalog} />;
  }

  if (modePage) {
    return <ChooserApp catalog={catalog} />;
  }

  if (remoteSurface && remoteReady && resolvedSession) {
    return (
      <RemoteApp
        sessionKey={resolvedSession.id}
        catalog={catalog}
        onChannelChange={onChannelChange}
      />
    );
  }

  // Deleted/missing channel — never leave the user on “unknown routine”.
  // The restore effect above prunes localStorage + falls back; show loading
  // (or mode via that effect) instead of SessionNotFound.
  if (remoteSurface && remoteReady && sessionKey && !resolvedSession) {
    return <LibraryLoading />;
  }

  // Bare remote restoring channel…
  if (remoteSurface && bareRemote) {
    return <LibraryLoading />;
  }

  // Fallback: routine library
  return <LibraryApp catalog={catalog} />;
}
