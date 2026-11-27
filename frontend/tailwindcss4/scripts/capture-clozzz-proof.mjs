/**
 * Capture Clozzz CSS-27 proof screenshots into the Project media store.
 * Artifacts: begins-in-countdown, remote-locked-live, remote-idle-channel.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.CLOZZZ_BASE || "http://127.0.0.1:5174";
const API = process.env.VITE_CLOZZZ_API_URL || "http://127.0.0.1:8000/clozzz";
const PASS = process.env.CLOZZZ_OVERLAY_PASSWORD || "Slepcer5";
const MEDIA =
  process.env.CLOZZZ_MEDIA ||
  String.raw`C:\Users\26071164r\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-7dcde23e-a745-48ee-8b2c-494fbee74fb7\files\media`;

fs.mkdirSync(MEDIA, { recursive: true });

async function unlock(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) {
    await pwd.fill(PASS);
    const btn = page
      .locator('button[type="submit"], button:has-text("Unlock"), button:has-text("Continue")')
      .first();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(900);
  }
}

async function liveToken() {
  const data = new TextEncoder().encode(`clozzz-overlay-gate:v1:${PASS}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function api(pathName, { method = "GET", body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["X-Clozzz-Live-Token"] = token;
  const res = await fetch(`${API}${pathName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${pathName} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const token = await liveToken();
  const browser = await chromium.launch({ headless: true });

  const catalog = await api("/routines");
  const rid =
    catalog.routines.find((r) => r.id === "r1")?.id || catalog.routines[0]?.id;
  const title =
    catalog.routines.find((r) => r.id === rid)?.title ||
    catalog.routines.find((r) => r.id === rid)?.name ||
    "Routine";

  await api("/studio/channel", { method: "PUT", token, body: { routineId: rid } });
  await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "restart" },
  });
  await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "start_countdown", durationSec: 1800 },
  });

  // 1) "{Routine} begins in" — no Tonight / no progress rail
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector(".clozzz-countdown__label", { timeout: 15000 });
    await page.waitForTimeout(1000);
    const label = await page.locator(".clozzz-countdown__label").innerText();
    if (!/begins in/i.test(label)) {
      throw new Error(`Expected begins-in label, got: ${label}`);
    }
    if (await page.locator(".clozzz-countdown__tonight").count()) {
      throw new Error("Tonight line should be gone");
    }
    if (await page.locator(".clozzz-countdown--soon .clozzz-countdown__rail").count()) {
      throw new Error("Starting countdown rail should be gone");
    }
    await page.screenshot({ path: path.join(MEDIA, "begins-in-countdown.png") });
    await page.close();
    console.log("ok begins-in-countdown.png", label);
  }

  // Skip → logo-only (chromeVisible false), then Start → running for live lock shot
  const skipped = await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "skip_countdown" },
  });
  if (skipped.chromeVisible !== false) {
    throw new Error(`skip_countdown should hide chrome, got ${skipped.chromeVisible}`);
  }
  if (!skipped.introConsumed) {
    throw new Error("skip_countdown should set introConsumed");
  }

  // 2) Idle/paused channel UI — no framed card borders
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await unlock(page, `${BASE}/clozzz-remote`);
    await page.waitForSelector(".clozzz-remote", { timeout: 15000 });
    await page.waitForTimeout(700);
    const locked = await page.locator(".clozzz-remote.is-swipe-locked").count();
    if (locked) throw new Error("Idle remote should not be swipe-locked");
    const cards = await page.locator(".clozzz-remote__card").count();
    if (cards !== 1) throw new Error(`Idle should show 1 panel, got ${cards}`);
    await page.screenshot({ path: path.join(MEDIA, "remote-idle-channel.png") });
    await page.close();
    console.log("ok remote-idle-channel.png");
  }

  const started = await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "start" },
  });
  if (started.status !== "running") {
    throw new Error(`expected running after start, got ${started.status}`);
  }

  // 3) Live: locked swipe, full-bleed, no neighbor card edges
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await unlock(page, `${BASE}/clozzz-remote`);
    await page.waitForSelector(".clozzz-remote.is-swipe-locked", { timeout: 15000 });
    await page.waitForTimeout(700);
    const cards = await page.locator(".clozzz-remote__card").count();
    if (cards !== 1) throw new Error(`Live should show 1 card, got ${cards}`);
    const hint = await page.locator(".clozzz-remote__channel--mobile").innerText();
    if (!/locked/i.test(hint)) {
      throw new Error(`Expected locked channel hint, got: ${hint}`);
    }
    await page.screenshot({ path: path.join(MEDIA, "remote-locked-live.png") });
    await page.close();
    console.log("ok remote-locked-live.png", title);
  }

  await browser.close();
  console.log("wrote proofs to", MEDIA);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
