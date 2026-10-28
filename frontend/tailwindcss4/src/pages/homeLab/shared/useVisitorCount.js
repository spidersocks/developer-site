import { useEffect, useState } from "react";
import {
  COUNTER_FALLBACK,
  PLAZA_API,
  VISIT_SESSION_KEY,
} from "./plazaMeta";

export function useVisitorCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function syncCount() {
      const alreadyCounted = sessionStorage.getItem(VISIT_SESSION_KEY) === "1";
      if (!alreadyCounted) sessionStorage.setItem(VISIT_SESSION_KEY, "1");
      try {
        const res = await fetch(
          alreadyCounted ? `${PLAZA_API}/visitors` : `${PLAZA_API}/visit`,
          { method: alreadyCounted ? "GET" : "POST" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next = Number(data?.count);
        setCount(Number.isFinite(next) ? next : COUNTER_FALLBACK);
      } catch {
        if (!alreadyCounted) sessionStorage.removeItem(VISIT_SESSION_KEY);
        if (!cancelled) setCount(COUNTER_FALLBACK);
      }
    }

    syncCount();
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
