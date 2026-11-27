/**
 * Clozzz routine helpers + bundled fallback when the API is unreachable.
 * Live catalog is loaded from unified_backend `/clozzz/routines`.
 */

/** @typedef {{ id: string, label: string, durationSec: number }} Segment */

/** Bounded space options for the editor multi-select. */
export const SPACE_OPTIONS = ["Floor mat", "Bed", "Others"];

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   title: string,
 *   routineId: string,
 *   space: string[],
 *   description: string,
 *   introCountdownEnabled?: boolean,
 *   introCountdownSec?: number,
 *   introCountdownMessage?: string,
 *   streamEndedEnabled?: boolean,
 *   streamEndedSec?: number,
 *   streamEndedMessage?: string,
 *   breaksEnabled?: boolean,
 *   breakSec?: number,
 *   timerSoundsEnabled?: boolean,
 *   musicEnabled?: boolean,
 *   musicScope?: "routine" | "session",
 *   segments: Segment[]
 * }} Session
 */
/** @typedef {{ schemaVersion: number, updatedAt?: string, routines: Session[] }} Catalog */

/** New-routine defaults (existing saved routines keep their stored values). */
export const DEFAULT_INTRO_COUNTDOWN_SEC = 1800; // 30 min
/** Soft cap for stream-ended count-up (~1h); not edited in the UI. */
export const STREAM_ENDED_SOFT_CAP_SEC = 3600;
/** @deprecated use STREAM_ENDED_SOFT_CAP_SEC — kept for older imports */
export const DEFAULT_STREAM_ENDED_SEC = STREAM_ENDED_SOFT_CAP_SEC;
export const DEFAULT_EXERCISE_DURATION_SEC = 60;
/** Customary rest between exercises. */
export const DEFAULT_BREAK_SEC = 10;
/** Ambient music scope when musicEnabled. */
export const MUSIC_SCOPE_ROUTINE = "routine";
export const MUSIC_SCOPE_SESSION = "session";

/** @param {unknown} scope */
export function normalizeMusicScope(scope) {
  return scope === MUSIC_SCOPE_SESSION
    ? MUSIC_SCOPE_SESSION
    : MUSIC_SCOPE_ROUTINE;
}

/** Floor 1s (exercises); countdown fields use clampCountdownSec. */
function clampDurationSec(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(60 * 60, Math.round(n)));
}

/** Pre-stream countdown: floor ≥1 minute. */
export function clampCountdownSec(value, fallback = DEFAULT_INTRO_COUNTDOWN_SEC) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(60, Math.min(60 * 60, Math.round(n)));
}

/** Between-exercise break: 1s–5 min. */
export function clampBreakSec(value, fallback = DEFAULT_BREAK_SEC) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(5 * 60, Math.round(n)));
}

/**
 * Migrate legacy free-text `space` string → bounded multi-select array.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeSpace(raw) {
  const allowed = new Set(SPACE_OPTIONS);
  if (Array.isArray(raw)) {
    const out = [];
    for (const item of raw) {
      const s = String(item || "").trim();
      if (allowed.has(s) && !out.includes(s)) out.push(s);
    }
    return out;
  }
  const text = String(raw || "").trim();
  if (!text) return [];
  if (allowed.has(text)) return [text];
  const lower = text.toLowerCase();
  if (lower.includes("floor") || lower.includes("mat")) return ["Floor mat"];
  if (lower.includes("bed")) return ["Bed"];
  return ["Others"];
}

/** Migrate legacy `intent` → `description` on read; keep stored intro/end flags. */
export function normalizeRoutine(routine) {
  if (!routine || typeof routine !== "object") return routine;
  const description = String(
    routine.description ?? routine.intent ?? ""
  ).trim();
  const { intent: _legacyIntent, ...rest } = routine;
  const endedEnabled = Boolean(routine.streamEndedEnabled);
  return {
    ...rest,
    description,
    space: normalizeSpace(routine.space),
    introCountdownEnabled: Boolean(routine.introCountdownEnabled),
    introCountdownSec: clampCountdownSec(
      routine.introCountdownSec,
      DEFAULT_INTRO_COUNTDOWN_SEC
    ),
    introCountdownMessage: String(routine.introCountdownMessage || "").trim(),
    streamEndedEnabled: endedEnabled,
    // Soft cap only — editor no longer edits duration.
    streamEndedSec: STREAM_ENDED_SOFT_CAP_SEC,
    streamEndedMessage: String(routine.streamEndedMessage || "").trim(),
    breaksEnabled: Boolean(routine.breaksEnabled),
    breakSec: clampBreakSec(routine.breakSec, DEFAULT_BREAK_SEC),
    // Missing → timer cues on; music off (existing catalog). New drafts set music on.
    timerSoundsEnabled:
      routine.timerSoundsEnabled === undefined
        ? true
        : Boolean(routine.timerSoundsEnabled),
    musicEnabled: Boolean(routine.musicEnabled),
    musicScope: normalizeMusicScope(routine.musicScope),
  };
}

export function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") return catalog;
  const routines = Array.isArray(catalog.routines)
    ? catalog.routines.map(normalizeRoutine)
    : [];
  return { ...catalog, routines };
}

/** @type {Catalog} */
export const FALLBACK_CATALOG = {
  schemaVersion: 1,
  routines: [
    {
      id: "demo",
      name: "demo-smoke",
      title: "Demo Smoke",
      routineId: "DEMO",
      space: ["Others"],
      description: "Short segments to verify OBS Browser Source + auto-advance.",
      segments: [
        { id: "demo-s1", label: "Settle in", durationSec: 5 },
        { id: "demo-s2", label: "Reach overhead", durationSec: 5 },
        { id: "demo-s3", label: "Soft fold", durationSec: 5 },
        { id: "demo-s4", label: "Done soon", durationSec: 4 },
      ],
    },
    {
      id: "r1",
      name: "r1-floor-unwind",
      title: "Floor Unwind",
      routineId: "R1",
      space: ["Floor mat"],
      description: "Gentle floor mobility to downshift before sleep.",
      segments: [
        { id: "r1-s1", label: "Settle & breathe", durationSec: 45 },
        { id: "r1-s2", label: "Knee rocks", durationSec: 60 },
        { id: "r1-s3", label: "Cat–cow", durationSec: 75 },
        { id: "r1-s4", label: "Child's pose", durationSec: 60 },
        { id: "r1-s5", label: "Supine twist L", durationSec: 45 },
        { id: "r1-s6", label: "Supine twist R", durationSec: 45 },
        { id: "r1-s7", label: "Legs up wall", durationSec: 90 },
        { id: "r1-s8", label: "Final stillness", durationSec: 60 },
      ],
    },
    {
      id: "r2",
      name: "r2-from-bed-stretch",
      title: "From-Bed Stretch",
      routineId: "R2",
      space: ["Bed"],
      description: "Low-effort stretches you can do sitting or standing by the bed.",
      segments: [
        { id: "r2-s1", label: "Seated neck rolls", durationSec: 40 },
        { id: "r2-s2", label: "Shoulder shrugs", durationSec: 40 },
        { id: "r2-s3", label: "Chest opener", durationSec: 50 },
        { id: "r2-s4", label: "Forward fold", durationSec: 55 },
        { id: "r2-s5", label: "Standing side bend L", durationSec: 35 },
        { id: "r2-s6", label: "Standing side bend R", durationSec: 35 },
        { id: "r2-s7", label: "Calf stretch L", durationSec: 40 },
        { id: "r2-s8", label: "Calf stretch R", durationSec: 40 },
        { id: "r2-s9", label: "Bedside stillness", durationSec: 50 },
      ],
    },
    {
      id: "r3",
      name: "r3-small-space-strength",
      title: "Small-Space Strength",
      routineId: "R3",
      space: ["Others"],
      description: "Quiet standing strength in a hotel-room footprint.",
      segments: [
        { id: "r3-s1", label: "March in place", durationSec: 50 },
        { id: "r3-s2", label: "Bodyweight squats", durationSec: 70 },
        { id: "r3-s3", label: "Wall push-ups", durationSec: 60 },
        { id: "r3-s4", label: "Glute bridge", durationSec: 65 },
        { id: "r3-s5", label: "Standing calf raises", durationSec: 45 },
        { id: "r3-s6", label: "Dead bug (slow)", durationSec: 70 },
        { id: "r3-s7", label: "Cool-down walk", durationSec: 40 },
        { id: "r3-s8", label: "Breath reset", durationSec: 50 },
      ],
    },
    {
      id: "r4",
      name: "r4-hip-back-release",
      title: "Hip & Back Release",
      routineId: "R4",
      space: ["Floor mat"],
      description: "Target hips and low back after a desk day.",
      segments: [
        { id: "r4-s1", label: "World's greatest stretch L", durationSec: 50 },
        { id: "r4-s2", label: "World's greatest stretch R", durationSec: 50 },
        { id: "r4-s3", label: "90/90 hip switch", durationSec: 80 },
        { id: "r4-s4", label: "Pigeon L", durationSec: 55 },
        { id: "r4-s5", label: "Pigeon R", durationSec: 55 },
        { id: "r4-s6", label: "Thread the needle L", durationSec: 40 },
        { id: "r4-s7", label: "Thread the needle R", durationSec: 40 },
        { id: "r4-s8", label: "Happy baby", durationSec: 60 },
        { id: "r4-s9", label: "Savasana", durationSec: 45 },
      ],
    },
    {
      id: "r5",
      name: "r5-wind-down-circuit",
      title: "Wind-Down Circuit",
      routineId: "R5",
      space: ["Others"],
      description: "Short mixed circuit that ends in stillness.",
      segments: [
        { id: "r5-s1", label: "Box breath ×4", durationSec: 64 },
        { id: "r5-s2", label: "Arm circles", durationSec: 40 },
        { id: "r5-s3", label: "Slow lunges L/R", durationSec: 80 },
        { id: "r5-s4", label: "Plank hold", durationSec: 35 },
        { id: "r5-s5", label: "Down dog → fold", durationSec: 55 },
        { id: "r5-s6", label: "Seated forward fold", durationSec: 50 },
        { id: "r5-s7", label: "Neck + jaw release", durationSec: 45 },
        { id: "r5-s8", label: "Lights-out stillness", durationSec: 70 },
      ],
    },
  ],
};

/** @deprecated use catalog.routines — kept for gradual migration */
export const SESSIONS = FALLBACK_CATALOG.routines;

/**
 * @param {Session[]} routines
 * @param {string | null | undefined} key
 * @returns {Session | null}
 */
export function findSessionIn(routines, key) {
  if (!key) return null;
  const needle = String(key).trim().toLowerCase();
  if (!needle) return null;
  return (
    routines.find(
      (s) =>
        s.id.toLowerCase() === needle ||
        s.name.toLowerCase() === needle ||
        s.routineId.toLowerCase() === needle ||
        s.title.toLowerCase() === needle
    ) ?? null
  );
}

/**
 * Resolve a session by id or name (case-insensitive) against the fallback list.
 * @param {string | null | undefined} key
 * @returns {Session | null}
 */
export function findSession(key) {
  return findSessionIn(FALLBACK_CATALOG.routines, key);
}

/**
 * @param {Session} session
 */
export function sessionTotalSec(session) {
  return session.segments.reduce((sum, seg) => sum + seg.durationSec, 0);
}

export function formatDuration(totalSec) {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "routine";
}

/**
 * Next R# / r# ids from existing routines (skips DEMO-style labels).
 * @param {Session[]} routines
 */
export function nextRoutineCodes(routines = []) {
  let max = 0;
  for (const r of routines) {
    for (const raw of [r.routineId, r.id]) {
      const m = String(raw || "").match(/(\d+)/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  const n = max + 1;
  return { n, routineId: `R${n}`, id: `r${n}` };
}

/**
 * @param {Session[]} [existing]
 * @param {Partial<Session>} [overrides]
 * @returns {Session & { localOnly?: boolean }}
 */
export function blankRoutine(existing = [], overrides = {}) {
  const { routineId, id } = nextRoutineCodes(existing);
  const title = overrides.title || "New routine";
  return {
    id: overrides.id || id,
    name: overrides.name || `${id}-${slugify(title)}`,
    title,
    routineId: overrides.routineId || routineId,
    space: normalizeSpace(overrides.space),
    description: overrides.description || overrides.intent || "",
    introCountdownEnabled:
      overrides.introCountdownEnabled !== undefined
        ? Boolean(overrides.introCountdownEnabled)
        : true,
    introCountdownSec: clampCountdownSec(
      overrides.introCountdownSec,
      DEFAULT_INTRO_COUNTDOWN_SEC
    ),
    introCountdownMessage: String(overrides.introCountdownMessage || "").trim(),
    streamEndedEnabled:
      overrides.streamEndedEnabled !== undefined
        ? Boolean(overrides.streamEndedEnabled)
        : true,
    streamEndedSec: STREAM_ENDED_SOFT_CAP_SEC,
    streamEndedMessage: String(overrides.streamEndedMessage || "").trim(),
    breaksEnabled:
      overrides.breaksEnabled !== undefined
        ? Boolean(overrides.breaksEnabled)
        : true,
    breakSec: clampBreakSec(overrides.breakSec, DEFAULT_BREAK_SEC),
    timerSoundsEnabled:
      overrides.timerSoundsEnabled !== undefined
        ? Boolean(overrides.timerSoundsEnabled)
        : true,
    musicEnabled:
      overrides.musicEnabled !== undefined
        ? Boolean(overrides.musicEnabled)
        : true,
    musicScope: normalizeMusicScope(
      overrides.musicScope !== undefined
        ? overrides.musicScope
        : MUSIC_SCOPE_ROUTINE
    ),
    segments: overrides.segments || [
      {
        id: newId("seg"),
        label: "New exercise",
        durationSec: DEFAULT_EXERCISE_DURATION_SEC,
      },
    ],
    localOnly: true,
  };
}

/** Strip client-only flags before sending to the API. */
export function toServerRoutine(routine) {
  const { localOnly, dirty, ...rest } = routine;
  return {
    ...rest,
    space: normalizeSpace(rest.space),
    introCountdownMessage: String(rest.introCountdownMessage || "").trim(),
    streamEndedSec: STREAM_ENDED_SOFT_CAP_SEC,
    breaksEnabled: Boolean(rest.breaksEnabled),
    breakSec: clampBreakSec(rest.breakSec, DEFAULT_BREAK_SEC),
    timerSoundsEnabled:
      rest.timerSoundsEnabled === undefined
        ? true
        : Boolean(rest.timerSoundsEnabled),
    musicEnabled: Boolean(rest.musicEnabled),
    musicScope: normalizeMusicScope(rest.musicScope),
  };
}

/**
 * Old Fly builds silently drop breaksEnabled/breakSec on normalize — UI would
 * still say Saved. Throw so the editor does not lie.
 * @param {Partial<Session>} sent
 * @param {Catalog} catalog
 */
export function assertBreakFieldsPersisted(sent, catalog) {
  if (!sent || !catalog) return;
  const id = String(sent.id || "").toLowerCase();
  const got = (catalog.routines || []).find(
    (r) => String(r.id || "").toLowerCase() === id
  );
  if (!got) return;
  if (!Object.prototype.hasOwnProperty.call(got, "breaksEnabled")) {
    throw new Error(
      "Breaks were not saved — backend is outdated. Deploy unified-backend to Fly (fly deploy), then try again."
    );
  }
  if (Boolean(got.breaksEnabled) !== Boolean(sent.breaksEnabled)) {
    throw new Error(
      "Breaks toggle did not persist on the server. Redeploy unified-backend, then save again."
    );
  }
  if (
    sent.breaksEnabled &&
    clampBreakSec(got.breakSec) !== clampBreakSec(sent.breakSec)
  ) {
    throw new Error(
      "Break duration did not persist on the server. Redeploy unified-backend, then save again."
    );
  }
}

/**
 * Sound prefs must round-trip; old Fly builds silently drop unknown fields.
 * @param {Partial<Session>} sent
 * @param {Catalog} catalog
 */
export function assertSoundFieldsPersisted(sent, catalog) {
  if (!sent || !catalog) return;
  const id = String(sent.id || "").toLowerCase();
  const got = (catalog.routines || []).find(
    (r) => String(r.id || "").toLowerCase() === id
  );
  if (!got) return;
  if (!Object.prototype.hasOwnProperty.call(got, "musicEnabled")) {
    throw new Error(
      "Sound options were not saved — backend is outdated. Deploy unified-backend to Fly (fly deploy), then try again."
    );
  }
  const sentTimer =
    sent.timerSoundsEnabled === undefined
      ? true
      : Boolean(sent.timerSoundsEnabled);
  const gotTimer =
    got.timerSoundsEnabled === undefined
      ? true
      : Boolean(got.timerSoundsEnabled);
  if (gotTimer !== sentTimer) {
    throw new Error(
      "Timer sounds toggle did not persist. Redeploy unified-backend, then save again."
    );
  }
  if (Boolean(got.musicEnabled) !== Boolean(sent.musicEnabled)) {
    throw new Error(
      "Music toggle did not persist. Redeploy unified-backend, then save again."
    );
  }
  if (
    sent.musicEnabled &&
    normalizeMusicScope(got.musicScope) !== normalizeMusicScope(sent.musicScope)
  ) {
    throw new Error(
      "Music scope did not persist. Redeploy unified-backend, then save again."
    );
  }
}
