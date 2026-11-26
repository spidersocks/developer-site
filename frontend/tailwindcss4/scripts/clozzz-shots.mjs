import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.CLOZZZ_SHOT_BASE || "http://127.0.0.1:5174";
const API = process.env.VITE_CLOZZZ_API_URL || "http://127.0.0.1:8000/clozzz";
const PASS = process.env.CLOZZZ_OVERLAY_PASSWORD || "";
const OUT = process.env.CLOZZZ_SHOT_OUT;

if (!OUT) {
  console.error("Set CLOZZZ_SHOT_OUT");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

function liveToken(password) {
  return crypto
    .createHash("sha256")
    .update(`clozzz-overlay-gate:v1:${password}`)
    .digest("hex");
}

async function setChannel(routineId) {
  if (!PASS) return;
  const token = liveToken(PASS);
  const res = await fetch(`${API}/studio/channel`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Clozzz-Live-Token": token,
    },
    body: JSON.stringify({ routineId }),
  });
  if (!res.ok) throw new Error(`setChannel ${res.status}`);
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

const remoteCtx = await browser.newContext({
  viewport: { width: 430, height: 900 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const gate = await remoteCtx.newPage();

async function unlockIfNeeded(page) {
  await page.goto(`${BASE}/clozzz-remote/mode`, {
    waitUntil: "domcontentloaded",
  });
  if (await page.locator("#password").count()) {
    await page.fill("#password", PASS);
    await page.check('input[name="remember"]');
    await Promise.all([
      page.waitForURL(/clozzz-remote/, { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
  }
}

await unlockIfNeeded(gate);
await gate.waitForTimeout(600);

// 1) Routines library
await gate.goto(`${BASE}/clozzz-routines`, { waitUntil: "domcontentloaded" });
await gate.waitForSelector(".clozzz-editor, .ce-list, .ce-item", {
  timeout: 20000,
});
await gate.waitForTimeout(900);
await gate.screenshot({
  path: path.join(OUT, "clozzz-routines-library.png"),
  fullPage: false,
});
console.log("wrote clozzz-routines-library.png");

// 2) Remote with swipe channel affordance
await gate.goto(`${BASE}/clozzz-remote/mode`, {
  waitUntil: "domcontentloaded",
});
await gate.waitForSelector(".clozzz-chooser__title", { timeout: 20000 });
const remoteLink = gate.locator("a.clozzz-chooser__link--remote").first();
await remoteLink.click();
await gate.waitForSelector(".clozzz-remote__title", { timeout: 20000 });
await gate.waitForSelector(".clozzz-remote__channel", { timeout: 10000 });
await gate.waitForTimeout(800);

// Simulate horizontal swipe to next channel
const box = await gate.locator(".clozzz-remote").boundingBox();
if (box) {
  const y = box.y + Math.min(160, box.height * 0.25);
  const x1 = box.x + box.width * 0.82;
  const x2 = box.x + box.width * 0.18;
  await gate.touchscreen.tap(x1, y);
  await gate.mouse.move(x1, y);
  await gate.mouse.down();
  await gate.mouse.move(x2, y, { steps: 12 });
  await gate.mouse.up();
  // Prefer CDP touch if mouse didn't switch — also dispatch via evaluate
  await gate.evaluate(() => {
    const el = document.querySelector(".clozzz-remote");
    if (!el) return;
    const start = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [
        new Touch({
          identifier: 1,
          target: el,
          clientX: window.innerWidth * 0.85,
          clientY: 140,
        }),
      ],
    });
    const end = new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      changedTouches: [
        new Touch({
          identifier: 1,
          target: el,
          clientX: window.innerWidth * 0.15,
          clientY: 140,
        }),
      ],
    });
    el.dispatchEvent(start);
    el.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({
            identifier: 1,
            target: el,
            clientX: window.innerWidth * 0.15,
            clientY: 140,
          }),
        ],
      })
    );
    el.dispatchEvent(end);
  });
  await gate.waitForTimeout(700);
}

await gate.screenshot({
  path: path.join(OUT, "remote-swipe-channel.png"),
  fullPage: false,
});
console.log("wrote remote-swipe-channel.png");

try {
  await setChannel("demo");
} catch (e) {
  console.warn("setChannel skipped:", e.message);
}

await browser.close();
console.log("done");
