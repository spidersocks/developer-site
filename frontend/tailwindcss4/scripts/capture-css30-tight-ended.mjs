/**
 * CSS-30 proofs: compact exercise stack + stream-ended count-up.
 * Writes overlay-tight-stack.png + stream-ended-countup.png (+ metrics JSON).
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.CLOZZZ_BASE || "http://127.0.0.1:5174";
const MEDIA =
  process.env.CLOZZZ_MEDIA ||
  String.raw`C:\Users\26071164r\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-7dcde23e-a745-48ee-8b2c-494fbee74fb7\files\media`;
const ARTIFACTS = path.join(
  MEDIA,
  "..",
  "artifacts",
  "cursor",
  "stores",
  "self",
  "media"
);

fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });

function mirror(srcName) {
  const from = path.join(MEDIA, srcName);
  const to = path.join(ARTIFACTS, srcName);
  fs.copyFileSync(from, to);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });

  // ——— 1) Tight exercise stack ———
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector("#root", { timeout: 20000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      document.documentElement.classList.add("clozzz-stage-preview");
      document.body.classList.add("clozzz-stage-preview");
      const root = document.getElementById("root");
      const R = 16.75;
      const p = 0.28;
      root.innerHTML = `
  <div class="clozzz-overlay clozzz-overlay--live" aria-live="polite">
    <header class="clozzz-corner clozzz-corner--tl">
      <div class="clozzz-brand clozzz-brand--quiet clozzz-brand--icon-only" aria-label="Clozzz Sleep">
        <span class="clozzz-brand__mark" aria-hidden="true">
          <img class="clozzz-brand__logo" src="/clozzz/clozzz-logo.png" alt="" width="40" height="40" />
        </span>
      </div>
    </header>
    <section class="clozzz-corner clozzz-corner--bl clozzz-current-panel">
      <p class="clozzz-exercise-count">Exercise 1 of 8</p>
      <div class="clozzz-move-row">
        <div class="clozzz-move-copy">
          <span class="clozzz-crossfade">
            <h1 class="clozzz-current clozzz-crossfade__layer is-in">Settle &amp; breathe</h1>
          </span>
          <p class="clozzz-up-next">Next: Knee rocks</p>
        </div>
        <span class="clozzz-card-timer clozzz-card-timer--calm" style="--clozzz-timer-p: ${p}">
          <svg class="clozzz-timer-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
            <circle class="clozzz-timer-ring__track" cx="20" cy="20" r="${R}"></circle>
            <circle class="clozzz-timer-ring__sweep" cx="20" cy="20" r="${R}" pathLength="1"
              style="stroke-dasharray: 1; stroke-dashoffset: ${1 - p}"></circle>
          </svg>
          <span class="clozzz-card-timer__digits">0:34</span>
        </span>
      </div>
    </section>
  </div>`;
    });

    await page.waitForSelector(".clozzz-current-panel", { timeout: 10000 });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const count = document.querySelector(".clozzz-exercise-count");
      const title = document.querySelector(".clozzz-current");
      const next = document.querySelector(".clozzz-up-next");
      const timer = document.querySelector(".clozzz-card-timer");
      const ring = document.querySelector(".clozzz-timer-ring");
      const digits = document.querySelector(".clozzz-card-timer__digits");
      const cr = count.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      const nr = next.getBoundingClientRect();
      const tm = timer.getBoundingClientRect();
      const rg = ring.getBoundingClientRect();
      const dg = digits.getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector(".clozzz-move-row"));
      return {
        countToTitlePx: +(tr.top - cr.bottom).toFixed(2),
        titleToNextPx: +(nr.top - tr.bottom).toFixed(2),
        countH: +cr.height.toFixed(2),
        titleH: +tr.height.toFixed(2),
        nextH: +nr.height.toFixed(2),
        timerLayoutH: +tm.height.toFixed(2),
        ringH: +rg.height.toFixed(2),
        digitFontPx: parseFloat(getComputedStyle(digits).fontSize),
        titleFontPx: parseFloat(getComputedStyle(title).fontSize),
        rowGap: cs.rowGap,
        stackGap: getComputedStyle(document.querySelector(".clozzz-current-panel")).gap,
      };
    });

    console.log("stack metrics", metrics);
    if (metrics.titleToNextPx > 12) {
      throw new Error(
        `title→Next too loose: ${metrics.titleToNextPx}px (want ≤12, target ~8)`
      );
    }
    if (metrics.countToTitlePx > 10) {
      throw new Error(
        `Exercise→title too loose: ${metrics.countToTitlePx}px (want ≤10)`
      );
    }
    if (metrics.ringH < metrics.titleH * 1.5) {
      throw new Error(
        `Ring too small vs title: ringH=${metrics.ringH} titleH=${metrics.titleH}`
      );
    }

    const panel = page.locator(".clozzz-current-panel");
    const box = await panel.boundingBox();
    const shot = path.join(MEDIA, "overlay-tight-stack.png");
    await page.screenshot({
      path: shot,
      clip: box
        ? {
            x: Math.max(0, box.x - 16),
            y: Math.max(0, box.y - 16),
            width: box.width + 32,
            height: box.height + 32,
          }
        : undefined,
    });
    mirror("overlay-tight-stack.png");
    fs.writeFileSync(
      path.join(MEDIA, "overlay-tight-stack-metrics.json"),
      JSON.stringify(metrics, null, 2)
    );
    console.log("ok overlay-tight-stack.png", metrics);
    await ctx.close();
  }

  // ——— 2) Stream-ended count-up (same language as begins-in) ———
  {
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector("#root", { timeout: 20000 });
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      document.documentElement.classList.add("clozzz-stage-preview");
      document.body.classList.add("clozzz-stage-preview");
      const root = document.getElementById("root");
      root.innerHTML = `
  <div class="clozzz-countdown clozzz-countdown--ended" aria-live="polite">
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
      <p class="clozzz-countdown__label">Floor Unwind has ended</p>
      <div class="clozzz-countdown__timer-block">
        <p class="clozzz-countdown__clock">00:42</p>
      </div>
    </div>
  </div>`;
    });

    await page.waitForSelector(".clozzz-countdown--ended .clozzz-countdown__clock", {
      timeout: 10000,
    });
    await page.waitForFunction(() => {
      const img = document.querySelector(".clozzz-countdown__still");
      return img && img.complete && img.naturalWidth > 0;
    });
    await page.waitForTimeout(700);

    const endedCheck = await page.evaluate(() => {
      const label = document.querySelector(".clozzz-countdown__label")?.textContent || "";
      const clock = document.querySelector(".clozzz-countdown__clock")?.textContent || "";
      const clockColor = getComputedStyle(
        document.querySelector(".clozzz-countdown__clock")
      ).color;
      const rail = document.querySelector(".clozzz-countdown--ended .clozzz-countdown__rail");
      const sub = document.querySelector(".clozzz-countdown--ended .clozzz-countdown__sub");
      const railDisplay = rail ? getComputedStyle(rail).display : "none";
      const subDisplay = sub ? getComputedStyle(sub).display : "none";
      const backed = document.querySelector(".clozzz-brand--backed");
      return {
        label,
        clock,
        clockColor,
        railDisplay,
        subDisplay,
        hasBackedPlate: Boolean(backed),
      };
    });

    console.log("ended check", endedCheck);
    if (!/has ended|stream ended/i.test(endedCheck.label)) {
      throw new Error(`Bad ended label: ${endedCheck.label}`);
    }
    if (endedCheck.railDisplay !== "none") {
      throw new Error("Stream-ended must not show progress rail");
    }
    if (endedCheck.hasBackedPlate) {
      throw new Error("Brand must be without plate");
    }
    // ivory ≈ #f3ead7 → rgb(243, 234, 215)
    if (!/243,\s*234,\s*215/.test(endedCheck.clockColor)) {
      throw new Error(`Clock should be ivory, got ${endedCheck.clockColor}`);
    }

    const shot = path.join(MEDIA, "stream-ended-countup.png");
    await page.screenshot({ path: shot, fullPage: false });
    mirror("stream-ended-countup.png");
    console.log("ok stream-ended-countup.png");
    await ctx.close();
  }

  await browser.close();
  console.log("wrote CSS-30 proofs to", MEDIA);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
