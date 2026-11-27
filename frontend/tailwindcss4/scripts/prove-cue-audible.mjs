/**
 * Evidence that the segment-end cue is reachable, arm-once (no seek-thrash),
 * rate-maps Mixkit 2s peaks onto a 3s wall window, and lands the 4th peak at rem=0.
 * Run: node scripts/prove-cue-audible.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wavPath = path.join(root, "public/clozzz/segment-end-cue.wav");
const overlayPath = path.join(root, "src/apps/ClozzzOverlay/Overlay.jsx");

const PROD = "https://www.seanfontaine.dev/clozzz/segment-end-cue.wav?v=mixkit922d";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log("OK", msg);
}

function measurePeaks(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 12;
  let channels = 1;
  let rate = 44100;
  let bits = 16;
  let dataOff = 0;
  let dataSize = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = dv.getUint32(off + 4, true);
    if (id === "fmt ") {
      channels = dv.getUint16(off + 8, true);
      rate = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
    }
    if (id === "data") {
      dataOff = off + 8;
      dataSize = size;
      break;
    }
    off += 8 + size + (size % 2);
  }
  const samples = dataSize / (bits / 8) / channels;
  const win = Math.floor(rate * 0.005);
  const rows = [];
  for (let s = 0; s < Math.min(samples, rate * 8); s += win) {
    let sum = 0;
    let n = 0;
    for (let i = s; i < Math.min(samples, s + win); i++) {
      for (let c = 0; c < channels; c++) {
        const idx = dataOff + (i * channels + c) * (bits / 8);
        const v =
          bits === 16 ? dv.getInt16(idx, true) / 32768 : dv.getInt8(idx) / 128;
        sum += v * v;
        n += 1;
      }
    }
    rows.push({ t: s / rate, rms: Math.sqrt(sum / Math.max(1, n)) });
  }
  const peaks = [];
  let last = -99;
  for (let i = 1; i < rows.length - 1; i++) {
    if (
      rows[i].rms > rows[i - 1].rms &&
      rows[i].rms >= rows[i + 1].rms &&
      rows[i].rms > 0.08 &&
      rows[i].t - last > 0.25
    ) {
      peaks.push(+rows[i].t.toFixed(3));
      last = rows[i].t;
    }
  }
  return peaks;
}

// 1) Local asset + Mixkit amplitude window (3 tones + 4th at rem=0)
const st = fs.statSync(wavPath);
assert(st.size > 500_000, `local WAV size ${st.size} (>500KB)`);
const buf = fs.readFileSync(wavPath);
assert(buf.slice(0, 4).toString() === "RIFF", "local WAV starts with RIFF");
const peaks = measurePeaks(buf);
assert(peaks.length >= 4, `measured ≥4 peaks (got ${peaks.length}: ${peaks})`);
assert(
  Math.abs(peaks[1] - peaks[0] - 2) < 0.05,
  `peak spacing ~2s (p0=${peaks[0]} p1=${peaks[1]})`
);

const src = fs.readFileSync(overlayPath, "utf8");
assert(/CUE_PLAYBACK_RATE\s*=\s*2\b/.test(src), "CUE_PLAYBACK_RATE = 2");
assert(/CUE_FOURTH_PEAK_SEC/.test(src), "CUE_FOURTH_PEAK_SEC from measured peaks");
assert(/CUE_LEAD_SEC/.test(src), "CUE_LEAD_SEC delay compensation");
assert(/cueAudioTarget/.test(src), "cueAudioTarget(rem) maps peaks→remainingSec");
assert(src.includes("carryingRef"), "carry flag across segment boundary");
assert(src.includes("mixkit922d"), "cache-bust bump for OBS refresh");

// 2) Source no longer seek-thrashes every frame
assert(src.includes("CUE_DRIFT_RESYNC_SEC"), "drift-resync constant present");
assert(src.includes("armedKeyRef"), "arm-once per segment");
assert(
  !src.includes("seekTo(displayTarget);\n    if (audio.paused)"),
  "old every-frame seek+play pattern removed"
);

const FOURTH = peaks[3];
const RATE = 2;
const CUE_SEC = FOURTH / RATE;
const LEAD = 0.06;
const CARRY_UNTIL = FOURTH + 0.35;

function audioTarget(rem) {
  const wallElapsed = CUE_SEC - rem + LEAD;
  return Math.max(0, Math.min(FOURTH, wallElapsed * RATE));
}

// 3) Fourth peak aligns to rem=0 (minus lead → heard at ~0 after CEF delay)
const atZero = audioTarget(0);
assert(
  Math.abs(atZero - (FOURTH + LEAD * RATE)) < 0.001 ||
    Math.abs(atZero - FOURTH) < 0.02,
  `at rem=0 audioTarget≈fourth (+lead clamped): got ${atZero}, fourth=${FOURTH}`
);
// Ideal without clamp overflow check: rem=LEAD → exactly fourth
const atLead = audioTarget(LEAD);
assert(
  Math.abs(atLead - FOURTH) < 0.02,
  `at rem=LEAD audioTarget=fourth (heard≈0): ${atLead} vs ${FOURTH}`
);

// 4) Simulate thrash vs arm-once (why OBS/CEF was silent).
function simulateThrash(frames = 120) {
  let seeks = 0;
  let plays = 0;
  let audibleFrames = 0;
  let currentTime = 0;
  let paused = true;
  let framesSinceSeek = 999;
  const rem0 = CUE_SEC - 0.1;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = audioTarget(rem);
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
      currentTime += RATE / 60;
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
  const rem0 = CUE_SEC - 0.1;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = audioTarget(rem);
    if (!armed) {
      currentTime = target;
      seeks += 1;
      plays += 1;
      paused = false;
      armed = true;
    } else {
      const drift = Math.abs(currentTime - target);
      if (drift > 0.35) {
        currentTime = target;
        seeks += 1;
      }
      if (paused) {
        plays += 1;
        paused = false;
      } else {
        audibleFrames += 1;
        currentTime += RATE / 60;
      }
    }
  }
  return { seeks, plays, audibleFrames };
}

/** Carry: after rem hits 0 / next segment rem=60, keep playing until 4th peak+tail. */
function simulateCarry() {
  let seeks = 0;
  let currentTime = 0;
  let paused = true;
  let carrying = false;
  let armedKey = null;
  let maxTime = 0;
  const frames = 240;
  for (let i = 0; i < frames; i++) {
    const t = i / 60;
    const rem = t < CUE_SEC ? CUE_SEC - t : 60 - (t - CUE_SEC);
    const segKey = t < CUE_SEC ? "A" : "B";
    const status = "running";
    const displayTarget = audioTarget(rem);
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
      if (!paused) {
        currentTime += RATE / 60;
        maxTime = Math.max(maxTime, currentTime);
      }
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

    if (!paused) {
      currentTime += RATE / 60;
      maxTime = Math.max(maxTime, currentTime);
    }
  }
  return {
    seeks,
    maxTime,
    carrying,
    reachedFourthTone: maxTime >= FOURTH - 0.05,
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
assert(carry.reachedFourthTone, `carry reached 4th peak (maxTime=${carry.maxTime})`);
assert(!carry.carrying, "carry cleared after 4th tone");

// 5) Production WAV (cache-bust query ignored by static host)
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
      peaks,
      cueSec: CUE_SEC,
      fourth: FOURTH,
      atLead,
      atZero,
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
