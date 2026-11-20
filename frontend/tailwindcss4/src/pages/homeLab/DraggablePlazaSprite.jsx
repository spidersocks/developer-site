import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Home2.module.css";

const SNAP_RADIUS = 88;
const SNAP_MS = 320;
const DRAG_LIFT_PX = 6; // matches .plazaDragging translateY — don't rise on release
const OVERSHOOT_PX = 120; // cartoon floor below the release point
// Nintendo / Mario-style throw (Sunshine + Smash item feel):
// keep most flick speed, mild air friction, constant gravity → real parabola
const THROW_VX_KEEP = 0.95; // throw farther — almost full release speed
const THROW_VY_KEEP = 0.4;
const LAND_GRAVITY = 2600; // snappy, not floaty
const AIR_FRICTION = 0.35; // mild — momentum should survive the whole arc
const GROUND_FRICTION = 5.5; // stops the post-impact slide
const THROW_GRAVITY = 2200; // px/s² — while flying off-screen
const DUST_MS = 620;
const CLICK_MOVE_PX = 8; // below this → click (spin), not a drag
const CLICK_SPEED = 90;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function wouldBeOffscreen(pos, pad = 0) {
  if (!pos) return true;
  return (
    pos.left < -pad ||
    pos.top < -pad ||
    pos.left + pos.width > window.innerWidth + pad ||
    pos.top + pos.height > window.innerHeight + pad
  );
}

function fullyOffscreen(pos) {
  if (!pos) return true;
  return (
    pos.left + pos.width < 0 ||
    pos.top + pos.height < 0 ||
    pos.left > window.innerWidth ||
    pos.top > window.innerHeight
  );
}

/** Velocity from recent pointer samples (px/s). */
function velocityFromSamples(samples) {
  if (!samples || samples.length < 2) return { vx: 0, vy: 0 };
  const newest = samples[samples.length - 1];
  // Prefer a ~80ms window so a flick reads without ancient drag noise
  let oldest = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    if (newest.t - samples[i].t > 80) {
      oldest = samples[i];
      break;
    }
    oldest = samples[i];
  }
  const dt = (newest.t - oldest.t) / 1000;
  if (dt < 0.012) return { vx: 0, vy: 0 };
  return {
    vx: clamp((newest.x - oldest.x) / dt, -3200, 3200),
    vy: clamp((newest.y - oldest.y) / dt, -3200, 3200),
  };
}

/**
 * Simulate the ballistic land used by runFallLand (same constants).
 * Horizontal & vertical are independent — Mario/arcade projectile model.
 */
function estimateLandPos(pos, vx0, vy0 = 0) {
  if (!pos) return null;
  const floorTop = pos.top + OVERSHOOT_PX;
  let x = pos.left;
  let y = pos.top - DRAG_LIFT_PX;
  let vx = vx0 * THROW_VX_KEEP;
  let vy = Math.min(vy0 * THROW_VY_KEEP, 420);
  if (Math.abs(vy) < 50) vy = 80;
  const dt = 1 / 60;
  for (let i = 0; i < 240; i++) {
    vy += LAND_GRAVITY * dt;
    vx *= Math.exp(-AIR_FRICTION * dt);
    x += vx * dt;
    y += vy * dt;
    if (y >= floorTop) {
      return { ...pos, left: x, top: floorTop, width: pos.width, height: pos.height };
    }
  }
  return { ...pos, left: x, top: floorTop, width: pos.width, height: pos.height };
}

function distToHome(pos, home) {
  if (!pos || !home) return Infinity;
  const cx = pos.left + pos.width / 2;
  const cy = pos.top + pos.height / 2;
  const hx = home.left + home.width / 2;
  const hy = home.top + home.height / 2;
  return Math.hypot(cx - hx, cy - hy);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t * t * t;
}

/**
 * Unscaled page box. Prefer a layout nest; else reconstruct from the img using
 * offset* (ignores CSS transforms) so pickup scale never feeds size/position.
 */
function unscaledBox(layoutEl, visualEl) {
  const el = layoutEl || visualEl;
  if (!el) return null;
  const r = (visualEl || el).getBoundingClientRect();
  const w = el.offsetWidth || visualEl?.offsetWidth || 0;
  const h = el.offsetHeight || visualEl?.offsetHeight || 0;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return {
    left: cx - w / 2,
    top: cy - h / 2,
    width: w,
    height: h,
  };
}

/**
 * Nintendo / Mario-style landing poof (Bounce Landing + Odyssey references):
 * white → pale-blue lobed cartoon clouds, floor rolls L/R, white impact ring,
 * tiny sparkles. No brown/dirt haze — soft toon puffs that hug the ground.
 */
function DustBurst({ left, top, width, height }) {
  const canvasRef = useRef(null);
  const originX = left + width / 2;
  const originY = top + height - 1;
  const base = Math.max(40, Math.min(96, width * 0.78));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pad = base * 3.2;
    const cw = pad * 2;
    const ch = pad * 1.55;
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.style.left = `${originX - pad}px`;
    canvas.style.top = `${originY - ch * 0.78}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ox = pad;
    const oy = ch * 0.78;

    // Lobed cartoon cloud — overlapping circles (Mario/Smash puff silhouette)
    const lobesFor = (seed) => {
      const s = seed % 5;
      return [
        { ox: 0, oy: 0, r: 1 },
        { ox: 0.42, oy: -0.18, r: 0.72 },
        { ox: -0.4, oy: -0.12, r: 0.68 },
        { ox: 0.12, oy: -0.42, r: 0.55 },
        { ox: s > 2 ? 0.55 : -0.52, oy: 0.08, r: 0.48 },
      ];
    };

    // Floor rolls L/R + centre lift — white/pale-blue only
    const seeds = [
      { side: -1, speed: 118, lift: 22, size: base * 0.48, life: 0.52 },
      { side: 1, speed: 122, lift: 20, size: base * 0.5, life: 0.54 },
      { side: -1, speed: 88, lift: 28, size: base * 0.38, life: 0.46 },
      { side: 1, speed: 92, lift: 26, size: base * 0.4, life: 0.48 },
      { side: -1, speed: 148, lift: 14, size: base * 0.32, life: 0.42 },
      { side: 1, speed: 142, lift: 15, size: base * 0.33, life: 0.42 },
      { side: -0.55, speed: 70, lift: 34, size: base * 0.36, life: 0.5 },
      { side: 0.55, speed: 72, lift: 32, size: base * 0.36, life: 0.5 },
      { side: 0, speed: 12, lift: 38, size: base * 0.44, life: 0.48 },
      { side: -0.25, speed: 48, lift: 18, size: base * 0.28, life: 0.4 },
      { side: 0.25, speed: 50, lift: 17, size: base * 0.28, life: 0.4 },
    ];

    const puffs = seeds.map((s, i) => {
      const j = ((i * 19) % 9) - 4;
      return {
        x: ox + j * 1.5,
        y: oy - 2,
        vx: s.side * s.speed + j * 4,
        vy: -s.lift,
        size0: s.size * (0.92 + (i % 4) * 0.04),
        life: s.life * (0.94 + (i % 5) * 0.02),
        age: 0,
        spin: ((i % 2) * 2 - 1) * (1.1 + i * 0.05),
        rot: (i * 0.7) % Math.PI,
        lobes: lobesFor(i),
        cool: 0.35 + (i % 3) * 0.12, // pale-blue mix amount
      };
    });

    // Tiny sparkles (soft Smash “bonk” glitter — white, not gold glare)
    const sparks = Array.from({ length: 7 }, (_, i) => {
      const a = (-Math.PI * 0.85 + (i / 6) * Math.PI * 1.7) + (i % 2) * 0.12;
      const sp = 70 + (i % 3) * 28;
      return {
        x: ox,
        y: oy - 4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.55 - 40,
        life: 0.28 + (i % 3) * 0.04,
        age: 0,
        r: 2.2 + (i % 3),
      };
    });

    const ring = { age: 0, life: 0.38, r0: base * 0.08, r1: base * 1.15 };

    let raf = 0;
    let last = performance.now();

    const fillLobes = (R, lobes) => {
      ctx.beginPath();
      for (const l of lobes) {
        ctx.moveTo(l.ox * R + l.r * R, l.oy * R);
        ctx.arc(l.ox * R, l.oy * R, l.r * R, 0, Math.PI * 2);
      }
    };

    const drawCloud = (p, scale, alpha, squashY) => {
      if (alpha < 0.02) return;
      const R = p.size0 * scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1.18, squashY);

      // Soft cool under-shadow (toon depth, not dirt brown)
      fillLobes(R * 1.04, p.lobes);
      ctx.fillStyle = `rgba(150, 180, 210, ${alpha * 0.16})`;
      ctx.fill();

      // White → pale blue fill (Bounce Landing / Mario palette)
      const g = ctx.createRadialGradient(
        -R * 0.2,
        -R * 0.4,
        R * 0.08,
        0,
        R * 0.1,
        R * 1.1
      );
      const coolB = Math.round(238 + p.cool * 16);
      g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      g.addColorStop(0.4, `rgba(250, 253, 255, ${alpha * 0.92})`);
      g.addColorStop(
        0.75,
        `rgba(${228 + Math.round(p.cool * 8)}, 240, ${coolB}, ${alpha * 0.62})`
      );
      g.addColorStop(1, `rgba(210, 230, 245, 0)`);
      fillLobes(R, p.lobes);
      ctx.fillStyle = g;
      ctx.fill();

      // Single soft rim on the main body — avoids nested lobe outlines
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.92, R * 0.78, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 220, 240, ${alpha * 0.35})`;
      ctx.lineWidth = Math.max(1, R * 0.035);
      ctx.stroke();

      // Upper-left toon highlight
      ctx.beginPath();
      ctx.ellipse(-R * 0.25, -R * 0.35, R * 0.32, R * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
      ctx.fill();

      ctx.restore();
    };

    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, cw, ch);

      // White impact ring (flat ellipse on the floor)
      ring.age += dt;
      const rt = Math.min(1, ring.age / ring.life);
      const ease = 1 - (1 - rt) ** 3;
      const rr = ring.r0 + (ring.r1 - ring.r0) * ease;
      const ra = (1 - rt) * 0.7;
      if (ra > 0.02) {
        ctx.beginPath();
        ctx.ellipse(ox, oy, rr * 1.45, rr * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ra})`;
        ctx.lineWidth = 2.8 * (1 - rt * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(ox, oy, rr * 1.45, rr * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(190, 220, 245, ${ra * 0.55})`;
        ctx.lineWidth = 5 * (1 - rt * 0.4);
        ctx.stroke();
      }

      let alive = ra > 0.02;

      for (const p of puffs) {
        p.age += dt;
        if (p.age >= p.life) continue;
        alive = true;
        const t = p.age / p.life;
        p.vx *= Math.exp(-3.6 * dt);
        p.vy *= Math.exp(-2.4 * dt);
        p.vy += 28 * dt; // light gravity so clouds settle on the floor
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Don't sink through the floor line
        if (p.y > oy + 2) {
          p.y = oy + 2;
          p.vy *= -0.15;
        }
        p.rot += p.spin * dt * (1 - t * 0.6);

        // Pop overshoot then settle (cartoon poof), grow ~2× overall
        const pop =
          t < 0.18 ? 0.55 + (t / 0.18) * 0.7 : 1.15 + (t - 0.18) * 0.85;
        const fade =
          t < 0.08 ? t / 0.08 : t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1;
        // Squash more as it dies — ground-hugging Odyssey look
        const squash = 0.72 - t * 0.18;
        drawCloud(p, pop, fade * 0.92, squash);
      }

      for (const s of sparks) {
        s.age += dt;
        if (s.age >= s.life) continue;
        alive = true;
        const t = s.age / s.life;
        s.vx *= Math.exp(-3 * dt);
        s.vy *= Math.exp(-2 * dt);
        s.vy += 90 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        const r = s.r * (1 - t * 0.4);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(t * 4);
        ctx.beginPath();
        // 4-point sparkle
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 2;
          ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          ctx.lineTo(Math.cos(ang + Math.PI / 4) * r * 0.35, Math.sin(ang + Math.PI / 4) * r * 0.35);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, a) * 0.9})`;
        ctx.fill();
        ctx.restore();
      }

      if (alive) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [base, originX, originY]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.plazaDustCanvas}
      aria-hidden="true"
    />
  );
}

/**
 * Nest owns layout forever from prop pixels — never from the lifted sprite.
 * Drag uses a body portal overlay (dnd-kit DragOverlay pattern).
 */
/** Mii-like idle blink: open still + short one-shot blink clip on a random timer. */
const BLINK_MIN_MS = 2800;
const BLINK_MAX_MS = 7000;
const BLINK_PLAY_MS = 150; // half+closed+half (+slop) — snappier lid motion
const SPIN_BASE_DPS = 360 / 1.8; // matches the old 1.8s / turn
const SPIN_SPEED_MULT = 1.22; // each extra click
const SPIN_MAX_DPS = SPIN_BASE_DPS * 2.8;

export default function DraggablePlazaSprite({
  className = "",
  src,
  blinkSrc = null,
  alt = "",
  width,
  height,
  reserveSpace = false,
  onGrabChange,
}) {
  const nestRef = useRef(null);
  const imgRef = useRef(null);
  const homeRef = useRef(null);
  const freeRef = useRef(null);
  const dragRef = useRef(null);
  const animTimer = useRef(0);
  const snapRaf = useRef(0);
  const blinkWaitTimer = useRef(0);
  const blinkPlayTimer = useRef(0);
  const canBlinkRef = useRef(true);
  const spinRaf = useRef(0);
  const spinDisplay = useRef(0); // visual degrees, always kept in [0, 360)
  const spinRemaining = useRef(0); // degrees still to travel
  const spinSpeed = useRef(SPIN_BASE_DPS);
  const spinLast = useRef(0);

  // Locked footprint — never re-derived from a scaled getBoundingClientRect
  const nestW = Number(width) || 72;
  const nestH = Number(height) || 135;

  const [free, setFree] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [nearHome, setNearHome] = useState(false);
  const [dust, setDust] = useState(null);
  const [phase, setPhase] = useState("idle");
  // 1 = fully lifted, 0 = settled — eased during snap/fall so we don't hard-cut transform
  const [lift, setLift] = useState(0);
  // Extra translateY during fall (negative = still in the air)
  const [fallY, setFallY] = useState(0);
  const [displaySrc, setDisplaySrc] = useState(src);
  const [spinning, setSpinning] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);
  // Mirror of homeRef — refs alone don't re-render the snap preview
  const [homeBox, setHomeBox] = useState(null);

  const clearAnimTimer = () => {
    if (animTimer.current) {
      window.clearTimeout(animTimer.current);
      animTimer.current = 0;
    }
  };

  const clearSnapRaf = () => {
    if (snapRaf.current) {
      cancelAnimationFrame(snapRaf.current);
      snapRaf.current = 0;
    }
  };

  const clearSpinRaf = () => {
    if (spinRaf.current) {
      cancelAnimationFrame(spinRaf.current);
      spinRaf.current = 0;
    }
  };

  const stopSpin = () => {
    clearSpinRaf();
    spinDisplay.current = 0;
    spinRemaining.current = 0;
    spinSpeed.current = SPIN_BASE_DPS;
    spinLast.current = 0;
    setSpinDeg(0);
    setSpinning(false);
  };

  const addSpin = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const active = spinRaf.current !== 0;
    if (active) {
      spinRemaining.current += 360;
      spinSpeed.current = Math.min(
        SPIN_MAX_DPS,
        spinSpeed.current * SPIN_SPEED_MULT
      );
      return;
    }

    spinDisplay.current = 0;
    spinRemaining.current = 360;
    spinSpeed.current = SPIN_BASE_DPS;
    spinLast.current = performance.now();
    setSpinDeg(0);
    setSpinning(true);

    const tick = (now) => {
      const dt = Math.min(0.05, (now - spinLast.current) / 1000);
      spinLast.current = now;
      const step = spinSpeed.current * dt;

      if (step >= spinRemaining.current) {
        // Complete the last sliver forward, then hard-stop at 0° (no CSS tween back)
        clearSpinRaf();
        spinDisplay.current = 0;
        spinRemaining.current = 0;
        spinSpeed.current = SPIN_BASE_DPS;
        setSpinDeg(0);
        setSpinning(true); // keep transition:none + rotate(0) for one paint
        requestAnimationFrame(() => {
          if (spinRaf.current) return; // a new spin started
          setSpinning(false);
        });
        return;
      }

      spinRemaining.current -= step;
      spinDisplay.current = (spinDisplay.current + step) % 360;
      setSpinDeg(spinDisplay.current);
      spinRaf.current = requestAnimationFrame(tick);
    };

    spinRaf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => {
    clearAnimTimer();
    clearSnapRaf();
    clearSpinRaf();
    if (blinkWaitTimer.current) window.clearTimeout(blinkWaitTimer.current);
    if (blinkPlayTimer.current) window.clearTimeout(blinkPlayTimer.current);
  }, []);

  // Idle only — no blink while grabbed, snapping, landing, spinning, or yeeted
  canBlinkRef.current =
    Boolean(blinkSrc) && !dragging && !spinning && phase === "idle";

  useEffect(() => {
    if (!canBlinkRef.current) {
      setDisplaySrc(src);
      if (blinkPlayTimer.current) {
        window.clearTimeout(blinkPlayTimer.current);
        blinkPlayTimer.current = 0;
      }
    }
  }, [dragging, spinning, phase, src]);

  useEffect(() => {
    setDisplaySrc(src);
  }, [src]);

  useEffect(() => {
    if (!blinkSrc) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    let cancelled = false;

    const clearBlinkTimers = () => {
      if (blinkWaitTimer.current) {
        window.clearTimeout(blinkWaitTimer.current);
        blinkWaitTimer.current = 0;
      }
      if (blinkPlayTimer.current) {
        window.clearTimeout(blinkPlayTimer.current);
        blinkPlayTimer.current = 0;
      }
    };

    const schedule = () => {
      clearBlinkTimers();
      const wait = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
      blinkWaitTimer.current = window.setTimeout(() => {
        if (cancelled) return;
        if (!canBlinkRef.current) {
          schedule();
          return;
        }
        // Cache-bust so the one-shot WebP replays each blink
        setDisplaySrc(`${blinkSrc}?b=${Date.now()}`);
        blinkPlayTimer.current = window.setTimeout(() => {
          if (cancelled) return;
          setDisplaySrc(src);
          schedule();
        }, BLINK_PLAY_MS);
      }, wait);
    };

    schedule();
    return () => {
      cancelled = true;
      clearBlinkTimers();
    };
  }, [blinkSrc, src]);

  const setHome = (box) => {
    if (box) {
      homeRef.current = { ...box };
      setHomeBox({ ...box });
    } else {
      homeRef.current = null;
      setHomeBox(null);
    }
  };

  const liveHomeBox = () => {
    const nest = nestRef.current;
    if (reserveSpace && nest) return unscaledBox(nest, null);
    return homeRef.current ? { ...homeRef.current } : null;
  };

  /** rAF snap — avoids CSS left/top transition + remount double-jump */
  const runSnapHome = (fromPos, startLift) => {
    clearSnapRaf();
    clearAnimTimer();
    const from = { ...fromPos };
    const t0 = performance.now();
    setPhase("snapping");
    setNearHome(false);
    setLift(startLift);
    setFallY(0);

    // Banner cutout home pose hangs past the header on purpose and relies on
    // overflow:hidden. Never park a portaled frame on that pose — remount into
    // the nest instead (drag near home stays fully visible / portaled).
    const finishIntoNest = () => {
      freeRef.current = null;
      setHome(null);
      setFree(null);
      setLift(0);
      setPhase("idle");
      snapRaf.current = 0;
    };

    const finish = (target) => {
      if (!reserveSpace) {
        finishIntoNest();
        return;
      }
      // Land exactly on live nest, then remount on the next frame (seamless)
      freeRef.current = { ...target };
      setFree({ ...target });
      setLift(0);
      snapRaf.current = requestAnimationFrame(() => {
        setHome(null);
        freeRef.current = null;
        setFree(null);
        setPhase("idle");
        snapRaf.current = 0;
      });
    };

    const tick = (now) => {
      const target = liveHomeBox() || homeRef.current;
      if (!target) {
        finishIntoNest();
        return;
      }

      const t = Math.min(1, (now - t0) / SNAP_MS);
      const e = easeOutCubic(t);
      const pos = {
        width: from.width + (target.width - from.width) * e,
        height: from.height + (target.height - from.height) * e,
        left: from.left + (target.left - from.left) * e,
        top: from.top + (target.top - from.top) * e,
      };

      // Banner: remount into clipped nest before the overflowing home pose wins
      if (!reserveSpace && (t >= 0.72 || distToHome(pos, target) < 18)) {
        finishIntoNest();
        return;
      }

      freeRef.current = pos;
      setFree(pos);
      setLift(startLift * (1 - e));

      if (t < 1) {
        snapRaf.current = requestAnimationFrame(tick);
      } else {
        finish(target);
      }
    };

    snapRaf.current = requestAnimationFrame(tick);
  };

  /**
   * Mario / Smash-style release: real ballistic arc to a floor line.
   * vx stays alive through the whole fall (mild air friction only) — no
   * “slide then suddenly stop, then drop”. Impact dust + short ground slide.
   */
  const runFallLand = (startLift = 1, tossVx = 0, tossVy = 0) => {
    clearSnapRaf();
    clearAnimTimer();
    const pos0 = freeRef.current;
    if (!pos0) return;

    setPhase("landing");
    setNearHome(false);
    setFallY(0); // position lives in free.top/left now

    const releaseTop = pos0.top;
    const floorTop = releaseTop + OVERSHOOT_PX;
    const lifted = {
      ...pos0,
      top: releaseTop - DRAG_LIFT_PX * Math.max(0.55, startLift),
    };
    freeRef.current = lifted;
    setFree(lifted);
    setLift(startLift);

    let vx = tossVx * THROW_VX_KEEP;
    let vy = Math.min(tossVy * THROW_VY_KEEP, 420);
    // Stationary drop still needs a nudge into gravity’s pull
    if (Math.abs(vy) < 50) vy = 80;

    let liftAmt = startLift;
    let grounded = false;
    let dustFired = false;
    let last = performance.now();
    const t0 = last;

    const tick = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const pos = freeRef.current;
      if (!pos) {
        setPhase("idle");
        snapRaf.current = 0;
        return;
      }

      if (!grounded) {
        // Independent axes — arcade projectile parabola
        vy += LAND_GRAVITY * dt;
        vx *= Math.exp(-AIR_FRICTION * dt);
        let next = {
          ...pos,
          left: pos.left + vx * dt,
          top: pos.top + vy * dt,
        };
        liftAmt = Math.max(0, liftAmt - dt * 2.4);

        if (next.top >= floorTop) {
          next = { ...next, top: floorTop };
          grounded = true;
          // Contact: light bounce + keep some horizontal (Smash item slide)
          vy = -Math.min(220, Math.abs(vy) * 0.22);
          vx *= 0.72;
          if (!dustFired) {
            dustFired = true;
            spawnDust(next);
          }
        }

        freeRef.current = next;
        setFree(next);
        setLift(liftAmt);
      } else {
        vy += LAND_GRAVITY * dt;
        vx *= Math.exp(-GROUND_FRICTION * dt);
        let top = pos.top + vy * dt;
        if (top >= floorTop) {
          top = floorTop;
          vy = Math.abs(vy) < 55 ? 0 : -vy * 0.14;
        }
        const next = {
          ...pos,
          left: pos.left + vx * dt,
          top,
        };
        freeRef.current = next;
        setFree(next);
        setLift(0);

        if (
          Math.abs(vx) < 14 &&
          Math.abs(vy) < 25 &&
          top >= floorTop - 0.5
        ) {
          freeRef.current = { ...next, top: floorTop };
          setFree(freeRef.current);
          setPhase("idle");
          snapRaf.current = 0;
          return;
        }
      }

      // Safety — never hang the anim
      if (now - t0 > 2200) {
        const p = freeRef.current;
        if (p) {
          freeRef.current = { ...p, top: floorTop };
          setFree(freeRef.current);
        }
        setLift(0);
        setPhase("idle");
        snapRaf.current = 0;
        return;
      }

      snapRaf.current = requestAnimationFrame(tick);
    };

    snapRaf.current = requestAnimationFrame(tick);
  };

  /**
   * Fly off-screen with the release momentum + gravity. Gone until refresh.
   * Only used when the *landing* would hang off the viewport — not for every flick.
   */
  const runFlyOff = (startLift = 1, vx0 = 0, vy0 = 0) => {
    clearSnapRaf();
    clearAnimTimer();
    setPhase("fallingOff");
    setNearHome(false);
    setFallY(0);
    setLift(startLift);
    // Keep homeRef so the silhouette stays behind
    // Preserve throw direction — do NOT force a huge downward boost
    let vx = vx0;
    let vy = vy0;
    let last = performance.now();
    let dustFired = false;

    const tick = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const pos = freeRef.current;
      if (!pos) {
        setPhase("gone");
        snapRaf.current = 0;
        return;
      }

      vy += THROW_GRAVITY * dt;
      const next = {
        ...pos,
        left: pos.left + vx * dt,
        top: pos.top + vy * dt,
      };
      freeRef.current = next;
      setFree(next);
      setLift((prev) => Math.max(0, prev - dt * 2.2));

      if (!dustFired && wouldBeOffscreen(next)) {
        dustFired = true;
        // Poof near the edge they crossed
        const edge = {
          ...next,
          left: clamp(next.left, 8, window.innerWidth - next.width - 8),
          top: clamp(next.top, 8, window.innerHeight - next.height * 0.35),
        };
        spawnDust(edge);
      }

      if (fullyOffscreen(next)) {
        freeRef.current = null;
        setFree(null);
        setFallY(0);
        setLift(0);
        setPhase("gone");
        snapRaf.current = 0;
        return;
      }

      snapRaf.current = requestAnimationFrame(tick);
    };

    snapRaf.current = requestAnimationFrame(tick);
  };

  const spawnDust = (pos) => {
    if (!pos) return;
    setDust({
      left: pos.left,
      top: pos.top,
      width: pos.width,
      height: pos.height,
      key: Date.now(),
    });
    window.setTimeout(() => setDust(null), DUST_MS);
  };

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (
      phase === "snapping" ||
      phase === "landing" ||
      phase === "fallingOff" ||
      phase === "gone"
    ) {
      return;
    }
    const nest = nestRef.current;
    const imgEl = imgRef.current;
    if (!nest && !imgEl) return;

    clearAnimTimer();
    clearSnapRaf();

    // About Mii: size from locked nest. Hero cutout: size from img offset*.
    const layoutEl = reserveSpace ? nest : null;
    const box = unscaledBox(layoutEl, imgEl);
    if (!box) return;

    const startedFree = Boolean(free);
    if (!homeRef.current || !free) {
      setHome(box);
    }
    const homeAtStart = homeRef.current || box;

    const start = free
      ? {
          left: free.left,
          top: free.top,
          width: homeAtStart.width,
          height: homeAtStart.height,
        }
      : { ...box };

    // Defer free/lift until the pointer actually moves — click spin must stay
    // nest-mounted so the banner cutout never flashes outside the header clip.
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - start.left,
      offsetY: e.clientY - start.top,
      startX: e.clientX,
      startY: e.clientY,
      startedFree,
      committed: startedFree, // already loose → dragging immediately
      homeBox: { ...homeAtStart },
      startPos: { ...start },
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };

    setFallY(0);
    setPhase("idle");

    if (startedFree) {
      freeRef.current = start;
      setFree(start);
      setDragging(true);
      setLift(1);
      setNearHome(distToHome(start, homeRef.current) < SNAP_RADIUS);
      onGrabChange?.(true);
    }

    const commitDrag = (ev, d) => {
      if (d.committed) return;
      d.committed = true;
      stopSpin();
      if (!homeRef.current) setHome(d.homeBox);
      const pos = {
        ...d.startPos,
        left: ev.clientX - d.offsetX,
        top: ev.clientY - d.offsetY,
      };
      freeRef.current = pos;
      setFree(pos);
      setDragging(true);
      setLift(1);
      setNearHome(distToHome(pos, homeRef.current) < SNAP_RADIUS);
      onGrabChange?.(true);
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointerId) return;

      d.samples.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
      if (d.samples.length > 8) d.samples.shift();

      const moveDist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
      // Real drag (not click) kills an in-progress twirl
      if (!d.spinCancelled && moveDist >= CLICK_MOVE_PX) {
        d.spinCancelled = true;
        stopSpin();
      }
      if (!d.committed) {
        if (moveDist < CLICK_MOVE_PX) return;
        // Banner cutout: stay nest-mounted (header-clipped) until clear of home
        if (!reserveSpace && !d.startedFree) {
          const trial = {
            ...d.startPos,
            left: ev.clientX - d.offsetX,
            top: ev.clientY - d.offsetY,
          };
          if (distToHome(trial, d.homeBox) < SNAP_RADIUS) return;
        }
        commitDrag(ev, d);
      }

      const home = homeRef.current;
      let pos = {
        ...freeRef.current,
        left: ev.clientX - d.offsetX,
        top: ev.clientY - d.offsetY,
      };

      const dist = distToHome(pos, home);
      const inSnap = dist < SNAP_RADIUS;
      setNearHome(inSnap);

      if (inSnap && home) {
        const t = 1 - dist / SNAP_RADIUS;
        const pull = 0.22 * t * t;
        pos = {
          ...pos,
          left: pos.left + (home.left - pos.left) * pull,
          top: pos.top + (home.top - pos.top) * pull,
        };
      }

      freeRef.current = pos;
      setFree(pos);
    };

    const onUp = (ev) => {
      const d = dragRef.current;
      if (!d || (ev.pointerId != null && ev.pointerId !== d.pointerId)) return;
      d.samples.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
      const { vx, vy } = velocityFromSamples(d.samples);
      const speed = Math.hypot(vx, vy);
      const wasCommitted = d.committed;
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      // Never picked up → click twirl in nest (banner stays clipped)
      if (!wasCommitted) {
        setPhase("idle");
        addSpin();
        return;
      }

      setDragging(false);
      onGrabChange?.(false);

      // Free-pose click (tiny move after already loose) → twirl in place
      const moveDist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
      if (moveDist < CLICK_MOVE_PX && speed < CLICK_SPEED) {
        setLift(0);
        setFallY(0);
        setNearHome(false);
        setPhase("idle");
        addSpin();
        return;
      }

      const home = homeRef.current;
      const pos = freeRef.current;
      const shouldSnap = distToHome(pos, home) < SNAP_RADIUS;

      if (shouldSnap && home) {
        runSnapHome(pos, 0.5);
        return;
      }

      // Ballistic land prediction. Fly off ONLY if rest pose would hang off-screen.
      const landPos = estimateLandPos(pos, vx, vy);
      const landsOff =
        wouldBeOffscreen(landPos) || (pos && wouldBeOffscreen(pos));

      if (landsOff) {
        let flingVx = vx;
        let flingVy = vy;
        if (speed < 180 && landPos) {
          if (landPos.left < 0) flingVx = -700;
          else if (landPos.left + landPos.width > window.innerWidth) flingVx = 700;
          if (landPos.top + landPos.height > window.innerHeight) {
            flingVy = Math.max(flingVy, 900);
          } else if (landPos.top < 0) {
            flingVy = Math.min(flingVy, -500);
          }
        }
        runFlyOff(1, flingVx, flingVy);
      } else {
        runFallLand(1, vx, vy);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    e.preventDefault();
    e.stopPropagation();
  };

  // Snap/fall drive transform in JS — skip CSS lift classes that hard-cut
  const useCssLift = dragging && phase === "idle";
  const isFalling = phase === "landing" || phase === "fallingOff";
  // Banner snap only: paint inside the nest so header overflow clips — never
  // park an unclipped overflowing home pose (drag near home stays portaled).
  const bannerSnapClip = Boolean(
    !reserveSpace && free && phase === "snapping" && nestRef.current
  );
  const nestRect = bannerSnapClip
    ? nestRef.current.getBoundingClientRect()
    : null;

  const imgClass = [
    className,
    styles.plazaDraggable,
    styles.plazaSpriteImg,
    useCssLift ? styles.plazaDragging : "",
    free && !bannerSnapClip ? styles.plazaFreed : "",
    bannerSnapClip ? styles.plazaBannerSnapClip : "",
    isFalling ? styles.plazaLanding : "",
    phase === "snapping" ? styles.plazaSnapping : "",
    useCssLift && nearHome ? styles.plazaNearHome : "",
    spinning ? styles.plazaSpinning : "",
  ]
    .filter(Boolean)
    .join(" ");

  let motionTransform;
  if (phase === "snapping") {
    motionTransform =
      lift > 0.001
        ? `scale(${1 + 0.06 * lift}) translateY(${-6 * lift}px)`
        : "none";
  } else if (isFalling) {
    // Drag height → overshoot below release (or clean off the page)
    motionTransform = `translateY(${fallY}px) scale(${1 + 0.05 * lift})`;
  } else if (spinning || spinDeg) {
    motionTransform = `rotate(${spinDeg}deg)`;
  } else {
    motionTransform = undefined;
  }

  const shadowFilter = isFalling
    ? `drop-shadow(0 ${Math.max(4, 8 + Math.max(0, -fallY) * 0.55)}px ${5 + Math.max(0, -fallY) * 0.2}px rgba(40, 70, 100, ${0.18 + lift * 0.12}))`
    : undefined;

  let imgStyle;
  if (free && bannerSnapClip && nestRect) {
    imgStyle = {
      position: "absolute",
      left: free.left - nestRect.left,
      top: free.top - nestRect.top,
      width: free.width,
      height: free.height,
      zIndex: 3,
      margin: 0,
      bottom: "auto",
      right: "auto",
      maxHeight: "none",
      maxWidth: "none",
      transition: "none",
      transform: motionTransform,
      filter: shadowFilter,
      willChange: "left, top, transform, filter",
    };
  } else if (free) {
    imgStyle = {
      position: "fixed",
      left: free.left,
      top: free.top,
      width: free.width,
      height: free.height,
      zIndex: 10050,
      margin: 0,
      bottom: "auto",
      right: "auto",
      maxHeight: "none",
      maxWidth: "none",
      transition: "none",
      transform: motionTransform,
      filter: shadowFilter,
      pointerEvents: phase === "fallingOff" ? "none" : undefined,
      willChange:
        phase === "snapping" || isFalling || spinning
          ? "left, top, transform, filter"
          : undefined,
    };
  } else if (spinning || spinDeg) {
    imgStyle = {
      transform: motionTransform,
      transition: "none",
      willChange: "transform",
    };
  } else {
    imgStyle = undefined;
  }

  const img = (
    <img
      ref={imgRef}
      className={imgClass}
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      draggable={false}
      onPointerDown={onPointerDown}
      style={imgStyle}
    />
  );

  /** Click the empty silhouette after a yeet → asset pops back into place. */
  const recallHome = (e) => {
    if (phase !== "gone") return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    clearSnapRaf();
    clearAnimTimer();
    freeRef.current = null;
    setHome(null);
    setFree(null);
    setFallY(0);
    setLift(0);
    setNearHome(false);
    setDust(null);
    setPhase("idle");
  };

  // Silhouette while away — nest-local only (scrolls/zooms with the real asset).
  const showHomeMark = Boolean(
    homeBox && (free || phase === "fallingOff" || phase === "gone")
  );
  const canRecall = phase === "gone";
  const near = Boolean(free && nearHome && (dragging || phase === "idle"));

  const renderHomeMark = () => {
    if (!showHomeMark) return null;
    const silClass = near
      ? styles.plazaSnapGhostLocal
      : styles.plazaHomeSilhouetteLocal;

    if (reserveSpace) {
      return (
        <>
          <div
            className={styles.plazaNestShadowLocal}
            style={{
              left: "12%",
              top: "78%",
              width: "76%",
              height: "12%",
            }}
            aria-hidden="true"
          />
          <img
            key={near ? "snap-ghost" : "home-sil"}
            className={[
              styles.plazaNestGhostFill,
              silClass,
              canRecall ? styles.plazaHomeSilhouetteRecall : "",
            ]
              .filter(Boolean)
              .join(" ")}
            src={src}
            alt={canRecall ? "Where did he go?" : ""}
            title={canRecall ? "Where did he go?" : undefined}
            draggable={false}
            onPointerDown={canRecall ? recallHome : undefined}
          />
        </>
      );
    }

    // Banner: same .heroCutout offsets as the resting asset → header clips it
    return (
      <>
        <div
          className={styles.plazaNestShadowLocal}
          style={{
            left: "4%",
            top: "78%",
            width: "42%",
            height: "14%",
          }}
          aria-hidden="true"
        />
        <img
          key={near ? "snap-ghost" : "home-sil"}
          className={[
            className,
            silClass,
            canRecall ? styles.plazaHomeSilhouetteRecall : "",
          ]
            .filter(Boolean)
            .join(" ")}
          src={src}
          alt={canRecall ? "Where did he go?" : ""}
          title={canRecall ? "Where did he go?" : undefined}
          draggable={false}
          onPointerDown={canRecall ? recallHome : undefined}
        />
      </>
    );
  };

  const dustLayer =
    dust && typeof document !== "undefined"
      ? createPortal(
          <DustBurst
            key={dust.key}
            left={dust.left}
            top={dust.top}
            width={dust.width}
            height={dust.height}
          />,
          document.body
        )
      : null;

  const homeMark = showHomeMark ? renderHomeMark() : null;
  const showFreePortal = Boolean(free) && !bannerSnapClip;

  if (reserveSpace) {
    return (
      <>
        <div
          ref={nestRef}
          className={styles.plazaSpriteNest}
          style={{
            width: nestW,
            height: nestH,
            flex: `0 0 ${nestW}px`,
          }}
          data-plaza-nest=""
        >
          <span className={styles.plazaNestSpacer} aria-hidden="true" />
          {homeMark}
          {!free && phase !== "gone" ? img : null}
        </div>
        {dustLayer}
        {showFreePortal && typeof document !== "undefined"
          ? createPortal(img, document.body)
          : null}
      </>
    );
  }

  return (
    <>
      <div ref={nestRef} className={styles.plazaSpriteNestLoose}>
        {homeMark}
        {(!free && phase !== "gone") || bannerSnapClip ? img : null}
      </div>
      {dustLayer}
      {showFreePortal && typeof document !== "undefined"
        ? createPortal(img, document.body)
        : null}
    </>
  );
}
