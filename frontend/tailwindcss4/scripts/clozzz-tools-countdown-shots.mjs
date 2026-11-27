/**
 * Artifacts: Tools menu + starting-soon chrome + live exercise card.
 * Usage (from frontend/tailwindcss4):
 *   CLOZZZ_SHOT_OUT=<dir> node scripts/clozzz-tools-countdown-shots.mjs
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.CLOZZZ_SHOT_BASE || "http://127.0.0.1:5174";
const PASS = process.env.CLOZZZ_OVERLAY_PASSWORD || "";
const OUT = process.env.CLOZZZ_SHOT_OUT;

if (!OUT) {
  console.error("Set CLOZZZ_SHOT_OUT");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

function gateCookie(password) {
  const token = crypto
    .createHash("sha256")
    .update(`clozzz-overlay-gate:v1:${password}`)
    .digest("hex");
  return {
    name: "clozzz_overlay_gate",
    value: token,
    domain: "127.0.0.1",
    path: "/",
  };
}

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

async function unlock(context) {
  if (!PASS) return;
  await context.addCookies([gateCookie(PASS)]);
}

async function unlockPage(page) {
  if (!(await page.locator("#password").count())) return;
  await page.fill("#password", PASS);
  if (await page.locator('input[name="remember"]').count()) {
    await page.check('input[name="remember"]');
  }
  await Promise.all([
    page.waitForURL(/clozzz-/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

// 1) Routines Tools menu open
{
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 900 },
    deviceScaleFactor: 2,
  });
  await unlock(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/clozzz-routines`, { waitUntil: "domcontentloaded" });
  await unlockPage(page);
  await page.waitForSelector(".ce-tools__btn", { timeout: 20000 });
  await page.click(".ce-tools__btn");
  await page.waitForSelector(".ce-tools__menu", { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, "routines-tools-menu.png"),
    fullPage: false,
  });
  console.log("wrote routines-tools-menu.png");
  await ctx.close();
}

// 2) Starting-soon chrome — mutate live overlay so Vite CSS stays applied
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#root", { timeout: 20000 });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    document.documentElement.classList.add("clozzz-stage-preview");
    document.body.classList.add("clozzz-stage-preview");
    const root = document.getElementById("root");
    root.innerHTML = `
  <div class="clozzz-countdown clozzz-countdown--soon is-held" aria-live="polite">
    <div class="clozzz-countdown__gradient" aria-hidden="true"></div>
    <img class="clozzz-countdown__still is-ready" src="/clozzz/bg1.webp" alt="" />
    <video class="clozzz-countdown__bg is-ready" src="/clozzz/bg1.mp4" autoplay muted loop playsinline></video>
    <div class="clozzz-countdown__veil" aria-hidden="true"></div>
    <header class="clozzz-countdown__brand">
      <div class="clozzz-brand">
        <span class="clozzz-brand__mark" aria-hidden="true">
          <img class="clozzz-brand__logo" src="/clozzz/clozzz-logo.png" alt="" width="40" height="40" />
        </span>
        <span class="clozzz-brand__text">
          <span class="clozzz-brand__name">Clozzz Sleep</span>
        </span>
      </div>
    </header>
    <div class="clozzz-countdown__center clozzz-countdown__center--minimal">
      <p class="clozzz-countdown__label">Starting soon</p>
      <p class="clozzz-countdown__clock">30:00</p>
      <div class="clozzz-countdown__rail" style="--clozzz-cd-elapsed: 0" aria-hidden="true">
        <span class="clozzz-countdown__rail-track"></span>
        <span class="clozzz-countdown__rail-fill"></span>
        <span class="clozzz-countdown__rail-head"></span>
      </div>
    </div>
  </div>`;
  });

  await page.waitForSelector(".clozzz-countdown__label", { timeout: 10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(".clozzz-countdown__still");
    return img && img.complete && img.naturalWidth > 0;
  });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: path.join(OUT, "starting-soon-chrome.png"),
    fullPage: false,
  });
  console.log("wrote starting-soon-chrome.png");
  await ctx.close();
}

// 3) Live overlay exercise card + timer (BL)
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("#root", { timeout: 20000 });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    document.documentElement.classList.add("clozzz-stage-preview");
    document.body.classList.add("clozzz-stage-preview");
    const root = document.getElementById("root");
    root.innerHTML = `
  <div class="clozzz-overlay clozzz-overlay--live" aria-live="polite">
    <header class="clozzz-corner clozzz-corner--tl">
      <div class="clozzz-brand clozzz-brand--quiet">
        <span class="clozzz-brand__mark" aria-hidden="true">
          <img class="clozzz-brand__logo" src="/clozzz/clozzz-logo.png" alt="" width="40" height="40" />
        </span>
        <span class="clozzz-brand__text">
          <span class="clozzz-brand__name">Clozzz Sleep</span>
        </span>
      </div>
    </header>
    <section class="clozzz-corner clozzz-corner--bl clozzz-current-panel">
      <p class="clozzz-exercise-count">Exercise 4 of 8</p>
      <div class="clozzz-move-row">
        <span class="clozzz-crossfade">
          <h1 class="clozzz-current clozzz-crossfade__layer is-in">Standing forward fold into half lift</h1>
        </span>
        <span class="clozzz-card-timer clozzz-card-timer--calm">0:33</span>
      </div>
      <p class="clozzz-up-next">Next: Down dog → fold</p>
    </section>
  </div>`;
  });

  await page.waitForSelector(".clozzz-current-panel", { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(OUT, "overlay-exercise-card-timer.png"),
    fullPage: false,
  });
  console.log("wrote overlay-exercise-card-timer.png");
  await ctx.close();
}

await browser.close();
console.log("done", OUT);
