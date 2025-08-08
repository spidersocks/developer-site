import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import WordCloud from "react-d3-cloud";
import styles from "./Wordcloud.module.css";

// ---------- Color helpers ----------
function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    s = 0; h = 0;
  } else {
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
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbStr(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }

// Red–Gray–Green diverging scale (neutral gray at 0.5)
function getSentimentColor(value) {
  const t = Math.max(0, Math.min(1, value));

  // Control points (ColorBrewer-like ends + neutral gray)
  const stops = ["#d73027", "#7a7a7a", "#1a9850"]; // red -> gray -> green

  // Choose segment and local interpolation parameter
  const tt = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const [start, end] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];

  // Interpolate in HSL with shortest hue path for smoothness
  const [r1, g1, b1] = hexToRgb(start);
  const [r2, g2, b2] = hexToRgb(end);
  const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
  const [h2, s2, l2] = rgbToHsl(r2, g2, b2);

  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;

  const h = (h1 + dh * tt + 1) % 1;
  const s = s1 + (s2 - s1) * tt;
  const l = l1 + (l2 - l1) * tt;

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
  const [sentimentLabel, setSentimentLabel] = useState("Neutral");
  const [loading, setLoading] = useState(true);

  // Responsive: observe container width
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(540);

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }
    handleResize(); // Initial check

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

  // Fetch words and sentiment
  useEffect(() => {
    setLoading(true);
    const paramString = [
      `source_type=${encodeURIComponent(sourceType)}`,
      `source_name=${encodeURIComponent(sourceName)}`,
      `topic=${encodeURIComponent(topic)}`,
    ].join("&");

    // Fetch top words
    fetch(
      `https://podcast-project-backend.onrender.com/api/wordcloud/topwords/?${paramString}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (
          json.data &&
          json.data.length > 0 &&
          Array.isArray(json.data[0].top_words) &&
          typeof json.data[0].top_words[0] === "object"
        ) {
          setWords(json.data[0].top_words);
        } else if (
          json.data &&
          json.data.length > 0 &&
          Array.isArray(json.data[0].top_words)
        ) {
          setWords(
            json.data[0].top_words.map((w, i, arr) => ({
              text: w,
              value: arr.length - i + 10,
            }))
          );
        } else {
          setWords([]);
        }
      });

    // Fetch sentiment for this selection
    fetch(
      `https://podcast-project-backend.onrender.com/api/wordcloud/sentiment/?${paramString}`
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.data && json.data.length > 0) {
          if (json.data[0].sentiment_label) {
            setSentimentLabel(
              json.data[0].sentiment_label.charAt(0).toUpperCase() +
                json.data[0].sentiment_label.slice(1)
            );
          } else {
            setSentimentLabel("Neutral");
          }
          if (typeof json.data[0].quantile_sentiment_scaled === "number") {
            setSentiment(json.data[0].quantile_sentiment_scaled);
          } else {
            setSentiment(0.5);
          }
        } else {
          setSentimentLabel("Neutral");
          setSentiment(0.5);
        }
      })
      .finally(() => setLoading(false));
  }, [sourceType, sourceName, topic]);

  // Font size scales with word tf-idf value (log scale for variety)
  const fontSize = useCallback((word) => 30 + Math.log1p(word.value) * 55, []);

  // All words the same color: by sentiment (red–gray–green)
  const fill = useCallback(() => getSentimentColor(sentiment), [sentiment]);

  // Responsive sizing: always fits the column
  const width = Math.max(220, containerWidth || 540);
  const height = Math.max(120, Math.round(width * 0.5)); // initial aspect ratio target

  // After the cloud renders, crop the SVG tight to the content to minimize bottom gap
  useLayoutEffect(() => {
    if (loading || !words.length || !containerRef.current) return;

    const crop = () => {
      const svg = containerRef.current.querySelector(".wordcloudArea svg");
      if (!svg) return;

      const g = svg.querySelector("g");
      if (!g || typeof g.getBBox !== "function") return;

      let bbox;
      try {
        bbox = g.getBBox();
      } catch {
        return;
      }
      if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;

      // Tighten: tiny top pad, tiny negative bottom pad to shave subpixel whitespace
      const padX = 0;
      const padTop = 1;
      const padBottom = -0.5;

      const vbX = bbox.x - padX;
      const vbY = bbox.y - padTop;
      const vbW = bbox.width + padX * 2;
      const vbH = bbox.height + padTop + padBottom;

      // Keep pixel width constant; compute height from the tight viewBox (no rounding)
      const newHeight = Math.max(1, (width * vbH) / vbW);

      svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(newHeight));
    };

    const raf = requestAnimationFrame(crop);

    // Recrop once fonts are fully loaded to avoid small metric shifts
    let cancelled = false;
    if (document.fonts && typeof document.fonts.ready?.then === "function") {
      document.fonts.ready.then(() => {
        if (!cancelled) crop();
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [loading, words, width, height]);

  return (
    <div ref={containerRef} className={styles.wordcloudWrapper} style={style}>
      {loading ? (
        <div className={styles.wordcloudLoading}>Loading…</div>
      ) : words.length === 0 ? (
        <div className={styles.wordcloudEmpty}>No words found for this selection.</div>
      ) : (
        <div className={styles.wordcloudArea}>
          <WordCloud
            data={words}
            width={width}
            height={height}
            font="Inter, Segoe UI, Arial, sans-serif"
            fontWeight="bold"
            fontSize={fontSize}
            spiral="rectangular"
            rotate={() => 0}
            padding={2}
            fill={fill}
          />
        </div>
      )}
    </div>
  );
}