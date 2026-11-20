/**
 * Hardcoded sample evening routines for Clozzz OBS overlay v1.
 * R1–R5 titles are invented demos — evening-exercise stubs have no choreography yet.
 *
 * Sessions are addressable by `id` or `name` in the URL:
 *   /clozzz-overlay/r1
 *   /clozzz-overlay/r1-floor-unwind
 *   /clozzz-overlay?session=r3
 */

/** @typedef {{ id: string, label: string, durationSec: number, cue?: string }} Segment */
/** @typedef {{ id: string, name: string, title: string, routineId: string, intent: string, segments: Segment[] }} Session */

/** @type {Session[]} */
export const SESSIONS = [
  {
    id: "demo",
    name: "demo-smoke",
    title: "Demo Smoke",
    routineId: "DEMO",
    intent: "Short segments to verify OBS Browser Source + auto-advance.",
    segments: [
      { id: "demo-s1", label: "Settle in", durationSec: 5, cue: "Overlay check" },
      { id: "demo-s2", label: "Reach overhead", durationSec: 5 },
      { id: "demo-s3", label: "Soft fold", durationSec: 5 },
      { id: "demo-s4", label: "Done soon", durationSec: 4, cue: "Last beat" },
    ],
  },
  {
    id: "r1",
    name: "r1-floor-unwind",
    title: "Floor Unwind",
    routineId: "R1",
    intent: "Gentle floor mobility to downshift before sleep.",
    segments: [
      { id: "r1-s1", label: "Settle & breathe", durationSec: 45, cue: "Lie down, soft belly breaths" },
      { id: "r1-s2", label: "Knee rocks", durationSec: 60, cue: "Slow side-to-side" },
      { id: "r1-s3", label: "Cat–cow", durationSec: 75, cue: "On all fours, easy range" },
      { id: "r1-s4", label: "Child's pose", durationSec: 60, cue: "Arms long, jaw soft" },
      { id: "r1-s5", label: "Supine twist L", durationSec: 45, cue: "Knees left" },
      { id: "r1-s6", label: "Supine twist R", durationSec: 45, cue: "Knees right" },
      { id: "r1-s7", label: "Legs up wall", durationSec: 90, cue: "Or figure-four on floor" },
      { id: "r1-s8", label: "Final stillness", durationSec: 60, cue: "Eyes soft, no agenda" },
    ],
  },
  {
    id: "r2",
    name: "r2-from-bed-stretch",
    title: "From-Bed Stretch",
    routineId: "R2",
    intent: "Low-effort stretches you can do sitting or standing by the bed.",
    segments: [
      { id: "r2-s1", label: "Seated neck rolls", durationSec: 40, cue: "Tiny circles" },
      { id: "r2-s2", label: "Shoulder shrugs", durationSec: 40, cue: "Up · hold · drop" },
      { id: "r2-s3", label: "Chest opener", durationSec: 50, cue: "Hands behind, lift sternum" },
      { id: "r2-s4", label: "Forward fold", durationSec: 55, cue: "Knees soft, hang" },
      { id: "r2-s5", label: "Standing side bend L", durationSec: 35 },
      { id: "r2-s6", label: "Standing side bend R", durationSec: 35 },
      { id: "r2-s7", label: "Calf stretch L", durationSec: 40 },
      { id: "r2-s8", label: "Calf stretch R", durationSec: 40 },
      { id: "r2-s9", label: "Bedside stillness", durationSec: 50, cue: "Sit, slow exhale" },
    ],
  },
  {
    id: "r3",
    name: "r3-small-space-strength",
    title: "Small-Space Strength",
    routineId: "R3",
    intent: "Quiet standing strength in a hotel-room footprint.",
    segments: [
      { id: "r3-s1", label: "March in place", durationSec: 50, cue: "Warm the hips" },
      { id: "r3-s2", label: "Bodyweight squats", durationSec: 70, cue: "Slow down" },
      { id: "r3-s3", label: "Wall push-ups", durationSec: 60 },
      { id: "r3-s4", label: "Glute bridge", durationSec: 65, cue: "On mat or towel" },
      { id: "r3-s5", label: "Standing calf raises", durationSec: 45 },
      { id: "r3-s6", label: "Dead bug (slow)", durationSec: 70, cue: "Exhale on reach" },
      { id: "r3-s7", label: "Cool-down walk", durationSec: 40, cue: "Tiny steps" },
      { id: "r3-s8", label: "Breath reset", durationSec: 50, cue: "4 in · 6 out" },
    ],
  },
  {
    id: "r4",
    name: "r4-hip-back-release",
    title: "Hip & Back Release",
    routineId: "R4",
    intent: "Target hips and low back after a desk day.",
    segments: [
      { id: "r4-s1", label: "World's greatest stretch L", durationSec: 50 },
      { id: "r4-s2", label: "World's greatest stretch R", durationSec: 50 },
      { id: "r4-s3", label: "90/90 hip switch", durationSec: 80, cue: "Easy range" },
      { id: "r4-s4", label: "Pigeon L", durationSec: 55 },
      { id: "r4-s5", label: "Pigeon R", durationSec: 55 },
      { id: "r4-s6", label: "Thread the needle L", durationSec: 40 },
      { id: "r4-s7", label: "Thread the needle R", durationSec: 40 },
      { id: "r4-s8", label: "Happy baby", durationSec: 60 },
      { id: "r4-s9", label: "Savasana cue", durationSec: 45, cue: "Optional lights low" },
    ],
  },
  {
    id: "r5",
    name: "r5-wind-down-circuit",
    title: "Wind-Down Circuit",
    routineId: "R5",
    intent: "Short mixed circuit that ends in stillness.",
    segments: [
      { id: "r5-s1", label: "Box breath ×4", durationSec: 64, cue: "4·4·4·4" },
      { id: "r5-s2", label: "Arm circles", durationSec: 40 },
      { id: "r5-s3", label: "Slow lunges L/R", durationSec: 80, cue: "Alternate" },
      { id: "r5-s4", label: "Plank hold", durationSec: 35, cue: "Knees ok" },
      { id: "r5-s5", label: "Down dog → fold", durationSec: 55 },
      { id: "r5-s6", label: "Seated forward fold", durationSec: 50 },
      { id: "r5-s7", label: "Neck + jaw release", durationSec: 45 },
      { id: "r5-s8", label: "Lights-out stillness", durationSec: 70, cue: "Overlay ends here" },
    ],
  },
];

/**
 * Resolve a session by id or name (case-insensitive).
 * @param {string | null | undefined} key
 * @returns {Session | null}
 */
export function findSession(key) {
  if (!key) return null;
  const needle = String(key).trim().toLowerCase();
  if (!needle) return null;
  return (
    SESSIONS.find(
      (s) =>
        s.id.toLowerCase() === needle ||
        s.name.toLowerCase() === needle ||
        s.routineId.toLowerCase() === needle ||
        s.title.toLowerCase() === needle
    ) ?? null
  );
}

/**
 * Total duration of a session in seconds.
 * @param {Session} session
 */
export function sessionTotalSec(session) {
  return session.segments.reduce((sum, seg) => sum + seg.durationSec, 0);
}
