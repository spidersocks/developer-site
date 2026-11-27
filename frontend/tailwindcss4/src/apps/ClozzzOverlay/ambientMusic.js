/**
 * Clozzz ambient playlist — 9 licensed instrumentals for OBS overlay.
 * Shuffled order; reshuffle when exhausted. Dual HTMLAudio for near-gapless handoff.
 */

import {
  MUSIC_SCOPE_ROUTINE,
  MUSIC_SCOPE_SESSION,
  normalizeMusicScope,
} from "./routines.js";

export { MUSIC_SCOPE_ROUTINE, MUSIC_SCOPE_SESSION, normalizeMusicScope };

export const AMBIENT_TRACKS = [
  "/clozzz/music/aves-extra-sauce.mp3",
  "/clozzz/music/curtis-cole-chillax.mp3",
  "/clozzz/music/elifas-sonaru-calm-breeze.mp3",
  "/clozzz/music/frozenjazz-mellow-sofa.mp3",
  "/clozzz/music/keston-wright-summertime.mp3",
  "/clozzz/music/kitrano-grateful.mp3",
  "/clozzz/music/mansij-eternal-sleep.mp3",
  "/clozzz/music/steven-beddall-heavenly-mellow.mp3",
  "/clozzz/music/wav-two-fleeting-colors.mp3",
];

/** Base music level before cue-volume / duck scaling. */
export const MUSIC_BASE_GAIN = 0.32;
/** Brief duck while Mixkit timer cue peaks (so beeps stay clear). */
export const MUSIC_CUE_DUCK = 0.45;
/** Start next track this many seconds before current ends. */
const HANDOFF_LEAD_SEC = 0.12;

/**
 * Whether ambient music should be audible for this live status + scope.
 * @param {string | undefined} status
 * @param {"routine" | "session"} scope
 */
export function musicWantedForStatus(status, scope) {
  const s = String(status || "");
  if (scope === MUSIC_SCOPE_SESSION) {
    return (
      s === "countdown" ||
      s === "running" ||
      s === "paused" ||
      s === "break" ||
      s === "stream_ended"
    );
  }
  // Routine only: exercises + breaks (incl. paused mid-routine).
  return s === "running" || s === "paused" || s === "break";
}

/** Fisher–Yates shuffle into a new array. */
export function shuffleTracks(list = AMBIENT_TRACKS) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Dual-element playlist controller. Call tick() from a rAF/effect; call
 * setActive / setVolume / setDuck as prefs + live state change.
 */
export function createAmbientPlaylist({ tracks = AMBIENT_TRACKS } = {}) {
  const a = new Audio();
  const b = new Audio();
  a.preload = "auto";
  b.preload = "auto";
  a.crossOrigin = "anonymous";
  b.crossOrigin = "anonymous";

  let playlist = shuffleTracks(tracks);
  let index = 0;
  let active = a;
  let standby = b;
  let wanted = false;
  let volume = MUSIC_BASE_GAIN;
  let duck = 1;
  let handoffArmed = false;
  let started = false;
  let disposed = false;

  const applyVolume = () => {
    const v = Math.max(0, Math.min(1, volume * duck));
    a.volume = v;
    b.volume = v;
  };

  const loadStandby = () => {
    const nextIdx = (index + 1) % playlist.length;
    const src = playlist[nextIdx];
    if (standby.src && standby.src.endsWith(src.replace(/^\//, ""))) return;
    try {
      standby.src = src;
      standby.load();
    } catch {
      /* ignore */
    }
  };

  const reshuffleIfNeeded = () => {
    if (index + 1 >= playlist.length) {
      const last = playlist[playlist.length - 1];
      let next = shuffleTracks(tracks);
      // Avoid immediate repeat of the last track when reshuffling.
      if (next.length > 1 && next[0] === last) {
        const swap = next[1];
        next[1] = next[0];
        next[0] = swap;
      }
      playlist = next;
      index = -1; // advance() will bump to 0
    }
  };

  const playActive = () => {
    if (disposed || !wanted) return;
    const p = active.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* OBS CEF autoplay / not warmed yet — tick will retry */
      });
    }
  };

  const startCurrent = () => {
    if (disposed) return;
    const src = playlist[Math.max(0, index)];
    try {
      if (!active.src || !active.src.includes(src.split("/").pop() || "")) {
        active.src = src;
        active.load();
      }
    } catch {
      /* ignore */
    }
    active.currentTime = 0;
    handoffArmed = false;
    started = true;
    loadStandby();
    playActive();
  };

  const advance = () => {
    reshuffleIfNeeded();
    index = (index + 1) % playlist.length;
    // Swap roles so standby (already loading next) becomes active.
    const prev = active;
    active = standby;
    standby = prev;
    try {
      prev.pause();
    } catch {
      /* ignore */
    }
    handoffArmed = false;
    loadStandby();
    playActive();
  };

  const onTimeUpdate = () => {
    if (!wanted || !started || disposed) return;
    const dur = active.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    const left = dur - active.currentTime;
    if (left <= HANDOFF_LEAD_SEC && !handoffArmed) {
      handoffArmed = true;
      // Ensure next index/src ready, then cross into standby.
      reshuffleIfNeeded();
      const nextIdx = (index + 1) % playlist.length;
      const nextSrc = playlist[nextIdx];
      try {
        if (!standby.src || !standby.src.includes(nextSrc.split("/").pop() || "")) {
          standby.src = nextSrc;
          standby.load();
        }
      } catch {
        /* ignore */
      }
      const swap = () => {
        index = nextIdx;
        const prev = active;
        active = standby;
        standby = prev;
        try {
          prev.pause();
        } catch {
          /* ignore */
        }
        handoffArmed = false;
        loadStandby();
        playActive();
      };
      const p = standby.play();
      if (p && typeof p.then === "function") {
        p.then(swap).catch(() => {
          // Fallback: wait for ended.
          handoffArmed = false;
        });
      } else {
        swap();
      }
    }
  };

  const onEnded = () => {
    if (!wanted || disposed) return;
    // Handoff may have already swapped; only advance if this element is still active.
    advance();
  };

  a.addEventListener("timeupdate", () => {
    if (active === a) onTimeUpdate();
  });
  b.addEventListener("timeupdate", () => {
    if (active === b) onTimeUpdate();
  });
  a.addEventListener("ended", () => {
    if (active === a) onEnded();
  });
  b.addEventListener("ended", () => {
    if (active === b) onEnded();
  });

  applyVolume();

  return {
    setActive(nextWanted) {
      if (disposed) return;
      const on = Boolean(nextWanted);
      if (on === wanted) {
        if (on && active.paused) playActive();
        return;
      }
      wanted = on;
      if (!on) {
        try {
          a.pause();
          b.pause();
        } catch {
          /* ignore */
        }
        started = false;
        handoffArmed = false;
        return;
      }
      if (!started) {
        index = 0;
        playlist = shuffleTracks(tracks);
        startCurrent();
      } else {
        playActive();
      }
    },
    setVolume(next) {
      const n = Number(next);
      volume = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : MUSIC_BASE_GAIN;
      applyVolume();
    },
    setDuck(factor) {
      const n = Number(factor);
      duck = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
      applyVolume();
    },
    /** Warm autoplay after a user gesture / first live tick. */
    resume() {
      if (!wanted || disposed) return;
      playActive();
    },
    dispose() {
      disposed = true;
      wanted = false;
      try {
        a.pause();
        b.pause();
      } catch {
        /* ignore */
      }
      a.removeAttribute("src");
      b.removeAttribute("src");
    },
  };
}
