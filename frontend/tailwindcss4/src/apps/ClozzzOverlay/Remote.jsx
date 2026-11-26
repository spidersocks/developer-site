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
 * Mobile remote — big controls. No mirrored clock.
 * Side-swipe switches routine channels; last channel is remembered.
 * Intro / stream-ended come from routine flags on the live snapshot.
 * @param {{
 *   sessionKey: string,
 *   sessionTitle?: string,
 *   introCountdownEnabled?: boolean,
 *   routines?: Array<{ id: string, title?: string }>,
 * }} props
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
  const touchStart = useRef({ x: 0, y: 0 });
  const gesture = useRef(null); // null | "pull" | "swipe" | "ignore"
  const pullingRef = useRef(false);

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

  // Selecting a remote channel steers the open OBS display.
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

  // Optional deep-link still works: /remote?startCountdown=180
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

  const onTouchStart = (e) => {
    if (refreshing) return;
    const t = e.touches?.[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    gesture.current = null;
    pullingRef.current = false;
    setSwipeHint("");
  };

  const onTouchMove = (e) => {
    if (refreshing) return;
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
          switchChannel(dx < 0 ? 1 : -1);
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

  const status = live?.status || "idle";
  const inCountdown = status === "countdown";
  const inStreamEnded = status === "stream_ended";
  const chromeVisible = live?.chromeVisible !== false;
  // Bridge stale live snapshots that lag an editor intro toggle.
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

  const library = "/clozzz-routines";
  const isBusy = (key) => busyCmd === key;
  const noLive = !live;
  const pullHint =
    refreshing || pullY >= PULL_THRESHOLD_PX
      ? "Release to refresh"
      : pulling
        ? "Pull to refresh"
        : "";

  return (
    <div
      className="clozzz-remote"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
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

      <header className="clozzz-remote__head">
        <p className="clozzz-remote__eyebrow">Clozzz remote</p>
        <h1 className="clozzz-remote__title">{sessionTitle || sessionKey}</h1>
        {canSwipe ? (
          <p className="clozzz-remote__channel" aria-live="polite">
            {swipeHint ||
              `Channel ${channelIndex + 1} of ${channelIds.length} · swipe to switch`}
          </p>
        ) : null}
        <p className="clozzz-remote__meta">
          {inCountdown
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
                      : "Live"}
          {!inCountdown && !introHeld && !inStreamEnded && count > 0
            ? ` · ${index + 1} / ${count}`
            : ""}
          {!inCountdown && !introHeld && !inStreamEnded
            ? chromeVisible
              ? " · Chrome on"
              : " · Logo only"
            : ""}
        </p>
        <p className="clozzz-remote__label" aria-live="polite">
          {inCountdown || introHeld
            ? "Starting soon"
            : inStreamEnded
              ? live?.streamEndedMessage || "Thanks for watching"
              : status === "done"
                ? "Done"
                : label}
        </p>
      </header>

      {error ? (
        <p className="clozzz-remote__error" role="alert">
          {error}
        </p>
      ) : null}

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
          onClick={() =>
            send(chromeVisible ? "hide_chrome" : "show_chrome")
          }
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

      <footer className="clozzz-remote__foot">
        <a href={library}>All routines</a>
      </footer>
    </div>
  );
}
