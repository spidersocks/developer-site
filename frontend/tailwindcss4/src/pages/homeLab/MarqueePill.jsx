import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./Home2.module.css";

/** Constant cruise speed (px/s). Duration scales with padded set width. */
const CRUISE_PX_PER_S = 29;
const RETURN_STRENGTH = 1.35;
const MAX_SPEED = 1800;

/**
 * Infinite marquee with drag + throw.
 * Each set is padded (item repeats) until it is at least as wide as the
 * viewport — otherwise -50%/one-set loops expose empty space after the last
 * chip ("Selected projects") and flash on wrap. Cruise uses a measured pixel
 * --loop-w so the seam is exact. Drag takes over in JS and stays on JS.
 */
export default function MarqueePill({ items }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const measureSetRef = useRef(null);
  const [repeats, setRepeats] = useState(1);
  const stateRef = useRef({
    offset: 0,
    velocity: 0,
    baseSpeed: 0,
    loopWidth: 0,
    mode: "css",
    dragging: false,
    pointerId: null,
    lastX: 0,
    samples: [],
    reduceMotion: false,
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measureSet = measureSetRef.current;
    if (!viewport || !measureSet) return undefined;

    const updateRepeats = () => {
      const cycle = measureSet.scrollWidth;
      const view = viewport.clientWidth;
      if (!(cycle > 0) || !(view > 0)) return;
      // One set must cover the viewport or the loop end shows blank + flash.
      const next = Math.max(1, Math.ceil(view / cycle) + 1);
      setRepeats((prev) => (prev === next ? prev : next));
    };

    updateRepeats();
    const ro = new ResizeObserver(updateRepeats);
    ro.observe(viewport);
    ro.observe(measureSet);
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateRepeats).catch(() => {});
    }
    return () => ro.disconnect();
  }, [items]);

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return undefined;

    const s = stateRef.current;
    s.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    s.mode = s.reduceMotion ? "js" : "css";

    const measure = () => {
      const sets = track.querySelectorAll(`.${styles.marqueeSet}`);
      const w = sets[0]?.offsetWidth ?? 0;
      if (!(w > 0)) return;
      s.loopWidth = w;
      const durationS = w / CRUISE_PX_PER_S;
      track.style.setProperty("--loop-w", `${w}px`);
      track.style.setProperty("--marquee-duration", `${durationS}s`);
      s.baseSpeed = s.reduceMotion ? 0 : -CRUISE_PX_PER_S;
      if (s.mode === "js" && !s.dragging && Math.abs(s.velocity) < 1) {
        s.velocity = s.baseSpeed;
      }
    };

    const wrap = () => {
      const w = s.loopWidth;
      if (!(w > 0)) return;
      while (s.offset <= -w) s.offset += w;
      while (s.offset > 0) s.offset -= w;
    };

    const paint = () => {
      track.style.transform = `translate3d(${s.offset}px, 0, 0)`;
    };

    const readCssOffset = () => {
      const matrix = window.getComputedStyle(track).transform;
      if (!matrix || matrix === "none") return 0;
      const m2 = matrix.match(/matrix\(([^)]+)\)/);
      if (m2) return parseFloat(m2[1].split(",")[4]) || 0;
      const m3 = matrix.match(/matrix3d\(([^)]+)\)/);
      if (m3) return parseFloat(m3[1].split(",")[12]) || 0;
      return 0;
    };

    const takeOverWithJs = (velocity = 0) => {
      if (s.mode === "css") {
        s.offset = readCssOffset();
        track.classList.remove(styles.marqueeTrackCss);
        track.style.animation = "none";
        paint();
      }
      s.mode = "js";
      s.velocity = velocity;
    };

    measure();
    if (s.mode === "css") track.classList.add(styles.marqueeTrackCss);

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(viewport);
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    let raf = 0;
    let prev = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.048, (now - prev) / 1000);
      prev = now;

      if (s.mode === "js" && !s.dragging && s.loopWidth > 0 && !s.reduceMotion) {
        const blend = 1 - Math.exp(-RETURN_STRENGTH * dt);
        s.velocity += (s.baseSpeed - s.velocity) * blend;
        s.offset += s.velocity * dt;
        wrap();
        paint();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pushSample = (x, t) => {
      s.samples.push({ x, t });
      if (s.samples.length > 6) s.samples.shift();
    };

    const flingVelocity = () => {
      const samples = s.samples;
      if (samples.length < 2) return s.baseSpeed;
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0.001) return s.baseSpeed;
      return Math.max(-MAX_SPEED, Math.min(MAX_SPEED, (b.x - a.x) / dt));
    };

    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      takeOverWithJs(0);
      s.dragging = true;
      s.pointerId = e.pointerId;
      s.lastX = e.clientX;
      s.samples = [{ x: e.clientX, t: e.timeStamp }];
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add(styles.marqueeDragging);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!s.dragging || e.pointerId !== s.pointerId) return;
      s.offset += e.clientX - s.lastX;
      wrap();
      paint();
      s.lastX = e.clientX;
      pushSample(e.clientX, e.timeStamp);
    };

    const endDrag = (e) => {
      if (!s.dragging || (e && e.pointerId !== s.pointerId)) return;
      s.velocity = s.reduceMotion ? 0 : flingVelocity();
      s.dragging = false;
      s.pointerId = null;
      s.samples = [];
      viewport.classList.remove(styles.marqueeDragging);
      try {
        if (e?.pointerId != null) viewport.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);
    viewport.addEventListener("lostpointercapture", endDrag);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", endDrag);
      viewport.removeEventListener("pointercancel", endDrag);
      viewport.removeEventListener("lostpointercapture", endDrag);
    };
  }, [items, repeats]);

  const setItems = Array.from({ length: repeats }, () => items).flat();

  return (
    <div
      ref={viewportRef}
      className={styles.marquee}
      role="presentation"
      aria-hidden="true"
    >
      {/* Off-flow probe: one natural cycle, used only to size repeats */}
      <div className={styles.marqueeMeasure} ref={measureSetRef} aria-hidden="true">
        {items.map((text) => (
          <span key={`m-${text}`}>
            <i className={styles.marqueeDot} aria-hidden="true" />
            {text}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        className={`${styles.marqueeTrack} ${styles.marqueeTrackCss}`}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className={styles.marqueeSet}>
            {setItems.map((text, i) => (
              <span key={`${copy}-${i}-${text}`}>
                <i className={styles.marqueeDot} aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
