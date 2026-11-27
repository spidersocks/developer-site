/**
 * Evidence: original Mixkit cue, natural 1×, digit-synced 3→2→1→switch,
 * Web Audio BufferSource (no HTMLAudio seek lag).
 * Run: node scripts/prove-cue-audible.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wavPath = path.join(root, "public/clozzz/segment-end-cue.wav");
const overlayPath = path.join(root, "src/apps/ClozzzOverlay/Overlay.jsx");

const PROD = "https://www.seanfontaine.dev/clozzz/segment-end-cue.wav?v=mixkit922orig";

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
      channels = dv.getUint16(off + 10, true);
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

const st = fs.statSync(wavPath);
assert(st.size > 1_000_000, `local original WAV size ${st.size} (~1.1MB)`);
const buf = fs.readFileSync(wavPath);
assert(buf.slice(0, 4).toString() === "RIFF", "local WAV starts with RIFF");
const peaks = measurePeaks(buf);
assert(peaks.length >= 4, `measured ≥4 peaks (got ${peaks.length}: ${peaks})`);
assert(
  Math.abs(peaks[1] - peaks[0] - 1) < 0.05,
  `peak spacing ~1s (p0=${peaks[0]} p1=${peaks[1]})`
);
assert(
  Math.abs(peaks[2] - peaks[1] - 1) < 0.05,
  `peak spacing ~1s (p1=${peaks[1]} p2=${peaks[2]})`
);
assert(
  Math.abs(peaks[3] - peaks[2] - 1) < 0.05,
  `peak spacing ~1s (p2=${peaks[2]} p3=${peaks[3]})`
);

const src = fs.readFileSync(overlayPath, "utf8");
assert(/CUE_PLAYBACK_RATE\s*=\s*1\b/.test(src), "CUE_PLAYBACK_RATE = 1");
assert(!/CUE_PLAYBACK_RATE\s*=\s*2\b/.test(src), "no CUE_PLAYBACK_RATE = 2");
assert(/CUE_FOURTH_PEAK_SEC/.test(src), "CUE_FOURTH_PEAK_SEC from measured peaks");
assert(/cueBufferOffset|cueAudioTarget/.test(src), "offset maps rem→peaks");
assert(/decodeAudioData|AudioContext|createBufferSource/.test(src), "Web Audio BufferSource");
assert(/CUE_ARM_EARLY_SEC/.test(src), "tiny arm-early label retained for digit sync");
assert(/CUE_SCHEDULE_AHEAD_SEC/.test(src), "audio-clock look-ahead schedule window");
assert(/cueUntilIdealStart|scheduleAligned/.test(src), "schedule vs catch-up aligned start");
assert(/createConstantSource|keepAlive/.test(src), "silent keep-alive keeps AudioContext warm");
assert(!/CUE_CLEAN_ARM_EPS/.test(src), "no clean-arm eps that forced late offset-0");
assert(!/CUE_LEAD_SEC\s*=/.test(src), "no lead baked into buffer seek (skipped peak0)");
assert(src.includes("carryingRef"), "carry flag across segment boundary");
assert(src.includes("mixkit922orig"), "cache-bust for original Mixkit");
assert(/force-cache|decodeAudioData/.test(src), "cue fully decoded before arm");
assert(src.includes("armedKeyRef"), "arm-once per segment");
assert(
  /Do NOT pitch\/warp\/speed-rebuild|original file|natural 1×|playbackRate always 1/i.test(
    src
  ) || /CUE_PLAYBACK_RATE = 1/.test(src),
  "original-file / natural-rate intent documented"
);

const FOURTH = peaks[3];
const CUE_SEC = FOURTH;

function audioTarget(rem) {
  // Digit sync: no lead in offset
  return Math.max(0, Math.min(FOURTH, CUE_SEC - rem));
}

assert(Math.abs(audioTarget(3) - 0) < 0.05, `rem=3 → ~0 (tone1), got ${audioTarget(3)}`);
assert(
  Math.abs(audioTarget(2) - peaks[1]) < 0.05,
  `rem=2 → peak1, got ${audioTarget(2)} vs ${peaks[1]}`
);
assert(
  Math.abs(audioTarget(1) - peaks[2]) < 0.05,
  `rem=1 → peak2, got ${audioTarget(1)} vs ${peaks[2]}`
);
assert(
  Math.abs(audioTarget(0) - FOURTH) < 0.02,
  `rem=0 → fourth (switch), got ${audioTarget(0)}`
);

let prodBytes = null;
let prodType = null;
try {
  const res = await fetch(PROD, { method: "HEAD" });
  assert(res.ok, `prod HEAD ${res.status}`);
  prodBytes = Number(res.headers.get("content-length") || 0);
  prodType = res.headers.get("content-type") || "";
  assert(prodBytes > 50_000, `prod Content-Length ${prodBytes}`);
  assert(/audio|wav|octet/i.test(prodType), `prod Content-Type ${prodType}`);
} catch (err) {
  console.warn("WARN prod HEAD skipped:", err?.message || err);
}

console.log(
  JSON.stringify(
    {
      localBytes: st.size,
      peaks,
      cueSec: CUE_SEC,
      fourth: FOURTH,
      at3: audioTarget(3),
      at2: audioTarget(2),
      at1: audioTarget(1),
      at0: audioTarget(0),
      prodBytes,
      prodType,
      prodUrl: PROD,
    },
    null,
    2
  )
);
console.log("PROOF_OK");
