import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureLiveToken,
  fetchLive,
  postLiveCommand,
  readLiveToken,
  setStudioChannel,
} from "./api.js";

const POLL_MS = 800;
const PULL_THRESHOLD_PX = 72;
const SWIPE_THRESHOLD_PX = 56;
const LAST_ROUTINE_KEY = "clozzz_last_routine_id";
const SWIPE_EXIT_MS = 280;
const SWIPE_ENTER_MS = 340;

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

function navigateRemote(routineId, { replace = false } = {}) {
  const path = `/clozzz-remote/${encodeURIComponent(routineId)}`;
  if (replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Control-only remote — no library/editor links.
 * Mobile: side-swipe channels with springy stage animation.
 * Desktop: sidebar channel list + keyboard-friendly control panel.
 */
export default function Remote({
  sessionKey,
  sessionTitle,
  introCountdownEnabled: catalogIntroEnabled = false,
  routines = [],
}) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [busyCmd, setBusyCmd] = useState(null);
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [swipeHint, setSwipeHint] = useState("");
  const [slideX, setSlideX] = useState(0);
  const [slideOpacity, setSlideOpacity] = useState(1);
  const [slideTransition, setSlideTransition] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const gesture = useRef(null); // null | "pull" | "swipe" | "ignore"
  const pullingRef = useRef(false);
  const pendingDelta = useRef(null);
  const enterAfterKey = useRef(null);
  const stageRef = useRef(null);

  const channelIds = routines.map((r) => r.id);
  const channelIndex = channelIds.indexOf(sessionKey);
  const canSwipe = channelIds.length > 1;

  const refresh = useCallback(async () => {
    try {
      const snap = await fetchLive(sessionKey);
      setLive(snap);
      setError("");
      return snap;
    } catch (e) {
      setError(e.message || "Could not load live state");
      return null;
    }
  }, [sessionKey]);

  useEffect(() => {
    rememberLastRoutineId(sessionKey);
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
        /* display still polls; live commands also set channel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  // Enter animation after a channel commit.
  useEffect(() => {
    if (!enterAfterKey.current) return;
    if (enterAfterKey.current !== sessionKey) return;
    enterAfterKey.current = null;
    const from = pendingDelta.current;
    pendingDelta.current = null;
    const width = stageRef.current?.offsetWidth || window.innerWidth || 360;
    const startX = from < 0 ? width * 0.28 : -width * 0.28;
    setSlideTransition(false);
    setSlideX(startX);
    setSlideOpacity(0.55);
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setSlideTransition(true);
        setSlideX(0);
        setSlideOpacity(1);
      });
    });
    return () => cancelAnimationFrame(raf);
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

  const switchChannel = useCallback(
    (delta) => {
      if (!canSwipe || channelIndex < 0) return;
      const next =
        channelIds[(channelIndex + delta + channelIds.length) % channelIds.length];
      if (!next || next === sessionKey) return;
      rememberLastRoutineId(next);
      navigateRemote(next);
    },
    [canSwipe, channelIndex, channelIds, sessionKey]
  );

  const selectChannel = useCallback((id) => {
    if (!id || id === sessionKey) return;
    rememberLastRoutineId(id);
    navigateRemote(id);
  }, [sessionKey]);

  const commitSwipe = useCallback(
    (delta) => {
      if (!canSwipe || channelIndex < 0 || pendingDelta.current != null) return;
      const next =
        channelIds[(channelIndex + delta + channelIds.length) % channelIds.length];
      if (!next || next === sessionKey) return;
      const width = stageRef.current?.offsetWidth || window.innerWidth || 360;
      pendingDelta.current = delta;
      enterAfterKey.current = next;
      setSlideTransition(true);
      setSlideX(delta < 0 ? -width * 0.55 : width * 0.55);
      setSlideOpacity(0);
      window.setTimeout(() => {
        rememberLastRoutineId(next);
        navigateRemote(next);
      }, SWIPE_EXIT_MS);
    },
    [canSwipe, channelIndex, channelIds, sessionKey]
  );

  const onTouchStart = (e) => {
    if (refreshing || pendingDelta.current != null) return;
    const t = e.touches?.[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    gesture.current = null;
    pullingRef.current = false;
    setSwipeHint("");
    setSlideTransition(false);
  };

  const onTouchMove = (e) => {
    if (refreshing || pendingDelta.current != null) return;
    const t = e.touches?.[0];
    if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;

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
      const damp = dx * 0.92;
      setSlideX(damp);
      setSlideOpacity(Math.max(0.42, 1 - Math.abs(damp) / 420));
      if (Math.abs(dx) > 24) {
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

  const onTouchEnd = async (e) => {
    const mode = gesture.current;
    gesture.current = null;
    setSwipeHint("");

    if (mode === "swipe") {
      const t = e.changedTouches?.[0];
      if (t) {
        const dx = t.clientX - touchStart.current.x;
        if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
          commitSwipe(dx < 0 ? 1 : -1);
        } else {
          setSlideTransition(true);
          setSlideX(0);
          setSlideOpacity(1);
        }
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

  // Desktop keyboard: ←/→ channels, Space primary when focused on shell.
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
  const label = live?.currentLabel || "…";
  const index = typeof live?.segmentIndex === "number" ? live.segmentIndex : 0;
  const count = live?.segmentCount || 0;

  let primary = { cmd: "start", text: "Start routine" };
  if (status === "running") primary = { cmd: "pause", text: "Pause" };
  else if (status === "paused") primary = { cmd: "resume", text: "Resume" };
  else if (status === "done" || inStreamEnded)
    primary = { cmd: "restart", text: "Restart" };
  else if (introHeld) primary = { cmd: "start", text: "Start countdown" };

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
        : inStreamEnded
          ? "Stream ended"
          : status === "done"
            ? "Routine complete"
            : status === "idle"
              ? "Armed — waiting for Start"
              : status === "paused"
                ? "Paused"
                : "Live";
    if (!inCountdown && !introHeld && !inStreamEnded && count > 0) {
      line += ` · ${index + 1} / ${count}`;
    }
    if (!inCountdown && !introHeld && !inStreamEnded) {
      line += chromeVisible ? " · Chrome on" : " · Logo only";
    }
    return line;
  })();

  const nowLabel =
    inCountdown || introHeld
      ? "Starting soon"
      : inStreamEnded
        ? live?.streamEndedMessage || "Thanks for watching"
        : status === "done"
          ? "Done"
          : label;

  const stageStyle = {
    transform: `translate3d(${slideX}px, 0, 0)`,
    opacity: slideOpacity,
    transition: slideTransition
      ? `transform ${slideX === 0 ? SWIPE_ENTER_MS : SWIPE_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${slideX === 0 ? SWIPE_ENTER_MS : SWIPE_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none",
  };

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
        </>
      )}

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

      {status === "done" || inCountdown || introHeld || inStreamEnded ? null : (
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

  return (
    <div
      className="clozzz-remote"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
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

        <div
          ref={stageRef}
          className="clozzz-remote__stage"
          style={stageStyle}
        >
          <header className="clozzz-remote__head">
            <p className="clozzz-remote__eyebrow">Clozzz remote</p>
            <h1 className="clozzz-remote__title">{sessionTitle || sessionKey}</h1>
            {canSwipe ? (
              <p className="clozzz-remote__channel clozzz-remote__channel--mobile" aria-live="polite">
                {swipeHint ||
                  `Channel ${channelIndex + 1} of ${channelIds.length} · swipe to switch`}
              </p>
            ) : null}
            <p className="clozzz-remote__meta">{statusLine}</p>
            <p className="clozzz-remote__label" aria-live="polite">
              {nowLabel}
            </p>
          </header>

          {error ? (
            <p className="clozzz-remote__error" role="alert">
              {error}
            </p>
          ) : null}

          {controls}
        </div>
      </div>
    </div>
  );
}
