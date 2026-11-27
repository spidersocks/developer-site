import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureLiveToken,
  fetchLive,
  postLiveCommand,
  readLiveToken,
  setStudioChannel,
} from "./api.js";

const POLL_MS = 800;
const PULL_THRESHOLD_PX = 72;
const LAST_ROUTINE_KEY = "clozzz_last_routine_id";
const REMOTE_HOME = "/clozzz-remote";

/**
 * Settle curve from Motion’s iOS App Store layout demo
 * (https://motion.dev/examples/js-app-store-layout) — weighted, not snappy.
 */
const EASE_APPLE = "cubic-bezier(0.39, 0.14, 0.26, 1)";
const SWIPE_SETTLE_MS = 520;

/** Embla scale-on-focus tween factor (distance → t). */
const TWEEN_FACTOR = 0.72;
const SCALE_MIN = 0.82;
const SCALE_RANGE = 0.18;
const OPACITY_MIN = 0.45;
const OPACITY_RANGE = 0.55;

const SWIPE_DISTANCE_RATIO = 0.22;
const SWIPE_DISTANCE_MIN_PX = 64;
const FLICK_SPEED = 0.45;

export function readLastRoutineId() {
  try {
    return localStorage.getItem(LAST_ROUTINE_KEY) || "";
  } catch {
    return "";
  }
}

export function rememberLastRoutineId(id) {
  if (!id) return;
  try {
    localStorage.setItem(LAST_ROUTINE_KEY, id);
  } catch {
    /* private mode */
  }
}

/** Drop last-channel memory (optionally only when it matches `id`). */
export function clearLastRoutineId(id = null) {
  try {
    if (id != null) {
      const cur = localStorage.getItem(LAST_ROUTINE_KEY) || "";
      if (cur.toLowerCase() !== String(id).toLowerCase()) return;
    }
    localStorage.removeItem(LAST_ROUTINE_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Pick a catalog-backed channel id: prefer `preferred` if still present,
 * else first remaining routine, else null. Prunes localStorage ghosts.
 */
export function resolveChannelId(preferred, routines = []) {
  const list = Array.isArray(routines) ? routines : [];
  const found = preferred
    ? list.find(
        (r) =>
          r?.id === preferred ||
          String(r?.id || "").toLowerCase() === String(preferred).toLowerCase() ||
          String(r?.name || "").toLowerCase() === String(preferred).toLowerCase()
      )
    : null;
  if (found?.id) {
    rememberLastRoutineId(found.id);
    return found.id;
  }
  if (preferred) clearLastRoutineId(preferred);
  const first = list[0]?.id || null;
  if (first) rememberLastRoutineId(first);
  else clearLastRoutineId();
  return first;
}

/** Keep the product URL on the single remote surface. */
export function canonicalizeRemoteUrl() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === REMOTE_HOME) return;
  const qs = window.location.search || "";
  window.history.replaceState({}, "", `${REMOTE_HOME}${qs}`);
}

function clamp(n, a, b) {
  return Math.min(Math.max(n, a), b);
}

/**
 * Embla center-scale tween:
 * t = clamp(1 - abs(offset) * factor, 0, 1)
 * scale = 0.82 + 0.18 * t ; opacity = 0.45 + 0.55 * t
 */
function tweenFromOffset(offset) {
  const t = clamp(1 - Math.abs(offset) * TWEEN_FACTOR, 0, 1);
  return {
    t,
    scale: SCALE_MIN + SCALE_RANGE * t,
    opacity: OPACITY_MIN + OPACITY_RANGE * t,
  };
}

/**
 * Control remote — mobile Embla/Swiper-style card carousel + desktop sidebar.
 * Finger left → next channel. Product URL stays `/clozzz-remote`.
 */
export default function Remote({
  sessionKey,
  sessionTitle,
  introCountdownEnabled: catalogIntroEnabled = false,
  routines = [],
  onChannelChange,
}) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [busyCmd, setBusyCmd] = useState(null);
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [swipeHint, setSwipeHint] = useState("");
  /** Finger / settle progress in “slides” (0 = current, +1 = next committed). */
  const [progress, setProgress] = useState(0);
  const [settling, setSettling] = useState(false);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const samples = useRef([]);
  const gesture = useRef(null); // null | "pull" | "swipe" | "ignore"
  const pullingRef = useRef(false);
  const pendingDelta = useRef(null);
  const viewportRef = useRef(null);
  const settleTimer = useRef(null);

  const channelIds = useMemo(() => routines.map((r) => r.id), [routines]);
  const channelIndex = channelIds.indexOf(sessionKey);
  const canSwipe = channelIds.length > 1;

  const neighborId = useCallback(
    (delta) => {
      if (!canSwipe || channelIndex < 0) return null;
      return channelIds[
        (channelIndex + delta + channelIds.length) % channelIds.length
      ];
    },
    [canSwipe, channelIndex, channelIds]
  );

  const routineById = useCallback(
    (id) => routines.find((r) => r.id === id) || null,
    [routines]
  );

  const pitchPx = () => {
    const w = viewportRef.current?.offsetWidth || window.innerWidth || 360;
    return Math.max(240, w * 0.88);
  };

  const refresh = useCallback(async () => {
    try {
      const snap = await fetchLive(sessionKey);
      setLive(snap);
      setError("");
      return snap;
    } catch (e) {
      const status = e?.status;
      const msg = e.message || "Could not load live state";
      // Deleted / missing routine — leave this channel; never keep a ghost.
      if (status === 404) {
        clearLastRoutineId(sessionKey);
        const fallback =
          routines.find((r) => r.id !== sessionKey)?.id ||
          resolveChannelId(null, routines.filter((r) => r.id !== sessionKey));
        if (typeof onChannelChange === "function") {
          onChannelChange(fallback || null);
        }
        setError("");
        return null;
      }
      setError(msg);
      return null;
    }
  }, [sessionKey, routines, onChannelChange]);

  useEffect(() => {
    rememberLastRoutineId(sessionKey);
    canonicalizeRemoteUrl();
  }, [sessionKey]);

  useEffect(() => {
    let cancelled = false;
    ensureLiveToken().finally(() => {
      if (!cancelled) refresh();
    });
    const id = setInterval(() => {
      if (!cancelled) refresh();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = (await ensureLiveToken()) || readLiveToken();
        if (cancelled || !sessionKey) return;
        await setStudioChannel(sessionKey, token);
      } catch {
        /* display still polls */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("startCountdown");
    if (!raw) return;
    const sec = Number(raw);
    if (!Number.isFinite(sec) || sec < 5) return;
    let cancelled = false;
    (async () => {
      try {
        const token = (await ensureLiveToken()) || readLiveToken();
        if (cancelled) return;
        const snap = await postLiveCommand(sessionKey, "start_countdown", token, {
          durationSec: Math.round(sec),
        });
        if (!cancelled) {
          setLive(snap);
          const url = new URL(window.location.href);
          url.searchParams.delete("startCountdown");
          window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not start countdown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    []
  );

  const applyChannel = useCallback(
    (id) => {
      if (!id || id === sessionKey) return;
      rememberLastRoutineId(id);
      canonicalizeRemoteUrl();
      if (typeof onChannelChange === "function") {
        onChannelChange(id);
      }
    },
    [sessionKey, onChannelChange]
  );

  const switchChannel = useCallback(
    (delta) => {
      const next = neighborId(delta);
      if (next) applyChannel(next);
    },
    [neighborId, applyChannel]
  );

  const selectChannel = useCallback(
    (id) => {
      applyChannel(id);
    },
    [applyChannel]
  );

  const commitSwipe = useCallback(
    (delta) => {
      if (!canSwipe || channelIndex < 0 || pendingDelta.current != null) return;
      const next = neighborId(delta);
      if (!next) return;
      pendingDelta.current = delta;
      setSettling(true);
      setProgress(delta > 0 ? 1 : -1);
      settleTimer.current = window.setTimeout(() => {
        pendingDelta.current = null;
        setSettling(false);
        setProgress(0);
        applyChannel(next);
      }, SWIPE_SETTLE_MS);
    },
    [canSwipe, channelIndex, neighborId, applyChannel]
  );

  const snapBack = useCallback(() => {
    setSettling(true);
    setProgress(0);
    settleTimer.current = window.setTimeout(() => {
      setSettling(false);
    }, SWIPE_SETTLE_MS);
  }, []);

  const onTouchStart = (e) => {
    if (refreshing || pendingDelta.current != null) return;
    const t = e.touches?.[0];
    if (!t) return;
    const now = performance.now();
    touchStart.current = { x: t.clientX, y: t.clientY, t: now };
    samples.current = [{ x: t.clientX, t: now }];
    gesture.current = null;
    pullingRef.current = false;
    setSwipeHint("");
    setSettling(false);
  };

  const onTouchMove = (e) => {
    if (refreshing || pendingDelta.current != null) return;
    const t = e.touches?.[0];
    if (!t) return;
    const now = performance.now();
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    samples.current.push({ x: t.clientX, t: now });
    if (samples.current.length > 8) samples.current.shift();

    if (!gesture.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) && canSwipe) {
        gesture.current = "swipe";
        pullingRef.current = false;
        setPulling(false);
        setPullY(0);
      } else if (dy > 0 && window.scrollY <= 2) {
        gesture.current = "pull";
        pullingRef.current = true;
      } else {
        gesture.current = "ignore";
        return;
      }
    }

    if (gesture.current === "swipe") {
      if (e.cancelable) e.preventDefault();
      // 1:1 with finger — Embla/premium carousels follow the hand.
      const pitch = pitchPx();
      // Finger left (dx < 0) → progress toward next (+1).
      setProgress(clamp((-dx) / pitch, -1.15, 1.15));
      if (Math.abs(dx) > 20) {
        setSwipeHint(dx < 0 ? "Next channel →" : "← Previous channel");
      }
      return;
    }

    if (gesture.current !== "pull" || !pullingRef.current) return;
    if (dy <= 0 || window.scrollY > 2) {
      setPullY(0);
      setPulling(false);
      return;
    }
    const damped = Math.min(dy * 0.45, 120);
    setPullY(damped);
    setPulling(true);
    if (dy > 12 && e.cancelable) e.preventDefault();
  };

  const releaseVelocity = () => {
    const now = performance.now();
    const recent = samples.current.filter((s) => now - s.t < 100);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(1, last.t - first.t);
    if (now - last.t > 60) return 0;
    return (last.x - first.x) / dt;
  };

  const onTouchEnd = async (e) => {
    const mode = gesture.current;
    gesture.current = null;
    setSwipeHint("");

    if (mode === "swipe") {
      const t = e.changedTouches?.[0];
      if (!t) {
        snapBack();
        return;
      }
      const dx = t.clientX - touchStart.current.x;
      const width = viewportRef.current?.offsetWidth || window.innerWidth || 360;
      const threshold = Math.max(SWIPE_DISTANCE_MIN_PX, width * SWIPE_DISTANCE_RATIO);
      const velocity = releaseVelocity();
      const flickNext = velocity < -FLICK_SPEED;
      const flickPrev = velocity > FLICK_SPEED;
      const distanceNext = dx <= -threshold;
      const distancePrev = dx >= threshold;

      if (flickNext || distanceNext) {
        commitSwipe(1);
      } else if (flickPrev || distancePrev) {
        commitSwipe(-1);
      } else {
        snapBack();
      }
      return;
    }

    if (!pullingRef.current) return;
    pullingRef.current = false;
    const shouldRefresh = pullY >= PULL_THRESHOLD_PX;
    setPulling(false);
    setPullY(0);
    if (!shouldRefresh) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const send = async (command, extras = {}) => {
    const busyKey = extras._busyKey || command;
    setBusyCmd(busyKey);
    setError("");
    try {
      const token = (await ensureLiveToken()) || readLiveToken();
      const { _busyKey, ...payload } = extras;
      const snap = await postLiveCommand(sessionKey, command, token, payload);
      setLive(snap);
    } catch (e) {
      if (e.status === 401) {
        setError("Live control locked — re-unlock this device, then try again.");
      } else {
        setError(e.message || "Command failed");
      }
    } finally {
      setBusyCmd(null);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        switchChannel(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        switchChannel(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switchChannel]);

  const status = live?.status || "idle";
  const inCountdown = status === "countdown";
  const inStreamEnded = status === "stream_ended";
  const chromeVisible = live?.chromeVisible !== false;
  const introEnabled =
    Boolean(live?.introCountdownEnabled) ||
    (status === "idle" &&
      !live?.introConsumed &&
      Boolean(catalogIntroEnabled));
  const introPending = introEnabled && !live?.introConsumed;
  const introHeld = status === "idle" && introPending;
  const logoArmed =
    status === "idle" && Boolean(live?.introConsumed) && !chromeVisible;
  const label = live?.currentLabel || "…";
  const index = typeof live?.segmentIndex === "number" ? live.segmentIndex : 0;
  const count = live?.segmentCount || 0;

  let primary = { cmd: "start", text: "Start routine" };
  if (status === "running") primary = { cmd: "pause", text: "Pause" };
  else if (status === "paused") primary = { cmd: "resume", text: "Resume" };
  else if (status === "done" || inStreamEnded)
    primary = { cmd: "restart", text: "Restart" };
  else if (introHeld) primary = { cmd: "start", text: "Start countdown" };
  else if (logoArmed) primary = { cmd: "start", text: "Start routine" };

  const isBusy = (key) => busyCmd === key;
  const noLive = !live;
  const pullHint =
    refreshing || pullY >= PULL_THRESHOLD_PX
      ? "Release to refresh"
      : pulling
        ? "Pull to refresh"
        : "";

  const statusLine = (() => {
    let line = inCountdown
      ? "Pre-stream countdown"
      : introHeld
        ? "Countdown held — waiting for Start"
        : logoArmed
          ? "Logo only — waiting for Start"
          : inStreamEnded
            ? "Stream ended"
            : status === "done"
              ? "Routine complete"
              : status === "idle"
                ? "Armed — waiting for Start"
                : status === "paused"
                  ? "Paused"
                  : "Live";
    if (!inCountdown && !introHeld && !logoArmed && !inStreamEnded && count > 0) {
      line += ` · ${index + 1} / ${count}`;
    }
    if (!inCountdown && !introHeld && !logoArmed && !inStreamEnded) {
      line += chromeVisible ? " · Chrome on" : " · Logo only";
    }
    return line;
  })();

  const nowLabel =
    inCountdown || introHeld
      ? "Starting soon"
      : logoArmed
        ? "Ready when you are"
        : inStreamEnded
          ? live?.streamEndedMessage || "Thanks for watching"
          : status === "done"
            ? "Done"
            : label;

  const controls = (
    <div className="clozzz-remote__pad">
      {inCountdown ? (
        <button
          type="button"
          className="clozzz-remote__btn clozzz-remote__btn--primary"
          disabled={noLive || isBusy("skip_countdown")}
          onClick={() => send("skip_countdown")}
        >
          Skip countdown
        </button>
      ) : introHeld ? (
        <>
          <button
            type="button"
            className="clozzz-remote__btn clozzz-remote__btn--primary"
            disabled={noLive || isBusy(primary.cmd)}
            onClick={() => send(primary.cmd)}
          >
            {primary.text}
          </button>
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={noLive || isBusy("skip_countdown")}
            onClick={() => send("skip_countdown")}
          >
            Skip countdown
          </button>
        </>
      ) : inStreamEnded ? (
        <>
          <button
            type="button"
            className="clozzz-remote__btn clozzz-remote__btn--primary"
            disabled={noLive || isBusy("skip_stream_ended")}
            onClick={() => send("skip_stream_ended")}
          >
            Dismiss ended screen
          </button>
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={noLive || isBusy("restart")}
            onClick={() => send("restart")}
          >
            Restart
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="clozzz-remote__btn clozzz-remote__btn--primary"
            disabled={noLive || isBusy(primary.cmd)}
            onClick={() => send(primary.cmd)}
          >
            {primary.text}
          </button>
          {logoArmed ? null : (
            <div className="clozzz-remote__row">
              <button
                type="button"
                className="clozzz-remote__btn"
                disabled={noLive || status === "done" || isBusy("back")}
                onClick={() => send("back")}
              >
                Back
              </button>
              <button
                type="button"
                className="clozzz-remote__btn"
                disabled={noLive || status === "done" || isBusy("skip")}
                onClick={() => send("skip")}
              >
                Skip
              </button>
            </div>
          )}
        </>
      )}

      {logoArmed ? null : (
        <>
          <p className="clozzz-remote__section">Overlay</p>
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={
              noLive ||
              inCountdown ||
              introHeld ||
              inStreamEnded ||
              isBusy(chromeVisible ? "hide_chrome" : "show_chrome")
            }
            onClick={() => send(chromeVisible ? "hide_chrome" : "show_chrome")}
          >
            {chromeVisible ? "Hide exercise & timer" : "Show exercise & timer"}
          </button>
        </>
      )}

      {status === "done" ||
      inCountdown ||
      introHeld ||
      logoArmed ||
      inStreamEnded ? null : (
        <button
          type="button"
          className="clozzz-remote__btn clozzz-remote__btn--ghost"
          disabled={noLive || isBusy("restart")}
          onClick={() => send("restart")}
        >
          Reset to start
        </button>
      )}
    </div>
  );

  const prevId = neighborId(-1);
  const nextId = neighborId(1);
  const slots = canSwipe
    ? [
        { id: prevId, slot: -1 },
        { id: sessionKey, slot: 0 },
        { id: nextId, slot: 1 },
      ]
    : [{ id: sessionKey, slot: 0 }];

  const cardStyle = (slot) => {
    // Swiper coverflow offsetMultiplier: distance of card from visual center.
    const offset = slot - progress;
    const { scale, opacity, t } = tweenFromOffset(offset);
    const pitch = pitchPx();
    return {
      transform: `translate3d(${offset * pitch}px, 0, 0) scale(${scale})`,
      opacity,
      zIndex: Math.round(t * 20),
      transition: settling
        ? `transform ${SWIPE_SETTLE_MS}ms ${EASE_APPLE}, opacity ${SWIPE_SETTLE_MS}ms ${EASE_APPLE}`
        : "none",
    };
  };

  const renderCardBody = (id, isActive) => {
    const routine = routineById(id);
    const title = isActive
      ? sessionTitle || routine?.title || id
      : routine?.title || id;
    const idx = channelIds.indexOf(id);
    return (
      <>
        <header className="clozzz-remote__head">
          <p className="clozzz-remote__eyebrow">Clozzz remote</p>
          <h1 className="clozzz-remote__title">{title}</h1>
          {canSwipe ? (
            <p
              className="clozzz-remote__channel clozzz-remote__channel--mobile"
              aria-live={isActive ? "polite" : undefined}
            >
              {isActive
                ? swipeHint ||
                  `Channel ${idx + 1} of ${channelIds.length} · swipe to switch`
                : `Channel ${idx + 1} of ${channelIds.length}`}
            </p>
          ) : null}
          {isActive ? (
            <>
              <p className="clozzz-remote__meta">{statusLine}</p>
              <p className="clozzz-remote__label" aria-live="polite">
                {nowLabel}
              </p>
            </>
          ) : (
            <p className="clozzz-remote__meta">Swipe to control</p>
          )}
        </header>
        {isActive && error ? (
          <p className="clozzz-remote__error" role="alert">
            {error}
          </p>
        ) : null}
        {isActive ? controls : <div className="clozzz-remote__pad clozzz-remote__pad--ghost" />}
      </>
    );
  };

  return (
    <div
      className="clozzz-remote"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchCancel={onTouchEnd}
      onTouchEnd={onTouchEnd}
    >
      <aside className="clozzz-remote__sidebar" aria-label="Channels">
        <p className="clozzz-remote__sidebar-eyebrow">Channels</p>
        <ul className="clozzz-remote__channel-list">
          {routines.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                className={`clozzz-remote__channel-item${
                  r.id === sessionKey ? " is-active" : ""
                }`}
                onClick={() => selectChannel(r.id)}
                aria-current={r.id === sessionKey ? "true" : undefined}
              >
                <span className="clozzz-remote__channel-index">{i + 1}</span>
                <span className="clozzz-remote__channel-name">
                  {r.title || r.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="clozzz-remote__sidebar-hint">← → to switch</p>
      </aside>

      <div className="clozzz-remote__panel">
        <div
          className={`clozzz-remote__pull${pulling || refreshing ? " is-active" : ""}`}
          style={{
            height: refreshing ? 48 : pullY,
            opacity: pulling || refreshing ? 1 : 0,
          }}
          aria-hidden="true"
        >
          <span>{refreshing ? "Refreshing…" : pullHint}</span>
        </div>

        <div ref={viewportRef} className="clozzz-remote__viewport">
          <div className="clozzz-remote__stage">
            {slots.map(({ id, slot }) =>
              id ? (
                <div
                  key={`${id}:${slot}`}
                  className={`clozzz-remote__card${slot === 0 ? " is-active" : ""}`}
                  style={cardStyle(slot)}
                  aria-hidden={slot !== 0}
                >
                  {renderCardBody(id, slot === 0)}
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
