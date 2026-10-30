import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "../Home2.module.css";

const WIDTH = 6;
const GLYPHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function DigitWheel({ digit, durationMs }) {
  const prevRef = useRef(digit);
  const [offset, setOffset] = useState(digit);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    if (digit === prevRef.current) return;
    const steps = (digit - prevRef.current + 10) % 10;
    prevRef.current = digit;
    if (steps === 0) return;
    setAnimate(true);
    setOffset((o) => o + steps);
  }, [digit]);

  useEffect(() => {
    if (!animate) return undefined;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setOffset(digit);
    }, durationMs + 30);
    return () => window.clearTimeout(id);
  }, [animate, offset, digit, durationMs]);

  return (
    <span className={styles.odometerDigit} aria-hidden="true">
      <span
        className={styles.odometerReel}
        style={{
          transform: `translateY(${-offset}em)`,
          transition: animate
            ? `transform ${durationMs}ms cubic-bezier(0.22, 0.72, 0.18, 1)`
            : "none",
        }}
      >
        {GLYPHS.map((n, i) => (
          <span key={i} className={styles.odometerGlyph}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function toDigits(n) {
  const s = String(Math.max(0, Math.floor(n))).padStart(WIDTH, "0");
  return s.slice(-WIDTH).split("").map(Number);
}

/**
 * Analog visitor counter — digit reels roll forward as the count rises.
 */
export function AnalogCounter({ value, justCounted }) {
  const [display, setDisplay] = useState(null);
  const displayRef = useRef(null);
  const timerRef = useRef(null);
  const seededRef = useRef(false);
  const [stepMs, setStepMs] = useState(480);

  useEffect(() => {
    if (value == null) return undefined;

    if (displayRef.current == null) {
      const start =
        justCounted && !seededRef.current
          ? Math.max(0, value - 1)
          : value;
      seededRef.current = true;
      displayRef.current = start;
      setDisplay(start);
      if (start >= value) return undefined;
    }

    const from = displayRef.current;
    if (value <= from) {
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }

    if (timerRef.current != null) window.clearInterval(timerRef.current);

    const delta = value - from;
    const ms = Math.max(100, Math.min(560, Math.round(2200 / delta)));
    setStepMs(ms);

    timerRef.current = window.setInterval(() => {
      const next = displayRef.current + 1;
      displayRef.current = next;
      setDisplay(next);
      if (next >= value) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, ms);

    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, justCounted]);

  if (display == null) {
    return (
      <span className={styles.odometer} aria-busy="true">
        {Array.from({ length: WIDTH }, (_, i) => (
          <span key={i} className={styles.odometerDigit}>
            <span className={styles.odometerGlyph}>–</span>
          </span>
        ))}
      </span>
    );
  }

  const digits = toDigits(display);

  return (
    <span className={styles.odometer} aria-label={`${display} visitors`}>
      {digits.map((d, i) => (
        <DigitWheel key={i} digit={d} durationMs={Math.round(stepMs * 0.92)} />
      ))}
    </span>
  );
}
