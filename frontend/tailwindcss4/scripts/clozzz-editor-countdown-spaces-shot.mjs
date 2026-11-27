import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.CLOZZZ_SHOT_BASE || "http://127.0.0.1:5173";
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

const ctx = await browser.newContext({
  viewport: { width: 920, height: 1100 },
  deviceScaleFactor: 1.25,
});
if (PASS) await ctx.addCookies([gateCookie(PASS)]);

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

await page.waitForSelector(".clozzz-editor .ce-list .ce-item", {
  timeout: 20000,
});

// Open Edit on Floor Unwind (or first routine)
const items = page.locator(".ce-item");
const count = await items.count();
let opened = false;
for (let i = 0; i < count; i++) {
  const title = (
    await items.nth(i).locator(".ce-item__title").textContent()
  )?.trim();
  if (title === "Floor Unwind" || i === 0) {
    await items.nth(i).locator('button[aria-label="More actions"]').click();
    await page.locator('.ce-menu__item:text-is("Edit")').click();
    opened = true;
    break;
  }
}
if (!opened) throw new Error("could not open edit modal");

await page.waitForSelector(".ce-edit-dialog", { timeout: 10000 });
await page.waitForSelector(".ce-space-pills", { timeout: 5000 });
await page.waitForSelector("#ce-intro-msg", { timeout: 5000 });

// Exercise the new controls briefly so the shot shows intended state
await page.locator('.ce-space-pill:text-is("Bed")').click();
const introToggle = page.locator(
  '.ce-toggle:has(.ce-toggle__title:text-is("Pre-stream countdown")) input'
);
if (!(await introToggle.isChecked())) await introToggle.check();
await page.fill("#ce-intro-msg", "Floor Unwind begins in");
await page
  .locator('[aria-label="Pre-stream countdown duration"] button[aria-label="Increase by 1 minute"]')
  .click();

const endedToggle = page.locator(
  '.ce-toggle:has(.ce-toggle__title:text-is("Stream ended graphic")) input'
);
if (!(await endedToggle.isChecked())) await endedToggle.check();

await page.waitForTimeout(400);

const outPath = path.join(OUT, "editor-countdown-spaces.png");
await page.locator(".ce-edit-dialog").screenshot({ path: outPath });
console.log("wrote", outPath);

await browser.close();
