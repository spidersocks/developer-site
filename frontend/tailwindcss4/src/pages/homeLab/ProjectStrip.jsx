import { useEffect, useRef, useState } from "react";
import { openProps } from "./projects";
import styles from "./Home2.module.css";

const AUTO_MS = 4800;
const PAUSE_MS = 8000;
const MQ = "(max-width: 960px)";

function ProjectDots({ count, active, onGo, onInteract }) {
  if (count < 2) return null;
  return (
    <div
      className={styles.projectDots}
      role="tablist"
      aria-label="Project slides"
    >
      {Array.from({ length: count }, (_, i) => {
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={`Project ${i + 1} of ${count}`}
            className={on ? styles.projectDotOn : styles.projectDot}
            onClick={() => {
              onInteract?.();
              onGo(i);
            }}
          />
        );
      })}
    </div>
  );
}

function ProjectCard({ project, focused, onDragClick }) {
  return (
    <a
      className={`${styles.projectCard} ${
        focused ? styles.projectCardOn : styles.projectCardOff
      }`}
      href={project.link}
      draggable={false}
      {...openProps(project.link)}
      onClick={onDragClick}
    >
      <img src={project.preview} alt="" draggable={false} />
      <strong>{project.short || project.title}</strong>
    </a>
  );
}

/**
 * Desktop: static grid.
 * Mobile: triple-strip loop. Wrap snap disables ALL transitions so the
 * clone→real jump is invisible (same neighbors, same focus look).
 */
export default function ProjectStrip({ projects }) {
  const n = projects.length;
  const viewportRef = useRef(null);
  const trackElRef = useRef(null);
  /** Index into the triple strip; real slides live in [n, 2n). */
  const trackRef = useRef(n > 1 ? n : 0);
  const pausedUntil = useRef(0);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);
  const lockedRef = useRef(false);
  const pendingNormalize = useRef(null);
  const fallbackTimer = useRef(0);

  const [isMobile, setIsMobile] = useState(false);
  const [track, setTrack] = useState(n > 1 ? n : 0);
  const [dragging, setDragging] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [noMotion, setNoMotion] = useState(false);

  const slides = n > 1 ? [...projects, ...projects, ...projects] : projects;
  const realIndex = n > 0 ? ((track % n) + n) % n : 0;

  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (n < 2) {
      trackRef.current = 0;
      setTrack(0);
      return;
    }
    const mid = n + (trackRef.current % n);
    trackRef.current = mid;
    setTrack(mid);
  }, [n]);

  const pauseAuto = () => {
    pausedUntil.current = Date.now() + PAUSE_MS;
  };

  const normalize = (t) => {
    if (n < 2) return 0;
    if (t >= 2 * n) return t - n;
    if (t < n) return t + n;
    return t;
  };

  /** Invisible re-seat onto the middle copy after a wrap animation. */
  const snapNormalize = (fromTrack) => {
    window.clearTimeout(fallbackTimer.current);
    const settled = normalize(fromTrack);
    pendingNormalize.current = null;
    if (settled === fromTrack) {
      lockedRef.current = false;
      return;
    }
    // Freeze every transition, jump index, then thaw — no focus/scale blink.
    setNoMotion(true);
    requestAnimationFrame(() => {
      trackRef.current = settled;
      setTrack(settled);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setNoMotion(false);
          lockedRef.current = false;
        });
      });
    });
  };

  const goToTrack = (nextTrack, { instant = false } = {}) => {
    if (n < 1 || lockedRef.current) return;

    if (instant) {
      lockedRef.current = true;
      setNoMotion(true);
      requestAnimationFrame(() => {
        trackRef.current = nextTrack;
        setTrack(nextTrack);
        requestAnimationFrame(() => {
          setNoMotion(false);
          lockedRef.current = false;
        });
      });
      return;
    }

    lockedRef.current = true;
    pendingNormalize.current = nextTrack;
    trackRef.current = nextTrack;
    setTrack(nextTrack);

    // Fallback if transitionend doesn’t fire (tab background, reduced motion)
    window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(() => {
      if (pendingNormalize.current == null) {
        lockedRef.current = false;
        return;
      }
      snapNormalize(pendingNormalize.current);
    }, 900);
  };

  // After the slide animation finishes, silently re-seat if we landed on a clone
  useEffect(() => {
    if (!isMobile) return undefined;
    const el = trackElRef.current;
    if (!el) return undefined;

    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== "transform") return;
      if (pendingNormalize.current == null) {
        lockedRef.current = false;
        return;
      }
      snapNormalize(pendingNormalize.current);
    };

    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [isMobile, n]);

  const goBy = (delta) => {
    if (n < 2) return;
    goToTrack(trackRef.current + delta);
  };

  const goToReal = (real) => {
    if (n < 2) {
      goToTrack(0);
      return;
    }
    const current = trackRef.current;
    const candidates = [real, real + n, real + 2 * n];
    let best = candidates[0];
    let bestDist = Math.abs(candidates[0] - current);
    for (const c of candidates) {
      const d = Math.abs(c - current);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    goToTrack(best);
  };

  useEffect(() => {
    if (!isMobile || n < 2) return undefined;
    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      if (document.hidden) return;
      if (dragRef.current) return;
      goBy(1);
    }, AUTO_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, n]);

  useEffect(() => {
    if (!isMobile || n < 2) return undefined;
    const vp = viewportRef.current;
    if (!vp) return undefined;

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (lockedRef.current) return;
      pauseAuto();
      didDragRef.current = false;
      dragRef.current = {
        id: e.pointerId,
        origin: e.clientX,
        samples: [{ x: e.clientX, t: e.timeStamp }],
      };
      setDragging(true);
      setDragDx(0);
      try {
        vp.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.origin;
      if (Math.abs(dx) > 8) didDragRef.current = true;
      setDragDx(dx);
      d.samples.push({ x: e.clientX, t: e.timeStamp });
      if (d.samples.length > 5) d.samples.shift();
    };

    const onUp = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      dragRef.current = null;
      setDragging(false);

      const samples = d.samples;
      let fling = 0;
      if (samples.length >= 2) {
        const a = samples[0];
        const b = samples[samples.length - 1];
        const dt = (b.t - a.t) / 1000;
        if (dt > 0.001) fling = (b.x - a.x) / dt;
      }
      const dx = e.clientX - d.origin;
      setDragDx(0);

      const step =
        dx < -48 || fling < -400 ? 1 : dx > 48 || fling > 400 ? -1 : 0;
      if (step !== 0) {
        didDragRef.current = true;
        goBy(step);
      }
      try {
        vp.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    return () => {
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, n]);

  const onDragClick = (e) => {
    if (didDragRef.current) {
      e.preventDefault();
      didDragRef.current = false;
    }
  };

  if (!isMobile) {
    return (
      <div className={styles.projectRow}>
        {projects.map((project) => (
          <a
            key={project.title}
            className={`${styles.wiiHover} ${styles.projectCard}`}
            href={project.link}
            {...openProps(project.link)}
          >
            <img src={project.preview} alt="" />
            <strong>{project.short || project.title}</strong>
          </a>
        ))}
      </div>
    );
  }

  const frozen = dragging || noMotion;

  return (
    <div
      className={`${styles.projectCarousel}${
        frozen ? ` ${styles.projectCarouselFrozen}` : ""
      }`}
      style={{
        "--project-i": track,
        "--project-dx": `${dragDx}px`,
      }}
    >
      <div
        ref={viewportRef}
        className={styles.projectViewport}
        style={{ touchAction: "pan-y" }}
      >
        <div
          ref={trackElRef}
          className={`${styles.projectTrack}${
            frozen ? ` ${styles.projectTrackInstant}` : ""
          }`}
        >
          {slides.map((project, i) => (
            <ProjectCard
              key={`${project.title}-${i}`}
              project={project}
              focused={i === track}
              onDragClick={onDragClick}
            />
          ))}
        </div>
      </div>
      <ProjectDots
        count={n}
        active={realIndex}
        onGo={goToReal}
        onInteract={pauseAuto}
      />
    </div>
  );
}
