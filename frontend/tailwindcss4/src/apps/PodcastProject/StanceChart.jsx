import React, { useEffect, useState, useMemo } from "react";
import Plot from "react-plotly.js";
import styles from "./App.module.css";

const TOPIC_GROUPS = {
  People: [
    "alexandria_ocasio-cortez", "ali_khamenei", "benjamin_netanyahu", "bernie_sanders",
    "bob_menendez", "caitlin_clark", "chuck_schumer", "claudia_sheinbaum", "diddy", "donald_trump",
    "elon_musk", "jeff_bezos", "jeffrey_epstein", "joe_biden", "justin_trudeau", "kamala_harris",
    "kanye_west", "karoline_leavitt", "kevin_mccarthy", "luigi_mangione", "mark_carney", "mark_zuckerberg",
    "mike_johnson", "mitch_mcconnell", "nancy_pelosi", "pete_buttigieg", "pete_hegseth", "pope",
    "robert_f._kennedy_jr", "ron_desantis", "sam_altman", "taylor_swift", "tim_cook", "tim_walz",
    "vladimir_putin", "volodymyr_zelensky", "xi_jinping"
  ],
  Countries: [
    "canada", "china", "el_salvador", "india", "iran", "israel", "mexico", "pakistan", "russia",
    "saudi_arabia", "taiwan", "united_kingdom", "united_states"
  ],
  "Political Issues": [
    "abortion", "capital_punishment", "climate_change", "communism", "democratic_party",
    "democratic_socialism", "euthanasia",
    "foreign_aid", "immigration", "military_service", "nuclear_power",
    "police", "privacy", "prostitution", "racism",
    "republican_party", "tariffs", "war", "welfare"
  ]
};

function formatTopicLabel(topic) {
  if (!topic) return "";
  return topic.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

const PODCAST_COLOR = [251, 146, 60];
const NEWS_COLOR = [99, 102, 241];
function getRgba(baseRgb, intensity) {
  const color = [
    Math.round(0.25 * baseRgb[0] + 0.75 * 255 * (1 - intensity) + baseRgb[0] * intensity * 0.75),
    Math.round(0.25 * baseRgb[1] + 0.75 * 255 * (1 - intensity) + baseRgb[1] * intensity * 0.75),
    Math.round(0.25 * baseRgb[2] + 0.75 * 255 * (1 - intensity) + baseRgb[2] * intensity * 0.75),
  ];
  return `rgba(${color[0]},${color[1]},${color[2]},${(0.4 + 0.6 * intensity).toFixed(2)})`;
}

// SVG axis label graphic with proper outward arrows, neutral color
function AxisLabel() {
  return (
    <div style={{
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      margin: "0px 0 0px 0"
    }}>
      <svg
        width="530"
        height="36"
        style={{ maxWidth: "100%", height: "36px" }}
        viewBox="0 0 530 36"
        aria-label="Relative Stance Axis"
        preserveAspectRatio="xMidYMid meet"
      >
        <text x="0" y="27" fontSize="0.85em" fill="#64748b" fontWeight="500" textAnchor="start">
          less favorable
        </text>
        <line x1="115" y1="18" x2="185" y2="18" stroke="#64748b" strokeWidth="2" markerStart="url(#arrowleft)" />
        <text x="260" y="27" fontSize="0.95em" fill="#29292a" fontWeight="700" textAnchor="middle" letterSpacing="0.04em">
          Relative Stance
        </text>
        <line x1="335" y1="18" x2="405" y2="18" stroke="#64748b" strokeWidth="2" markerEnd="url(#arrowright)" />
        <text x="530" y="27" fontSize="0.85em" fill="#64748b" fontWeight="500" textAnchor="end">
          more favorable
        </text>
        <defs>
          <marker id="arrowleft" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <polygon points="5,0 1,2.5 5,5" fill="#64748b" />
          </marker>
          <marker id="arrowright" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto">
            <polygon points="0,0 4,2.5 0,5" fill="#64748b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

export default function StanceChart() {
  const [selectedGroup, setSelectedGroup] = useState("Countries");
  const [dataRows, setDataRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedTopics = TOPIC_GROUPS[selectedGroup] || [];

  useEffect(() => {
    setLoading(true);
    const params = selectedTopics.length
      ? "?topics=" + encodeURIComponent(selectedTopics.join(","))
      : "";
    fetch(`https://podcast-project-backend.onrender.com/api/stance/zscores/${params}`)
      .then(res => res.json())
      .then(json => setDataRows(json.data || []))
      .catch(() => setDataRows([]))
      .finally(() => setLoading(false));
  }, [selectedGroup]);

  const topicAgg = useMemo(() => {
    const agg = {};
    for (const row of dataRows) {
      const t = row.topic;
      if (!agg[t]) agg[t] = {};
      agg[t][row.source_type] = row.stance_score_z;
    }
    return Object.entries(agg)
      .filter(([t, v]) => v.news !== undefined && v.podcast !== undefined);
  }, [dataRows]);

  const sortedTopics = useMemo(() => {
    return topicAgg
      .map(([t, v]) => ({
        topic: t,
        news: v.news,
        podcast: v.podcast,
        diff: v.podcast - v.news,
      }))
      .sort((a, b) => a.diff - b.diff);
  }, [topicAgg]);

  const maxDiff = Math.max(...sortedTopics.map(d => Math.abs(d.diff)), 0.001);

  const lines = sortedTopics.map(row => {
    const intensity = Math.abs(row.diff) / maxDiff;
    const color = row.diff > 0
      ? getRgba(PODCAST_COLOR, intensity)
      : getRgba(NEWS_COLOR, intensity);
    return {
      x: [row.news, row.podcast],
      y: [formatTopicLabel(row.topic), formatTopicLabel(row.topic)],
      mode: "lines",
      line: { color, width: 6 },
      hoverinfo: "skip",
      showlegend: false,
    };
  });

const newsTrace = {
  x: sortedTopics.map(row => row.news),
  y: sortedTopics.map(row => formatTopicLabel(row.topic)),
  mode: "markers",
  name: "News",
  marker: {
    color: "#6366f1",
    symbol: "square",
    size: 12,
  },
  hovertemplate: "News<br>Relative Stance: %{x:.2f}<br>Topic: %{y}<extra></extra>",
};

const podcastTrace = {
  x: sortedTopics.map(row => row.podcast),
  y: sortedTopics.map(row => formatTopicLabel(row.topic)),
  mode: "markers",
  name: "Podcast",
  marker: {
    color: "#fb923c",
    symbol: "circle",
    size: 12,
  },
  hovertemplate: "Podcast<br>Relative Stance: %{x:.2f}<br>Topic: %{y}<extra></extra>",
};
  const chartHeight = Math.max(360, 28 * sortedTopics.length + 120);

  return (
    <div style={{ width: "100%", marginTop: 48 }}>
      <h3 className={styles.chartTitle} style={{ marginTop: 0, marginBottom: 0, fontWeight: 700 }}>
        Relative Stance by Topic and Source Type
      </h3>
      <div style={{ color: "#64748b", fontSize: "1.05rem", marginBottom: 8, marginTop: 2 }}>
        Line color represents which medium is more favorable & size of the difference.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}> {/* Reduced gap and marginBottom */}
        <label htmlFor="topicGroupSelect" style={{ color: "#64748b", fontWeight: 500, minWidth: "fit-content" }}>
            Topic group:
        </label>
        <select
            id="topicGroupSelect"
            className={styles.dropdown}
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
        >
            {Object.keys(TOPIC_GROUPS).map(gr => (
            <option key={gr} value={gr}>{gr}</option>
            ))}
        </select>
        </div>
      <div className={styles.chartScrollWrapper} style={{ minWidth: 320 }}>
        <AxisLabel />
        {loading ? (
          <div>
            <div className={styles.spinner} />
            <div style={{ textAlign: "center", color: "#64748b" }}>Loading stance chart…</div>
          </div>
        ) : (
          <Plot
            data={[...lines, newsTrace, podcastTrace]}
            layout={{
                height: chartHeight,
                margin: { l: 150, r: 120, t: 5, b: 60 },
                yaxis: {
                    title: "",
                    showticklabels: true,
                    automargin: true,
                    tickfont: { size: 13, color: "#64748b" },
                    categoryorder: "array",
                    categoryarray: sortedTopics.map(row => formatTopicLabel(row.topic)),
                },
                xaxis: {
                    showticklabels: false,
                    showgrid: false,
                    zeroline: false,
                    title: "",
                    tickfont: { size: 12, color: "#64748b" },
                },
                shapes: [{
                    type: 'line',
                    x0: 0, x1: 0,
                    y0: -0.5, y1: sortedTopics.length - 0.5,
                    line: { color: '#e2e8f0', width: 1, dash: 'dot' }
                }],
                legend: {
                    orientation: "h",
                    yanchor: "bottom",
                    y: -0.05,
                    xanchor: "center",
                    x: 0.5,
                },
              template: "plotly_white",
              plot_bgcolor: "rgba(0,0,0,0)",
              paper_bgcolor: "rgba(0,0,0,0)",
              title: { text: "" },
              font: { family: "Inter, sans-serif", color: "#222" },
              hoverlabel: { bgcolor: "#fff" },
              responsive: true,
            }}
            config={{
              responsive: true,
              displayModeBar: false,
            }}
            style={{ width: "100%", minWidth: 350, background: "none" }}
            useResizeHandler={true}
          />
        )}
      </div>
    </div>
  );
}