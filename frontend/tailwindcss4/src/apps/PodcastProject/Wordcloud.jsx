import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import WordCloud from "react-d3-cloud";
import styles from "./Wordcloud.module.css";

// --- CHANGED: Define the correct API base URL ---
const API_BASE = "https://unified-backend.fly.dev/news";

// All color helper functions remain unchanged
function hexToRgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;
  const d = max - min;
  if (d === 0) { s = 0; h = 0; } else {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbStr(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }
function getSentimentColor(value) {
  const t = Math.max(0, Math.min(1, value));
  const stops = ["#d73027", "#7a7a7a", "#1a9850"];
  const tt = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const [start, end] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const [r1, g1, b1] = hexToRgb(start); const [r2, g2, b2] = hexToRgb(end);
  const [h1, s1, l1] = rgbToHsl(r1, g1, b1); const [h2, s2, l2] = rgbToHsl(r2, g2, b2);
  let dh = h2 - h1; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
  const h = (h1 + dh * tt + 1) % 1; const s = s1 + (s2 - s1) * tt; const l = l1 + (l2 - l1) * tt;
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbStr(r, g, b);
}

export default function SentimentWordcloud({
  sourceType = "podcast",
  sourceName = "podcast",
  topic = "all_topics",
  style = {},
}) {
  const [words, setWords] = useState([]);
  const [sentiment, setSentiment] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(540);

  useEffect(() => {
    function handleResize() { if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth); }
    handleResize();
    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => handleResize());
      if (containerRef.current) resizeObserver.observe(containerRef.current);
    } else {
      window.addEventListener("resize", handleResize);
    }
    return () => {
      if (resizeObserver && containerRef.current) resizeObserver.unobserve(containerRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const paramString = `source_type=${encodeURIComponent(sourceType)}&source_name=${encodeURIComponent(sourceName)}&topic=${encodeURIComponent(topic)}`;

    // --- CHANGED: Fetch from the correct unified backend URL ---
    fetch(`${API_BASE}/api/wordcloud/topwords/?${paramString}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0 && Array.isArray(json.data[0].top_words) && typeof json.data[0].top_words[0] === "object") {
          setWords(json.data[0].top_words);
        } else {
          setWords([]);
        }
      });

    // --- CHANGED: Fetch from the correct unified backend URL ---
    fetch(`${API_BASE}/api/wordcloud/sentiment/?${paramString}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0 && typeof json.data[0].quantile_sentiment_scaled === "number") {
          setSentiment(json.data[0].quantile_sentiment_scaled);
        } else {
          setSentiment(0.5);
        }
      })
      .finally(() => setLoading(false));
  }, [sourceType, sourceName, topic]);

  // The rest of the component remains the same
  const fontSize = useCallback((word) => 30 + Math.log1p(word.value) * 55, []);
  const fill = useCallback(() => getSentimentColor(sentiment), [sentiment]);
  const width = Math.max(220, containerWidth || 540);
  const height = Math.max(120, Math.round(width * 0.5));
  useLayoutEffect(() => {
    if (loading || !words.length || !containerRef.current) return;
    const crop = () => {
      const svg = containerRef.current.querySelector(".wordcloudArea svg");
      if (!svg) return; const g = svg.querySelector("g"); if (!g || typeof g.getBBox !== "function") return;
      let bbox; try { bbox = g.getBBox(); } catch { return; }
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
      const padX = 0, padTop = 1, padBottom = -0.5;
      const vbX = bbox.x - padX, vbY = bbox.y - padTop, vbW = bbox.width + padX * 2, vbH = bbox.height + padTop + padBottom;
      const newHeight = Math.max(1, (width * vbH) / vbW);
      svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
      svg.setAttribute("width", String(width)); svg.setAttribute("height", String(newHeight));
    };
    const raf = requestAnimationFrame(crop);
    let cancelled = false;
    if (document.fonts && typeof document.fonts.ready?.then === "function") { document.fonts.ready.then(() => { if (!cancelled) crop(); }); }
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [loading, words, width, height]);

  return (
    <div ref={containerRef} className={styles.wordcloudWrapper} style={style}>
      {loading ? (<div className={styles.wordcloudLoading}>Loading…</div>) : words.length === 0 ? (<div className={styles.wordcloudEmpty}>No words found for this selection.</div>) : (
        <div className={styles.wordcloudArea}>
          <WordCloud data={words} width={width} height={height} font="Inter, Segoe UI, Arial, sans-serif" fontWeight="bold" fontSize={fontSize} spiral="rectangular" rotate={() => 0} padding={2} fill={fill} />
        </div>
      )}
    </div>
  );
}