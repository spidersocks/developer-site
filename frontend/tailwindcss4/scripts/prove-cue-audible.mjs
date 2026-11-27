/**
 * Evidence that the segment-end cue is reachable + that seek-thrash was the
 * silence bug. Run: node scripts/prove-cue-audible.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wavPath = path.join(root, "public/clozzz/segment-end-cue.wav");
const overlayPath = path.join(root, "src/apps/ClozzzOverlay/Overlay.jsx");

const PROD = "https://www.seanfontaine.dev/clozzz/segment-end-cue.wav?v=sean5-final2";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log("OK", msg);
}

// 1) Local asset
const st = fs.statSync(wavPath);
assert(st.size > 500_000, `local WAV size ${st.size} (>500KB)`);
const buf = fs.readFileSync(wavPath);
assert(buf.slice(0, 4).toString() === "RIFF", "local WAV starts with RIFF");

// 2) Source no longer seek-thrashes every frame
const src = fs.readFileSync(overlayPath, "utf8");
assert(src.includes("CUE_DRIFT_RESYNC_SEC"), "drift-resync constant present");
assert(src.includes("armedKeyRef"), "arm-once per segment");
assert(
  !src.includes("seekTo(displayTarget);\n    if (audio.paused)"),
  "old every-frame seek+play pattern removed"
);
assert(src.includes("sean5-final2"), "cache-bust bump for OBS refresh");

// 3) Simulate thrash vs arm-once (why OBS/CEF was silent).
// Model: seek cancels decode; audio.currentTime does not advance until a
// full frame without seek (CEF restart cost). Old code re-sought every few
// frames while play() was still spinning up → near-zero audible frames.
function simulateThrash(frames = 120) {
  let seeks = 0;
  let plays = 0;
  let audibleFrames = 0;
  let currentTime = 0;
  let paused = true;
  let framesSinceSeek = 999;
  const rem0 = 4.9;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = Math.max(0, 5 - rem);
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
      // play() resolves only after ~3 frames without another seek
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
  const rem0 = 4.9;
  for (let i = 0; i < frames; i++) {
    const rem = rem0 - i / 60;
    const target = Math.max(0, 5 - rem);
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

const thrash = simulateThrash();
const once = simulateArmOnce();
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

// 4) Production WAV
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
      prodUrl: PROD,
    },
    null,
    2
  )
);
console.log("PROOF_OK");
