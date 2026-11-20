import {
  AUTH_PATH,
  buildSetCookie,
  gatePageHtml,
  safeNextPath,
  unlockToken,
} from "../lib/clozzz-overlay-gate.js";

export const config = {
  runtime: "edge",
};

/**
 * POST password → HttpOnly unlock cookie.
 * GET → { ok, unlocked } for debugging / future clients.
 */
export default async function handler(request) {
  const password = process.env.CLOZZZ_OVERLAY_PASSWORD;
  const url = new URL(request.url);
  const wantsJson =
    (request.headers.get("accept") || "").includes("application/json") ||
    url.searchParams.get("format") === "json";

  if (request.method === "GET") {
    if (!password) {
      return json({ ok: true, unlocked: true, gate: "off" });
    }
    const expected = await unlockToken(password);
    const cookie = request.headers.get("cookie") || "";
    const unlocked = cookie.includes(`${encodeURIComponent(expected)}`) ||
      cookie.split(";").some((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return false;
        const key = part.slice(0, idx).trim();
        if (key !== "clozzz_overlay_gate") return false;
        try {
          return decodeURIComponent(part.slice(idx + 1).trim()) === expected;
        } catch {
          return part.slice(idx + 1).trim() === expected;
        }
      });
    return json({ ok: true, unlocked, gate: "on" });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!password) {
    // Gate disabled — treat as unlocked.
    const nextPath = safeNextPath(url.searchParams.get("next"));
    return wantsJson
      ? json({ ok: true, next: nextPath, gate: "off" })
      : Response.redirect(new URL(nextPath, url.origin), 303);
  }

  let submitted = "";
  let remember = false;
  let nextPath = "/clozzz-overlay";

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    submitted = String(body.password ?? "");
    remember = Boolean(body.remember);
    nextPath = safeNextPath(body.next);
  } else {
    const form = await request.formData();
    submitted = String(form.get("password") ?? "");
    remember =
      form.get("remember") === "1" ||
      form.get("remember") === "on" ||
      form.get("remember") === "true";
    nextPath = safeNextPath(String(form.get("next") ?? ""));
  }

  if (submitted !== password) {
    if (wantsJson) {
      return json({ ok: false, error: "Incorrect password" }, 401);
    }
    const html = gatePageHtml({
      nextPath,
      error: "Incorrect password",
      action: AUTH_PATH,
    });
    return new Response(html, {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const token = await unlockToken(password);
  const secure = url.protocol === "https:";
  const headers = new Headers({
    "set-cookie": buildSetCookie(token, { remember, secure }),
    "cache-control": "no-store",
  });

  if (wantsJson) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ ok: true, next: nextPath }), {
      status: 200,
      headers,
    });
  }

  headers.set("location", nextPath);
  return new Response(null, { status: 303, headers });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
