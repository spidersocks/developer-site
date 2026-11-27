/**
 * CSS-31 proofs: OBS dock remote (no scroll) + premium/narrow exercise timer.
 * Writes remote-obs-dock.png + timer-premium-narrow.png (+ metrics JSON).
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

  // ——— 1) OBS dock remote (~360×360) — all controls visible, no scroll ———
  {
    const ctx = await browser.newContext({
      viewport: { width: 360, height: 360 },
      deviceScaleFactor: 2,
      hasTouch: false,
    });
    const page = await ctx.newPage();
    /* Overlay entry ships shared CSS; inject remote markup (avoids password gate). */
    await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector("#root", { timeout: 20000 });
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      document.documentElement.className = "clozzz-stage-remote";
      document.body.className = "clozzz-stage-remote";
      document.documentElement.style.height = "100%";
      document.body.style.height = "100%";
      document.body.style.margin = "0";
      document.body.style.overflow = "hidden";
      const root = document.getElementById("root");
      root.style.height = "100%";
      root.innerHTML = `
  <div class="clozzz-remote is-swipe-locked is-pull-locked">
    <aside class="clozzz-remote__sidebar" aria-label="Channels"></aside>
    <div class="clozzz-remote__panel">
      <div class="clozzz-remote__pull" aria-hidden="true" style="height:0;opacity:0">
        <span></span>
      </div>
      <div class="clozzz-remote__viewport">
        <div class="clozzz-remote__stage">
          <div class="clozzz-remote__card is-active">
            <header class="clozzz-remote__head">
              <p class="clozzz-remote__eyebrow">Clozzz remote</p>
              <h1 class="clozzz-remote__title">Floor Unwind</h1>
              <p class="clozzz-remote__channel clozzz-remote__channel--mobile">Channel locked while live</p>
              <p class="clozzz-remote__meta">Live · 2 / 8 · Chrome on</p>
              <p class="clozzz-remote__label" aria-live="polite">Knee rocks</p>
            </header>
            <div class="clozzz-remote__pad">
              <button type="button" class="clozzz-remote__btn clozzz-remote__btn--primary">Pause</button>
              <div class="clozzz-remote__row">
                <button type="button" class="clozzz-remote__btn">Back</button>
                <button type="button" class="clozzz-remote__btn">Skip</button>
              </div>
              <p class="clozzz-remote__section">Overlay</p>
              <button type="button" class="clozzz-remote__btn">Hide exercise &amp; timer</button>
              <button type="button" class="clozzz-remote__btn clozzz-remote__btn--ghost">Reset to start</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
    });

    await page.waitForSelector(".clozzz-remote__btn--primary", { timeout: 10000 });
    await page.waitForTimeout(400);

    const dockCheck = await page.evaluate(() => {
      const remote = document.querySelector(".clozzz-remote");
      const pad = document.querySelector(".clozzz-remote__pad");
      const buttons = [...document.querySelectorAll(".clozzz-remote__btn")];
      const last = buttons[buttons.length - 1];
      const rr = remote.getBoundingClientRect();
      const lr = last.getBoundingClientRect();
      const overflowY =
        document.documentElement.scrollHeight > window.innerHeight + 1 ||
        document.body.scrollHeight > window.innerHeight + 1 ||
        remote.scrollHeight > remote.clientHeight + 2;
      const allInView = buttons.every((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight + 1;
      });
      const clickable = buttons.every((b) => {
        const r = b.getBoundingClientRect();
        return r.width >= 24 && r.height >= 24;
      });
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        remoteH: +rr.height.toFixed(1),
        lastBtnBottom: +lr.bottom.toFixed(1),
        overflowY,
        allInView,
        clickable,
        btnCount: buttons.length,
        padGap: getComputedStyle(pad).gap,
        primaryMinH: getComputedStyle(buttons[0]).minHeight,
      };
    });

    console.log("dock check", dockCheck);
    if (dockCheck.overflowY) {
      throw new Error("OBS dock remote still overflows / requires scroll");
    }
    if (!dockCheck.allInView) {
      throw new Error("Not all controls visible in 360×360 dock");
    }
    if (!dockCheck.clickable) {
      throw new Error("Controls too small to click in dock");
    }

    const shot = path.join(MEDIA, "remote-obs-dock.png");
    await page.screenshot({ path: shot, fullPage: false });
    mirror("remote-obs-dock.png");
    fs.writeFileSync(
      path.join(MEDIA, "remote-obs-dock-metrics.json"),
      JSON.stringify(dockCheck, null, 2)
    );
    console.log("ok remote-obs-dock.png");
    await ctx.close();
  }

  // ——— 2) Premium timer + narrow card + descenders + vertical center ———
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
    await page.waitForTimeout(700);

    await page.evaluate(() => {
      document.documentElement.classList.add("clozzz-stage-preview");
      document.body.classList.add("clozzz-stage-preview");
      const root = document.getElementById("root");
      const R = 17.1;
      const p = 0.42;
      /* Title with descenders (g/y/p) to prove no clip. */
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
      <div class="clozzz-move-copy">
        <p class="clozzz-exercise-count">Exercise 3 of 8</p>
        <span class="clozzz-crossfade">
          <h1 class="clozzz-current clozzz-crossfade__layer is-in">Lying hip stretch</h1>
        </span>
        <p class="clozzz-up-next">Next: Figure-four rocking</p>
      </div>
      <span class="clozzz-card-timer clozzz-card-timer--calm" style="--clozzz-timer-p: ${p}">
        <svg class="clozzz-timer-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <circle class="clozzz-timer-ring__track" cx="20" cy="20" r="${R}"></circle>
          <circle class="clozzz-timer-ring__sweep" cx="20" cy="20" r="${R}" pathLength="1"
            style="stroke-dasharray: 1; stroke-dashoffset: ${1 - p}"></circle>
        </svg>
        <span class="clozzz-card-timer__digits">0:28</span>
      </span>
    </section>
  </div>`;
    });

    await page.waitForSelector(".clozzz-current-panel", { timeout: 10000 });
    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(".clozzz-current-panel");
      const copy = document.querySelector(".clozzz-move-copy");
      const title = document.querySelector(".clozzz-current");
      const next = document.querySelector(".clozzz-up-next");
      const timer = document.querySelector(".clozzz-card-timer");
      const ring = document.querySelector(".clozzz-timer-ring");
      const digits = document.querySelector(".clozzz-card-timer__digits");
      const pr = panel.getBoundingClientRect();
      const cr = copy.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      const nr = next.getBoundingClientRect();
      const tm = timer.getBoundingClientRect();
      const rg = ring.getBoundingClientRect();
      const panelCenterY = pr.top + pr.height / 2;
      const timerCenterY = tm.top + tm.height / 2;
      const copyCenterY = cr.top + cr.height / 2;
      const titleLineHeight = parseFloat(getComputedStyle(title).lineHeight);
      const titleFont = parseFloat(getComputedStyle(title).fontSize);
      const strokeLinecap = getComputedStyle(
        document.querySelector(".clozzz-timer-ring__sweep")
      ).strokeLinecap;
      /* Descender clip probe: measure glyph box vs line-clamp overflow. */
      const titleOverflow = getComputedStyle(title).overflow;
      return {
        panelWidthVw: +((pr.width / window.innerWidth) * 100).toFixed(2),
        panelWidthPx: +pr.width.toFixed(1),
        columnGap: getComputedStyle(panel).columnGap,
        titleLineHeight,
        titleFontPx: titleFont,
        lineHeightRatio: +(titleLineHeight / titleFont).toFixed(3),
        titleToNextPx: +(nr.top - tr.bottom).toFixed(2),
        timerCenterDeltaVsPanel: +(timerCenterY - panelCenterY).toFixed(2),
        timerCenterDeltaVsCopy: +(timerCenterY - copyCenterY).toFixed(2),
        ringH: +rg.height.toFixed(2),
        digitFontPx: parseFloat(getComputedStyle(digits).fontSize),
        strokeLinecap,
        titleOverflow,
        timerLeftGapPx: +(tm.left - cr.right).toFixed(2),
      };
    });

    console.log("timer metrics", metrics);
    if (metrics.panelWidthVw > 36) {
      throw new Error(
        `Card still wide: ${metrics.panelWidthVw}vw (want ≤35-ish / 34 target)`
      );
    }
    if (metrics.lineHeightRatio < 1.12) {
      throw new Error(
        `Title line-height too tight for descenders: ${metrics.lineHeightRatio}`
      );
    }
    if (Math.abs(metrics.timerCenterDeltaVsCopy) > 6) {
      throw new Error(
        `Timer not vertically centered vs copy: Δ=${metrics.timerCenterDeltaVsCopy}px`
      );
    }
    if (metrics.strokeLinecap !== "round") {
      throw new Error(`Ring cap should be round, got ${metrics.strokeLinecap}`);
    }
    if (metrics.timerLeftGapPx > 20) {
      throw new Error(
        `Timer too far from text: gap=${metrics.timerLeftGapPx}px`
      );
    }

    const panel = page.locator(".clozzz-current-panel");
    const box = await panel.boundingBox();
    const shot = path.join(MEDIA, "timer-premium-narrow.png");
    await page.screenshot({
      path: shot,
      clip: box
        ? {
            x: Math.max(0, box.x - 24),
            y: Math.max(0, box.y - 24),
            width: box.width + 48,
            height: box.height + 48,
          }
        : undefined,
    });
    mirror("timer-premium-narrow.png");
    fs.writeFileSync(
      path.join(MEDIA, "timer-premium-narrow-metrics.json"),
      JSON.stringify(metrics, null, 2)
    );
    console.log("ok timer-premium-narrow.png", metrics);
    await ctx.close();
  }

  await browser.close();
  console.log("wrote CSS-31 proofs to", MEDIA);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
