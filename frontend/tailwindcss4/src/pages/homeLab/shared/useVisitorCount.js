import { useEffect, useState } from "react";
import {
  COUNTER_FALLBACK,
  PLAZA_API,
  VISIT_SESSION_KEY,
} from "./plazaMeta";

const POLL_MS = 14000;

export function useVisitorCount() {
  const [count, setCount] = useState(null);
  const [justCounted, setJustCounted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount(method) {
      const res = await fetch(
        method === "POST" ? `${PLAZA_API}/visit` : `${PLAZA_API}/visitors`,
        { method },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const next = Number(data?.count);
      return Number.isFinite(next) ? next : COUNTER_FALLBACK;
    }

    async function syncInitial() {
      const alreadyCounted = sessionStorage.getItem(VISIT_SESSION_KEY) === "1";
      if (!alreadyCounted) sessionStorage.setItem(VISIT_SESSION_KEY, "1");
      try {
        const next = await fetchCount(alreadyCounted ? "GET" : "POST");
        if (cancelled) return;
        if (!alreadyCounted) setJustCounted(true);
        setCount(next);
      } catch {
        if (!alreadyCounted) sessionStorage.removeItem(VISIT_SESSION_KEY);
        if (!cancelled) setCount(COUNTER_FALLBACK);
      }
    }

    async function poll() {
      try {
        const next = await fetchCount("GET");
        if (!cancelled) setCount(next);
      } catch {
        /* keep showing last known count */
      }
    }

    syncInitial();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { count, justCounted };
}
