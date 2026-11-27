import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureLiveToken,
  fetchLive,
  fetchStudioDisplay,
  postLiveCommand,
  readLiveToken,
  setStudioChannel,
} from "./api.js";

/** Match OBS overlay cadence — peer remotes should converge within ~0.5–1s. */
const POLL_MS = 400;
/** Ignore studio channel yank-back while our own switch PUT is in flight. */
const CHANNEL_INTENT_MS = 1500;
const PULL_THRESHOLD_PX = 72;
const LAST_ROUTINE_KEY = "clozzz_last_routine_id";
const REMOTE_HOME = "/clozzz-remote";

/** Prefer server revision so an in-flight poll cannot overwrite a fresher command. */
function snapRevision(snap) {
  if (!snap || typeof snap !== "object") return 0;
  if (typeof snap.revision === "number" && Number.isFinite(snap.revision)) {
    return snap.revision;
  }
  return 0;
}

function snapUpdatedAt(snap) {
  if (!snap || typeof snap !== "object") return 0;
  if (typeof snap.updatedAt === "number" && Number.isFinite(snap.updatedAt)) {
    return snap.updatedAt;
  }
  return 0;
}

const CUE_VOLUME_KEY = "clozzz_cue_volume";
const CUE_MUTED_KEY = "clozzz_cue_muted";

function readStoredCueVolume() {
  try {
    const raw = localStorage.getItem(CUE_VOLUME_KEY);
    if (raw == null) return 0.75;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.75;
  } catch {
    return 0.75;
  }
}

function readStoredCueMuted() {
  try {
    return localStorage.getItem(CUE_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberCueAudio(volume, muted) {
  try {
    localStorage.setItem(CUE_VOLUME_KEY, String(volume));
    localStorage.setItem(CUE_MUTED_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function sameRoutineId(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

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

function VolumeIcon() {
  return (
    <svg className="clozzz-remote__vol-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.5 9.5v5h3.2L12 18.2V5.8L7.7 9.5H4.5Zm9.2 1.1a2.4 2.4 0 0 1 0 2.8l1.2 1.1a4.2 4.2 0 0 0 0-5l-1.2 1.1Zm1.9-3.3a5.8 5.8 0 0 1 0 9.4l1.3 1.15a7.6 7.6 0 0 0 0-11.7L15.6 7.3Z"
      />
    </svg>
  );
}

function VolumeMutedIcon() {
  return (
    <svg className="clozzz-remote__vol-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.5 9.5v5h3.2L12 18.2V5.8L7.7 9.5H4.5Zm10.9-.55 1.15-1.15 1.25 1.25 1.25-1.25 1.15 1.15-1.25 1.25 1.25 1.25-1.15 1.15-1.25-1.25-1.25 1.25-1.15-1.15 1.25-1.25-1.25-1.25Z"
      />
    </svg>
  );
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
 * Control remote — mobile Embla scale-on-focus channel swipe + desktop sidebar.
 * Live/countdown locks swipe (no neighbor peeks). Product URL stays `/clozzz-remote`.
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
  /** Finger / settle progress in “slides” (0 = current, +1 = next committed). */
  const [progress, setProgress] = useState(0);
  const [settling, setSettling] = useState(false);
  /** Local cue audio UI — wins over poll while dragging or a set_cue_audio is in flight. */
  const [uiCueVolume, setUiCueVolume] = useState(readStoredCueVolume);
  const [uiCueMuted, setUiCueMuted] = useState(readStoredCueMuted);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const samples = useRef([]);
  const gesture = useRef(null); // null | "pull" | "swipe" | "ignore"
  const pullingRef = useRef(false);
  const pendingDelta = useRef(null);
  const viewportRef = useRef(null);
  const settleTimer = useRef(null);
  const liveRevRef = useRef(0);
  const liveUpdatedRef = useRef(0);
  const liveRef = useRef(null);
  const sessionKeyRef = useRef(sessionKey);
  const cuePrefsPushedRef = useRef(false);
  const cueVolTimerRef = useRef(null);
  const cueDraggingRef = useRef(false);
  /** Bumps on each local cue edit; 0 when idle / synced. */
  const cueAudioGenRef = useRef(0);
  const channelIntentRef = useRef({ id: null, at: 0 });
  /** True when this remote should claim studio (mount / local swipe); false after peer follow. */
  const claimStudioRef = useRef(true);
  const studioPutGenRef = useRef(0);
  /** Latest channel this remote believes studio should show (local claim or peer follow). */
  const desiredStudioRef = useRef(sessionKey);

  sessionKeyRef.current = sessionKey;
  liveRef.current = live;

  const channelIds = useMemo(() => routines.map((r) => r.id), [routines]);
  const channelIndex = channelIds.indexOf(sessionKey);
  const multiChannel = channelIds.length > 1;

  const neighborId = useCallback(
    (delta) => {
      if (!multiChannel || channelIndex < 0) return null;
      return channelIds[
        (channelIndex + delta + channelIds.length) % channelIds.length
      ];
    },
    [multiChannel, channelIndex, channelIds]
  );

  const routineById = useCallback(
    (id) => routines.find((r) => r.id === id) || null,
    [routines]
  );

  const pitchPx = () => {
    const w = viewportRef.current?.offsetWidth || window.innerWidth || 360;
    // Full viewport pitch — neighbors stay off-screen at rest (no idle peeks).
    return Math.max(280, w);
  };

  const applyLiveSnap = useCallback((snap, expectedKey = sessionKeyRef.current) => {
    if (!snap || sessionKeyRef.current !== expectedKey) return false;
    if (snap.routineId != null && !sameRoutineId(snap.routineId, expectedKey)) {
      return false;
    }
    const rev = snapRevision(snap);
    const updated = snapUpdatedAt(snap);
    // Restart rebuilds the run at revision 1 — accept when updatedAt advances.
    if (rev && rev < liveRevRef.current) {
      if (!updated || updated <= liveUpdatedRef.current) return false;
      liveRevRef.current = rev;
    } else if (rev) {
      liveRevRef.current = rev;
    }
    if (updated) liveUpdatedRef.current = updated;
    setLive(snap);
    return true;
  }, []);

  const leaveMissingChannel = useCallback(() => {
    clearLastRoutineId(sessionKey);
    const fallback =
      routines.find((r) => r.id !== sessionKey)?.id ||
      resolveChannelId(
        null,
        routines.filter((r) => r.id !== sessionKey)
      );
    if (typeof onChannelChange === "function") {
      onChannelChange(fallback || null);
    }
    setError("");
  }, [sessionKey, routines, onChannelChange]);

  /**
   * Shared studio + live poll: follow peer channel switches and apply
   * server-authoritative UI state (phase / pause / chrome / buttons).
   */
  const refresh = useCallback(async () => {
    const expectedKey = sessionKey;
    try {
      const display = await fetchStudioDisplay();
      if (sessionKeyRef.current !== expectedKey) return null;

      const active = display?.activeRoutineId || null;
      const now = Date.now();
      const intent = channelIntentRef.current;
      const intentFresh =
        Boolean(intent.id) && now - intent.at < CHANNEL_INTENT_MS;

      if (active && !sameRoutineId(active, expectedKey)) {
        if (!intentFresh) {
          // Another remote (or command) moved the studio channel — follow it.
          // Do not re-claim studio; mark desired so a late PUT can restore.
          claimStudioRef.current = false;
          desiredStudioRef.current = active;
          studioPutGenRef.current += 1;
          channelIntentRef.current = { id: null, at: 0 };
          liveRevRef.current = 0;
          liveUpdatedRef.current = 0;
          if (typeof onChannelChange === "function") {
            onChannelChange(active);
          }
          setError("");
          return display;
        }
        // Our local switch is still landing — keep polling this channel's live.
      } else if (active && sameRoutineId(active, expectedKey)) {
        if (intent.id) channelIntentRef.current = { id: null, at: 0 };
        if (display.live) {
          applyLiveSnap(display.live, expectedKey);
          setError("");
          return display;
        }
      }

      const snap = await fetchLive(expectedKey);
      if (sessionKeyRef.current !== expectedKey) return null;
      applyLiveSnap(snap, expectedKey);
      setError("");
      return snap;
    } catch (e) {
      if (sessionKeyRef.current !== expectedKey) return null;
      const status = e?.status;
      const msg = e.message || "Could not load live state";
      // Deleted / missing routine — leave this channel; never keep a ghost.
      if (status === 404) {
        leaveMissingChannel();
        return null;
      }
      setError(msg);
      return null;
    }
  }, [sessionKey, onChannelChange, applyLiveSnap, leaveMissingChannel]);

  useEffect(() => {
    rememberLastRoutineId(sessionKey);
    canonicalizeRemoteUrl();
    liveRevRef.current = 0;
    liveUpdatedRef.current = 0;
    cuePrefsPushedRef.current = false;
    cueAudioGenRef.current = 0;
    cueDraggingRef.current = false;
    if (cueVolTimerRef.current) {
      window.clearTimeout(cueVolTimerRef.current);
      cueVolTimerRef.current = null;
    }
    setUiCueVolume(readStoredCueVolume());
    setUiCueMuted(readStoredCueMuted());
  }, [sessionKey]);

  /** Adopt server cue audio only when local slider is idle (not dragging / not in-flight). */
  useEffect(() => {
    if (!live) return;
    if (cueDraggingRef.current) return;
    if (cueAudioGenRef.current > 0) {
      // Keep local UI until the server echoes our values (stale polls must not snap back).
      const volMatch =
        typeof live.cueVolume === "number" &&
        Math.abs(live.cueVolume - uiCueVolume) < 0.001;
      const muteMatch = Boolean(live.cueMuted) === uiCueMuted;
      if (volMatch && muteMatch) cueAudioGenRef.current = 0;
      return;
    }
    if (typeof live.cueVolume === "number") setUiCueVolume(live.cueVolume);
    setUiCueMuted(Boolean(live.cueMuted));
  }, [live, uiCueVolume, uiCueMuted]);

  /** Push remembered cue volume/mute once per channel so OBS matches the remote. */
  useEffect(() => {
    if (!live || cuePrefsPushedRef.current) return;
    cuePrefsPushedRef.current = true;
    const volume = readStoredCueVolume();
    const muted = readStoredCueMuted();
    const serverVol =
      typeof live.cueVolume === "number" ? live.cueVolume : null;
    const serverMuted = Boolean(live.cueMuted);
    if (
      serverVol != null &&
      Math.abs(serverVol - volume) < 0.001 &&
      serverMuted === muted
    ) {
      return;
    }
    (async () => {
      try {
        const token = (await ensureLiveToken()) || readLiveToken();
        const snap = await postLiveCommand(sessionKey, "set_cue_audio", token, {
          cueVolume: volume,
          cueMuted: muted,
        });
        applyLiveSnap(snap, sessionKey);
      } catch {
        /* keep polling; volume UI still local until next success */
      }
    })();
  }, [live, sessionKey, applyLiveSnap]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      refresh();
    };
    ensureLiveToken().finally(() => {
      if (!cancelled) tick();
    });
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    desiredStudioRef.current = sessionKey;
    if (!claimStudioRef.current) return;
    const key = sessionKey;
    const gen = ++studioPutGenRef.current;
    let cancelled = false;
    (async () => {
      try {
        const token = (await ensureLiveToken()) || readLiveToken();
        if (cancelled || !key) return;
        await setStudioChannel(key, token);
        // Late PUT may have overwritten a peer follow / newer claim — restore.
        const desired = desiredStudioRef.current;
        if (
          (gen !== studioPutGenRef.current || (desired && desired !== key)) &&
          desired
        ) {
          await setStudioChannel(desired, token);
        }
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
          applyLiveSnap(snap, sessionKey);
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
      claimStudioRef.current = true;
      desiredStudioRef.current = id;
      channelIntentRef.current = { id, at: Date.now() };
      liveRevRef.current = 0;
      liveUpdatedRef.current = 0;
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
      if (!multiChannel || channelIndex < 0 || pendingDelta.current != null) return;
      const next = neighborId(delta);
      if (!next) return;
      pendingDelta.current = delta;
      setSettling(true);
      setProgress(delta > 0 ? 1 : -1);
      settleTimer.current = window.setTimeout(() => {
        pendingDelta.current = null;
        // Drop settle easing before remount so progress 1→0 does not reverse-jump.
        setSettling(false);
        setProgress(0);
        applyChannel(next);
      }, SWIPE_SETTLE_MS);
    },
    [multiChannel, channelIndex, neighborId, applyChannel]
  );

  const snapBack = useCallback(() => {
    setSettling(true);
    setProgress(0);
    settleTimer.current = window.setTimeout(() => {
      setSettling(false);
    }, SWIPE_SETTLE_MS);
  }, []);

  /**
   * Channel switch + pull-to-refresh only when idle.
   * Pause/resume must keep the same locked layout (no Embla reflow/resize).
   */
  const liveStatus = live?.status || "idle";
  const swipeLocked =
    liveStatus === "running" ||
    liveStatus === "paused" ||
    liveStatus === "break" ||
    liveStatus === "countdown" ||
    liveStatus === "stream_ended";
  const canSwipe = multiChannel && !swipeLocked;
  const canPullRefresh = !swipeLocked;

  useEffect(() => {
    if (!swipeLocked) return;
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    pendingDelta.current = null;
    gesture.current = null;
    pullingRef.current = false;
    setSettling(false);
    setProgress(0);
    setPulling(false);
    setPullY(0);
  }, [swipeLocked]);

  const onTouchStart = (e) => {
    if (refreshing || pendingDelta.current != null) return;
    const t = e.touches?.[0];
    if (!t) return;
    // Volume slider / mute must never start a channel swipe or pull-refresh.
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest(".clozzz-remote__volume")
    ) {
      gesture.current = "ignore";
      pullingRef.current = false;
      setPulling(false);
      setPullY(0);
      return;
    }
    const now = performance.now();
    touchStart.current = { x: t.clientX, y: t.clientY, t: now };
    samples.current = [{ x: t.clientX, t: now }];
    gesture.current = null;
    pullingRef.current = false;
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
      } else if (canPullRefresh && dy > 0 && window.scrollY <= 2) {
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
    const shouldRefresh = canPullRefresh && pullY >= PULL_THRESHOLD_PX;
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
    const skipBusy = Boolean(extras._skipBusy);
    const expectedKey = sessionKey;
    if (!skipBusy) setBusyCmd(busyKey);
    setError("");
    try {
      const token = (await ensureLiveToken()) || readLiveToken();
      const { _busyKey, _skipBusy, ...payload } = extras;
      const snap = await postLiveCommand(expectedKey, command, token, payload);
      applyLiveSnap(snap, expectedKey);
      return true;
    } catch (e) {
      if (e.status === 401) {
        setError("Live control locked — re-unlock this device, then try again.");
      } else {
        setError(e.message || "Command failed");
      }
      return false;
    } finally {
      if (!skipBusy) setBusyCmd(null);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!canSwipe) return;
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
  }, [switchChannel, canSwipe]);

  const status = liveStatus;
  const inCountdown = status === "countdown";
  const inStreamEnded = status === "stream_ended";
  const inBreak = status === "break";
  const breakPaused =
    inBreak &&
    live?.breakStartedAtMs == null &&
    typeof live?.breakPausedRemainingMs === "number";
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
  let primary = { cmd: "start", text: "Start routine" };
  // Pause/Resume share the same primary slot — fixed min-height prevents reflow.
  if (status === "running" || (inBreak && !breakPaused))
    primary = { cmd: "pause", text: "Pause" };
  else if (status === "paused" || breakPaused)
    primary = { cmd: "resume", text: "Resume" };
  else if (status === "done" || inStreamEnded)
    primary = { cmd: "restart", text: "Restart" };
  else if (introHeld) primary = { cmd: "start", text: "Start countdown" };
  else if (logoArmed) primary = { cmd: "start", text: "Start routine" };

  const isBusy = (key) => busyCmd === key;
  const noLive = !live;
  const cueVolume = uiCueVolume;
  const cueMuted = uiCueMuted;

  const setCueAudio = (patch, { debounceMs = 0 } = {}) => {
    const nextVol =
      patch.cueVolume != null ? patch.cueVolume : cueVolume;
    const nextMuted =
      patch.cueMuted != null ? patch.cueMuted : cueMuted;
    rememberCueAudio(nextVol, nextMuted);
    // Local state wins while sliding / until the command lands — polls must not snap back.
    setUiCueVolume(nextVol);
    setUiCueMuted(nextMuted);
    const gen = ++cueAudioGenRef.current;
    // Volume/mute: never set busyCmd — slider must not blink/disable on each tick.
    const push = async () => {
      const ok = await send("set_cue_audio", {
        cueVolume: nextVol,
        cueMuted: nextMuted,
        _skipBusy: true,
      });
      if (cueAudioGenRef.current !== gen) return;
      if (ok) {
        // Leave gen set — sync effect clears once live echoes these values.
        return;
      }
      // Command failed — snap UI back to last server (or stored) values.
      cueAudioGenRef.current = 0;
      const snap = liveRef.current;
      const revertVol =
        typeof snap?.cueVolume === "number"
          ? snap.cueVolume
          : readStoredCueVolume();
      const revertMuted = snap
        ? Boolean(snap.cueMuted)
        : readStoredCueMuted();
      setUiCueVolume(revertVol);
      setUiCueMuted(revertMuted);
      rememberCueAudio(revertVol, revertMuted);
    };
    if (debounceMs > 0) {
      if (cueVolTimerRef.current) window.clearTimeout(cueVolTimerRef.current);
      cueVolTimerRef.current = window.setTimeout(push, debounceMs);
      return;
    }
    if (cueVolTimerRef.current) {
      window.clearTimeout(cueVolTimerRef.current);
      cueVolTimerRef.current = null;
    }
    push();
  };

  const endCueDrag = () => {
    cueDraggingRef.current = false;
  };

  const pullHint =
    refreshing || pullY >= PULL_THRESHOLD_PX
      ? "Release to refresh"
      : pulling
        ? "Pull to refresh"
        : "";

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

      <p className="clozzz-remote__section">Volume</p>
      <div
        className="clozzz-remote__volume"
        role="group"
        aria-label="Volume"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onTouchCancel={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="clozzz-remote__btn clozzz-remote__btn--mute"
          disabled={noLive}
          aria-pressed={cueMuted}
          aria-label={cueMuted ? "Unmute" : "Mute"}
          title={cueMuted ? "Unmute" : "Mute"}
          onClick={() => setCueAudio({ cueMuted: !cueMuted })}
        >
          {cueMuted ? <VolumeMutedIcon /> : <VolumeIcon />}
        </button>
        <label className="clozzz-remote__volume-slider">
          <span className="clozzz-remote__volume-pct">
            {cueMuted ? "Muted" : `${Math.round(cueVolume * 100)}%`}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(cueVolume * 100)}
            disabled={noLive || cueMuted}
            aria-label="Volume"
            onPointerDown={() => {
              cueDraggingRef.current = true;
            }}
            onPointerUp={endCueDrag}
            onPointerCancel={endCueDrag}
            onBlur={endCueDrag}
            onChange={(e) =>
              setCueAudio(
                { cueVolume: Number(e.target.value) / 100 },
                { debounceMs: 180 }
              )
            }
          />
        </label>
      </div>

      {/* Hide/Show + Reset only while paused — avoids accidental taps mid-run. */}
      {status === "paused" || breakPaused ? (
        <>
          <p className="clozzz-remote__section">Overlay</p>
          <button
            type="button"
            className="clozzz-remote__btn"
            disabled={
              noLive || isBusy(chromeVisible ? "hide_chrome" : "show_chrome")
            }
            onClick={() => send(chromeVisible ? "hide_chrome" : "show_chrome")}
          >
            {chromeVisible ? "Hide exercise & timer" : "Show exercise & timer"}
          </button>
          <button
            type="button"
            className="clozzz-remote__btn clozzz-remote__btn--ghost"
            disabled={noLive || isBusy("restart")}
            onClick={() => send("restart")}
          >
            Reset to start
          </button>
        </>
      ) : null}
    </div>
  );

  // Idle/paused: Embla three-slot deck. Live lock: active panel only (no peeks).
  const prevId = canSwipe ? neighborId(-1) : null;
  const nextId = canSwipe ? neighborId(1) : null;
  const slots = canSwipe
    ? [
        { id: prevId, slot: -1 },
        { id: sessionKey, slot: 0 },
        { id: nextId, slot: 1 },
      ]
    : [{ id: sessionKey, slot: 0 }];

  const cardStyle = (slot) => {
    if (swipeLocked || !canSwipe) {
      return {
        transform: "none",
        opacity: 1,
        zIndex: 1,
        transition: "none",
      };
    }
    // Swiper/Embla offsetMultiplier: distance of card from visual center.
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
          <h1 className="clozzz-remote__title">{title}</h1>
          {canSwipe ? (
            <p
              className="clozzz-remote__channel clozzz-remote__channel--mobile"
              aria-live={isActive ? "polite" : undefined}
            >
              {`${idx + 1} of ${channelIds.length}`}
            </p>
          ) : null}
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

  const remoteClass = [
    "clozzz-remote",
    swipeLocked ? "is-swipe-locked" : "",
    canSwipe ? "is-channel-open" : "",
    canPullRefresh ? "" : "is-pull-locked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={remoteClass}
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
                onClick={() => {
                  if (swipeLocked) return;
                  selectChannel(r.id);
                }}
                disabled={swipeLocked && r.id !== sessionKey}
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
        <p className="clozzz-remote__sidebar-hint">
          {swipeLocked ? "← → when idle" : "← → to switch"}
        </p>
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
                  key={id}
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
