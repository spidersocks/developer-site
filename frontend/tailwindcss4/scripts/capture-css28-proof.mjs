/**
 * CSS-28 proofs: Tools icons, silky mid-swipe, timer progress ring.
 * Writes into the Project media store.
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

  await api("/studio/channel", { method: "PUT", token, body: { routineId: rid } });
  await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "restart" },
  });

  // 1) Tools menu icons
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await unlock(page, `${BASE}/clozzz-routines`);
    await page.waitForSelector(".ce-tools__btn", { timeout: 15000 });
    await page.locator(".ce-tools__btn").click();
    await page.waitForSelector(".ce-tools__menu", { timeout: 5000 });
    const icons = await page.locator(".ce-tools__item-icon").count();
    if (icons < 2) throw new Error(`Expected 2 tool icons, got ${icons}`);
    const items = page.locator(".ce-tools__item");
    await expectText(items.nth(0), /Copy OBS/i);
    await expectText(items.nth(1), /Open remote/i);
    // Target blank wiring lives in openRemoteHome — assert handler opens _blank via stub
    const openCalls = [];
    await page.exposeFunction("__noteOpen", (url, target) => {
      openCalls.push({ url, target });
    });
    await page.evaluate(() => {
      window.open = (url, target) => {
        window.__noteOpen(String(url), String(target || ""));
        return null;
      };
    });
    await items.nth(1).click();
    await page.waitForTimeout(200);
    if (!openCalls.some((c) => c.target === "_blank")) {
      throw new Error(`Open remote must use target=_blank, got ${JSON.stringify(openCalls)}`);
    }
    // Re-open for screenshot
    await page.locator(".ce-tools__btn").click();
    await page.waitForSelector(".ce-tools__menu", { timeout: 5000 });
    const menu = page.locator(".ce-tools__menu");
    const tools = page.locator(".ce-tools");
    const menuBox = await menu.boundingBox();
    const toolsBox = await tools.boundingBox();
    const left = Math.max(0, Math.min(menuBox?.x ?? 0, toolsBox?.x ?? 0) - 16);
    const top = Math.max(0, (toolsBox?.y ?? 0) - 16);
    const right = Math.max(
      (menuBox?.x ?? 0) + (menuBox?.width ?? 0),
      (toolsBox?.x ?? 0) + (toolsBox?.width ?? 0)
    );
    const bottom =
      (menuBox?.y ?? 0) + (menuBox?.height ?? 0);
    await page.screenshot({
      path: path.join(MEDIA, "tools-icons.png"),
      clip: {
        x: left,
        y: top,
        width: Math.max(220, right - left + 24),
        height: Math.max(140, bottom - top + 20),
      },
    });
    await page.close();
    console.log("ok tools-icons.png");
  }

  // Ensure idle (not live) for swipe
  await api(`/live/${rid}/command`, {
    method: "POST",
    token,
    body: { command: "restart" },
  });

  // 2) Mid-swipe silky Embla scale/opacity
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await unlock(page, `${BASE}/clozzz-remote`);
    await page.waitForSelector(".clozzz-remote.is-channel-open", { timeout: 15000 });
    await page.waitForTimeout(500);
    const locked = await page.locator(".clozzz-remote.is-swipe-locked").count();
    if (locked) throw new Error("Idle remote should not be swipe-locked");

    const vp = page.locator(".clozzz-remote__viewport");
    const box = await vp.boundingBox();
    if (!box) throw new Error("viewport missing");
    const startX = box.x + box.width * 0.72;
    const startY = box.y + 72;
    const midX = box.x + box.width * 0.38;
    await page.touchscreen.tap(startX, startY);
    // Drag partway and hold for mid-frame
    await page.evaluate(
      async ({ sx, sy, mx }) => {
        const el = document.querySelector(".clozzz-remote");
        const fire = (type, x, y) => {
          el.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              touches:
                type === "touchend"
                  ? []
                  : [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
              changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
            })
          );
        };
        fire("touchstart", sx, sy);
        for (let i = 1; i <= 8; i++) {
          const t = i / 8;
          fire("touchmove", sx + (mx - sx) * t, sy);
          await new Promise((r) => setTimeout(r, 16));
        }
      },
      { sx: startX, sy: startY, mx: midX }
    );
    await page.waitForTimeout(120);
    const cards = await page.locator(".clozzz-remote__card").count();
    if (cards < 2) throw new Error(`Mid-swipe should show neighbor cards, got ${cards}`);
    await page.screenshot({ path: path.join(MEDIA, "swipe-smooth-mid.png") });
    await page.close();
    console.log("ok swipe-smooth-mid.png");
  }

  // 3) Live exercise timer progress ring
  {
    // Clear any intro hold so Start goes straight to running.
    try {
      await api(`/live/${rid}/command`, {
        method: "POST",
        token,
        body: { command: "skip_countdown" },
      });
    } catch {
      /* already idle/logo */
    }
    const started = await api(`/live/${rid}/command`, {
      method: "POST",
      token,
      body: { command: "start" },
    });
    if (started.status !== "running") {
      throw new Error(`expected running after start, got ${started.status}`);
    }
    // Advance a bit so the ring is visibly partial
    await new Promise((r) => setTimeout(r, 1800));

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${BASE}/clozzz-overlay?preview=1`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForSelector(".clozzz-card-timer .clozzz-timer-ring__sweep", {
      timeout: 15000,
    });
    await page.waitForTimeout(700);
    const ring = page.locator(".clozzz-current-panel");
    const rbox = await ring.boundingBox();
    await page.screenshot({
      path: path.join(MEDIA, "timer-progress-ring.png"),
      clip: rbox
        ? {
            x: Math.max(0, rbox.x - 24),
            y: Math.max(0, rbox.y - 24),
            width: Math.min(900, rbox.width + 48),
            height: Math.min(420, rbox.height + 48),
          }
        : undefined,
    });
    await page.close();
    console.log("ok timer-progress-ring.png");
  }

  await browser.close();
  console.log("wrote CSS-28 proofs to", MEDIA);
}

async function expectText(locator, re) {
  const text = await locator.innerText();
  if (!re.test(text)) throw new Error(`Expected ${re}, got: ${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
