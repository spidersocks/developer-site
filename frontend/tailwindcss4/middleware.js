import { next } from "@vercel/edge";
import {
  COOKIE_NAME,
  gatePageHtml,
  readCookie,
  unlockToken,
} from "./lib/clozzz-overlay-gate.js";

export const config = {
  runtime: "nodejs",
  matcher: ["/clozzz-overlay", "/clozzz-overlay/:path*"],
};

/**
 * Light password gate for library + OBS session URLs.
 * Password: CLOZZZ_OVERLAY_PASSWORD (Vercel env / .env.local). Unset = no gate.
 */
export default async function middleware(request) {
  const password = process.env.CLOZZZ_OVERLAY_PASSWORD;
  if (!password) {
    return next();
  }

  const url = new URL(request.url);
  const expected = await unlockToken(password);
  const cookie = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  if (cookie && cookie === expected) {
    return next();
  }

  const nextUrl = new URL(url.href);
  nextUrl.searchParams.delete("gate_error");
  const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
  const html = gatePageHtml({
    nextPath,
    error: url.searchParams.get("gate_error") || "",
  });

  return new Response(html, {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
