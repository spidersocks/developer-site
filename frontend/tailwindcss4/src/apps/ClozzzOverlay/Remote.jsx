import React, { useCallback, useEffect, useState } from "react";
import {
  ensureLiveToken,
  fetchLive,
  postLiveCommand,
  readLiveToken,
} from "./api.js";

const POLL_MS = 800;

/**
 * Mobile remote — big Start/Pause, Skip, Back. No mirrored clock.
 * @param {{ sessionKey: string, sessionTitle?: string }} props
 */
export default function Remote({ sessionKey, sessionTitle }) {
  const [live, setLive] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  const send = async (command) => {
    setBusy(true);
    setError("");
    try {
      const token = (await ensureLiveToken()) || readLiveToken();
      const snap = await postLiveCommand(sessionKey, command, token);
      setLive(snap);
    } catch (e) {
      if (e.status === 401) {
        setError("Live control locked — re-unlock this device, then try again.");
      } else {
        setError(e.message || "Command failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const status = live?.status || "idle";
  const label = live?.currentLabel || "…";
  const index = typeof live?.segmentIndex === "number" ? live.segmentIndex : 0;
  const count = live?.segmentCount || 0;
  const primary =
    status === "running"
      ? { cmd: "pause", text: "Pause" }
      : status === "paused"
        ? { cmd: "resume", text: "Resume" }
        : status === "done"
          ? { cmd: "restart", text: "Restart" }
          : { cmd: "start", text: "Start" };

  const library = "/clozzz-overlay";
  const display = `/clozzz-overlay/${encodeURIComponent(sessionKey)}`;

  return (
    <div className="clozzz-remote">
      <header className="clozzz-remote__head">
        <p className="clozzz-remote__eyebrow">Clozzz remote</p>
        <h1 className="clozzz-remote__title">{sessionTitle || sessionKey}</h1>
        <p className="clozzz-remote__meta">
          {status === "done"
            ? "Routine complete"
            : status === "idle"
              ? "Armed — waiting for Start"
              : status === "paused"
                ? "Paused"
                : "Live"}
          {count > 0 ? ` · ${index + 1} / ${count}` : ""}
        </p>
        <p className="clozzz-remote__label" aria-live="polite">
          {status === "done" ? "Done" : label}
        </p>
      </header>

      {error ? (
        <p className="clozzz-remote__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="clozzz-remote__pad">
        <button
          type="button"
          className="clozzz-remote__btn clozzz-remote__btn--primary"
          disabled={busy || !live}
          onClick={() => send(primary.cmd)}
        >
          {primary.text}
        </button>
        <div className="clozzz-remote__row">
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={busy || !live || status === "done"}
            onClick={() => send("back")}
          >
            Back
          </button>
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={busy || !live || status === "done"}
            onClick={() => send("skip")}
          >
            Skip
          </button>
        </div>
        {status === "done" ? null : (
          <button
            type="button"
            className="clozzz-remote__btn clozzz-remote__btn--ghost"
            disabled={busy || !live}
            onClick={() => send("restart")}
          >
            Reset to start
          </button>
        )}
      </div>

      <footer className="clozzz-remote__foot">
        <a href={display}>Display</a>
        <a href={library}>Library</a>
      </footer>
    </div>
  );
}
