import React, { useCallback, useEffect, useState } from "react";
import {
  ensureLiveToken,
  fetchLive,
  postLiveCommand,
  readLiveToken,
} from "./api.js";

const POLL_MS = 800;

/**
 * Mobile remote — big controls. No mirrored clock.
 * Intro / stream-ended come from routine flags on the live snapshot.
 * @param {{ sessionKey: string, sessionTitle?: string }} props
 */
export default function Remote({ sessionKey, sessionTitle }) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [busyCmd, setBusyCmd] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const snap = await fetchLive(sessionKey);
      setLive(snap);
      setError("");
    } catch (e) {
      setError(e.message || "Could not load live state");
    }
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
  const introEnabled = Boolean(live?.introCountdownEnabled);
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

  const library = "/clozzz-overlay";
  const isBusy = (key) => busyCmd === key;
  const noLive = !live;

  return (
    <div className="clozzz-remote">
      <header className="clozzz-remote__head">
        <p className="clozzz-remote__eyebrow">Clozzz remote</p>
        <h1 className="clozzz-remote__title">{sessionTitle || sessionKey}</h1>
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
