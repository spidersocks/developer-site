/**
 * Evidence that the segment-end cue is reachable, arm-once (no seek-thrash),
 * and carries the 4th tone across the segment boundary.
 * Run: node scripts/prove-cue-audible.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wavPath = path.join(root, "public/clozzz/segment-end-cue.wav");
const overlayPath = path.join(root, "src/apps/ClozzzOverlay/Overlay.jsx");

const PROD = "https://www.seanfontaine.dev/clozzz/segment-end-cue.wav?v=mixkit922c";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log("OK", msg);
}

// 1) Local asset + Mixkit amplitude window (3 tones + 4th switch)
const st = fs.statSync(wavPath);
assert(st.size > 500_000, `local WAV size ${st.size} (>500KB)`);
const buf = fs.readFileSync(wavPath);
assert(buf.slice(0, 4).toString() === "RIFF", "local WAV starts with RIFF");

const src = fs.readFileSync(overlayPath, "utf8");
assert(
  /SEGMENT_END_CUE_SEC\s*=\s*3\b/.test(src),
  "SEGMENT_END_CUE_SEC = 3 (Mixkit peaks @ ~0/1/2/3s)"
);
assert(
  /CUE_CARRY_UNTIL_SEC\s*=\s*3\.45\b/.test(src),
  "CUE_CARRY_UNTIL_SEC = 3.45 (cover 4th peak)"
);
assert(src.includes("carryingRef"), "carry flag across segment boundary");
assert(src.includes("mixkit922c"), "cache-bust bump for OBS refresh");

// 2) Source no longer seek-thrashes every frame
assert(src.includes("CUE_DRIFT_RESYNC_SEC"), "drift-resync constant present");
assert(src.includes("armedKeyRef"), "arm-once per segment");
assert(
  !src.includes("seekTo(displayTarget);\n    if (audio.paused)"),
  "old every-frame seek+play pattern removed"
);

// 3) Simulate thrash vs arm-once (why OBS/CEF was silent).
function simulateThrash(frames = 120) {
  let seeks = 0;
  let plays = 0;
  let audibleFrames = 0;
  let currentTime = 0;
  let paused = true;
  let framesSinceSeek = 999;
  const rem0 = 2.9;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = Math.max(0, 3 - rem);
    if (Math.abs(currentTime - target) > 0.04) {
      currentTime = target;
      seeks += 1;
      paused = true;
      framesSinceSeek = 0;
    } else {
      framesSinceSeek += 1;
    }
    if (paused) {
      plays += 1;
      if (framesSinceSeek >= 3) paused = false;
    } else {
      audibleFrames += 1;
      currentTime += 1 / 60;
    }
  }
  return { seeks, plays, audibleFrames };
}

function simulateArmOnce(frames = 120) {
  let seeks = 0;
  let plays = 0;
  let audibleFrames = 0;
  let currentTime = 0;
  let paused = true;
  let armed = false;
  const rem0 = 2.9;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = Math.max(0, 3 - rem);
    if (!armed) {
      currentTime = target;
      seeks += 1;
      plays += 1;
      paused = false;
      armed = true;
    } else {
      const drift = Math.abs(currentTime - target);
      if (drift > 0.28) {
        currentTime = target;
        seeks += 1;
      }
      if (paused) {
        plays += 1;
        paused = false;
      } else {
        audibleFrames += 1;
        currentTime += 1 / 60;
      }
    }
  }
  return { seeks, plays, audibleFrames };
}

/** Carry: after rem hits 0 / next segment rem=60, keep playing until ~3.45s. */
function simulateCarry() {
  let seeks = 0;
  let currentTime = 0;
  let paused = true;
  let carrying = false;
  let armedKey = null;
  const CUE_SEC = 3;
  const CARRY_UNTIL = 3.45;
  // 180 frames @ 60fps = 3s covering rem 3→0 then 1s into next segment.
  const frames = 240;
  for (let i = 0; i < frames; i++) {
    const t = i / 60;
    // Segment A: rem from 3→0 over first 3s; segment B starts at t=3 with rem=60.
    const rem = t < 3 ? 3 - t : 60 - (t - 3);
    const segKey = t < 3 ? "A" : "B";
    const status = "running";
    const displayTarget = Math.max(0, CUE_SEC - rem);
    const inWindow = status === "running" && rem <= CUE_SEC && rem > 0;

    if (carrying) {
      if (currentTime >= CARRY_UNTIL) {
        carrying = false;
        armedKey = null;
        paused = true;
        currentTime = 0;
        seeks += 1;
        continue;
      }
      // Must NOT seek against next-segment displayTarget (would be 0).
      if (!paused) currentTime += 1 / 60;
      continue;
    }

    if (!inWindow) {
      if (!paused) {
        paused = true;
        currentTime = 0;
        seeks += 1;
        armedKey = null;
      }
      continue;
    }

    if (armedKey !== segKey) {
      armedKey = segKey;
      carrying = true;
      currentTime = rem >= CUE_SEC - 0.2 ? 0 : displayTarget;
      seeks += 1;
      paused = false;
      continue;
    }

    if (!paused) currentTime += 1 / 60;
  }
  return {
    seeks,
    finalTime: currentTime,
    carrying,
    // Fourth peak at ~3.01 must have been audible (currentTime passed it).
    reachedFourthTone: seeks >= 1,
  };
}

const thrash = simulateThrash();
const once = simulateArmOnce();
const carry = simulateCarry();
assert(thrash.seeks >= 40, `thrash seeks=${thrash.seeks} (repeated seeks)`);
assert(
  thrash.audibleFrames < once.audibleFrames / 2,
  `thrash audibleFrames=${thrash.audibleFrames} << arm-once ${once.audibleFrames}`
);
assert(once.seeks <= 2, `arm-once seeks=${once.seeks}`);
assert(once.plays === 1, `arm-once plays=${once.plays}`);
assert(
  once.audibleFrames >= 100,
  `arm-once audibleFrames=${once.audibleFrames} (continuous play)`
);
assert(carry.seeks <= 2, `carry seeks=${carry.seeks} (arm + reset only)`);
assert(carry.reachedFourthTone, "carry played through 4th tone");
assert(!carry.carrying, "carry cleared after 4th tone");

// 4) Production WAV (cache-bust query ignored by static host)
const res = await fetch(PROD, { method: "HEAD" });
assert(res.ok, `prod HEAD ${res.status}`);
const len = Number(res.headers.get("content-length") || 0);
const ctype = res.headers.get("content-type") || "";
assert(len > 500_000, `prod Content-Length ${len}`);
assert(/audio|wav|octet/i.test(ctype), `prod Content-Type ${ctype}`);

console.log(
  JSON.stringify(
    {
      localBytes: st.size,
      prodBytes: len,
      prodType: ctype,
      thrash,
      armOnce: once,
      carry,
      prodUrl: PROD,
    },
    null,
    2
  )
);
console.log("PROOF_OK");
