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

// 1) Mobile routines library
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await unlock(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/clozzz-routines`, { waitUntil: "domcontentloaded" });
  if (await page.locator("#password").count()) {
    await page.fill("#password", PASS);
    await page.check('input[name="remember"]');
    await Promise.all([
      page.waitForURL(/clozzz-routines/, { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
  }
  await page.waitForSelector(".clozzz-editor .ce-list", { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(OUT, "routines-mobile.png"),
    fullPage: false,
  });
  console.log("wrote routines-mobile.png");
  await ctx.close();
}

// 2) Desktop remote control panel
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await unlock(ctx);
  const page = await ctx.newPage();
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
  await page.waitForSelector(".clozzz-chooser__link--remote, .clozzz-remote__title", {
    timeout: 20000,
  });
  if (await page.locator(".clozzz-chooser__link--remote").count()) {
    await page.locator(".clozzz-chooser__link--remote").first().click();
  }
  await page.waitForSelector(".clozzz-remote__sidebar", { timeout: 20000 });
  await page.waitForSelector(".clozzz-remote__title", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT, "remote-desktop.png"),
    fullPage: false,
  });
  console.log("wrote remote-desktop.png");
  await ctx.close();
}

// 3) Mobile swipe mid-animation
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await unlock(ctx);
  const page = await ctx.newPage();
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
  await page.waitForSelector(".clozzz-chooser__link--remote, .clozzz-remote__title", {
    timeout: 20000,
  });
  if (await page.locator(".clozzz-chooser__link--remote").count()) {
    await page.locator(".clozzz-chooser__link--remote").first().click();
  }
  await page.waitForSelector(".clozzz-remote__stage", { timeout: 20000 });
  await page.waitForTimeout(500);

  // Mid-swipe transform via evaluate (stable for a still frame)
  await page.evaluate(() => {
    const stage = document.querySelector(".clozzz-remote__stage");
    const hint = document.querySelector(".clozzz-remote__channel--mobile");
    if (stage) {
      stage.style.transition = "none";
      stage.style.transform = "translate3d(-92px, 0, 0)";
      stage.style.opacity = "0.72";
    }
    if (hint) hint.textContent = "Next channel →";
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT, "remote-swipe-anim.png"),
    fullPage: false,
  });
  console.log("wrote remote-swipe-anim.png");
  await ctx.close();
}

await browser.close();
console.log("done");
