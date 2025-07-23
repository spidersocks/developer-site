import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import styles from "./App.module.css";

// Color map matches your backend's lowercase 'news' and 'podcast'
const SOURCE_TYPE_COLORS = {
  podcast: "#fb923c", // orange
  news: "#6366f1",    // indigo
};
const DEFAULT_BAR_COLOR = "#a3a3a3";

// List of drillable topics
const DRILLABLE_TOPICS = [
  'Christianity', 'Protestantism', 'accident and emergency incident', 'agriculture', 'animal', 'armed conflict', 'armed forces', 'belief systems', 'biology', 'business financing', 'business information', 'business service', 'civil law', 'communicable disease', 'computing and information technology', 'conflict, war and peace', 'construction and property', 'consumer goods', 'corporate crime', 'court', 'crime', 'crime, law and justice', 'death and dying', 'diplomacy', 'disaster', 'disaster, accident and emergency incident', 'discrimination', 'disease and condition', 'economic trends and indicators', 'economy', 'economy, business and finance', 'education', 'election', 'employment', 'energy and resource', 'environment', 'environmental pollution', 'family', 'family planning', 'financial and business service', 'financial service', 'fundamental rights', 'government', 'government policy', 'health', 'health treatment and procedure', 'healthcare industry', 'international relations', 'international trade', 'judiciary', 'labor', 'labor relations', 'land resources', 'law', 'law enforcement', 'mankind', 'manufacturing and engineering', 'market and exchange', 'media and entertainment industry', 'medical profession', 'medical specialization', 'mental health', 'metal and mineral mining and refining', 'national security', 'natural disaster', 'natural resources', 'natural science', 'nature', 'political system', 'politics and government', 'process industry', 'products and services', 'religion', 'religious facilities', 'religious festival and holiday', 'retail', 'sales channel', 'school', 'science and technology', 'scientific research', 'sentencing (criminal)', 'social problem', 'social sciences', 'society', 'technology and engineering', 'tourism and leisure industry', 'transport', 'transportation accident and incident', 'trial (court)', 'utilities', 'values', 'wages and benefits', 'war', 'water', 'weather', 'welfare'
];

// Helper: Format backend data for Recharts
function groupDataByMedium(topics) {
  const topicMap = {};
  topics.forEach(({ label, source_type, proportion }) => {
    if (!topicMap[label]) topicMap[label] = { label };
    topicMap[label][source_type] = proportion;
  });
  return Object.values(topicMap);
}

function firstTwoWordsAndMore(str, maxLen = 24) {
  const words = str.trim().split(/\s+/);
  if (words.length === 1) return words[0];

  const first = words[0];
  const second = words[1].replace(/,$/, "");
  const restExists = words.length > 2;

  // If second word is "and", just use the first word
  if (second.toLowerCase() === "and") return restExists ? `${first} & more` : first;

  // If first + second exceeds maxLen, use only first
  const combined = `${first} ${second}`;
  if (combined.length > maxLen) return restExists ? `${first} & more` : first;

  // Otherwise, use both
  return restExists ? `${combined} & more` : combined;
}

// Estimate the width of a text string in px
function getTextWidth(text, font = "12px Arial") {
  if (typeof document === "undefined") return 0;
  const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  return context.measureText(text).width;
}

function toTitleCase(str) {
  const smallWords = /^(a|an|and|as|at|but|by|for|in|nor|of|on|or|so|the|to|up|yet)$/i;
  return str.replace(/\w\S*/g, function(txt, i, full) {
    if (
      i !== 0 &&
      i + txt.length !== full.length &&
      txt.match(smallWords)
    ) {
      return txt.toLowerCase();
    }
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function generateChartTitle(drillPath) {
  if (!drillPath || drillPath.length === 0) {
    return "Distribution of News Topics by Source";
  }
  if (drillPath.length  >= 1) {
    return `Distribution of ${toTitleCase(drillPath[drillPath.length - 1])} Topics by Source`;
  }
}

// Custom tooltip for 2-decimal percentages
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.customTooltip}>
        <div className={styles.customTooltipTitle}>{label}</div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ color: entry.color }}>
            {entry.name}: {(entry.value * 100).toFixed(2)}%
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PodcastProjectApp() {
  const [topics, setTopics] = useState([]);
  const [drillPath, setDrillPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const getAxisFontSize = () => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 600) return 11;
      if (window.innerWidth < 900) return 13;
    }
    return 14;
  };
  const [axisFontSize, setAxisFontSize] = useState(getAxisFontSize());

  useEffect(() => {
    const handleResize = () => setAxisFontSize(getAxisFontSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const PATH_SEPARATOR = "||";
      const pathParam = drillPath.length
        ? "?path=" + encodeURIComponent(drillPath.join(PATH_SEPARATOR))
        : "";
      const res = await fetch(
        `https://podcast-project-backend.onrender.com/api/topics/drilldown/${pathParam}`
      );
      const data = await res.json();
      setTopics(data.topics || []);
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line
  }, [drillPath]);

  const topicOptions = useMemo(
    () => Array.from(new Set(topics.map((t) => t.label).filter(Boolean))),
    [topics]
  );

  // Filter to only drillable topics
  const drillableOptions = useMemo(
    () => topicOptions.filter((label) => DRILLABLE_TOPICS.includes(label)),
    [topicOptions]
  );

  const handleDrilldown = (nextLabel) => {
    setDrillPath([...drillPath, nextLabel]);
  };

  const handleBreadcrumb = (idx) => {
    setDrillPath(drillPath.slice(0, idx + 1));
  };

  const handleBarClick = (data) => {
    const label = data.label;
    if (DRILLABLE_TOPICS.includes(label)) {
      setDrillPath([...drillPath, label]);
    }
  };

  const chartData = useMemo(() => groupDataByMedium(topics), [topics]);
  const sourceTypes = useMemo(
    () => Array.from(new Set(topics.map((t) => t.source_type))),
    [topics]
  );

  // --- Dynamic margin calculation ---
  // Prepare all formatted labels
  const formattedLabels = useMemo(
    () => chartData.map(item => firstTwoWordsAndMore(item.label, 17)),
    [chartData]
  );

  // Find max label width (in px)
  const maxLabelWidth = useMemo(() => {
    if (typeof window === "undefined" || formattedLabels.length === 0) return 90;
    return Math.max(
      ...formattedLabels.map(label => getTextWidth(label, "12px Arial"))
    );
  }, [formattedLabels]);

  // Since X labels are rotated -45deg, estimate the vertical height they take up
  // (so we can set bottom margin)
  const rotatedLabelHeight = useMemo(() => {
    return Math.ceil(maxLabelWidth * 0.7071 + 12 * 0.7071) + 8;
  }, [maxLabelWidth]);

  const leftMargin = Math.max(32, Math.ceil(maxLabelWidth * 0.8));
  const bottomMargin = Math.max(32, rotatedLabelHeight);

  // New: For axis label
  const broaderTopic = drillPath.length > 0 ? drillPath[drillPath.length - 1] : "news";

  return (
    <div className={styles.podcastAppRoot}>
      <div className={styles.mainCard}>
        <h1>Airwaves & Archives: Topic Distribution in Podcasts and Public News Media</h1>
        <h2>Explore topic distributions across podcasts and news.</h2>

        {/* Breadcrumbs */}
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <span
            className={styles.allTopicsLink}
            onClick={() => setDrillPath([])}
          >
            {drillPath.length === 0 ? "All Topics" : "Return to all topics"}
          </span>
          {drillPath.map((step, i) => (
            <React.Fragment key={i}>
              <span className={styles.sep}>&rsaquo;</span>
              <span
                style={{
                  color: i === drillPath.length - 1 ? "#3730a3" : "#6366f1",
                  fontWeight: i === drillPath.length - 1 ? 600 : 500,
                  cursor: "pointer"
                }}
                onClick={() => handleBreadcrumb(i)}
              >{step}</span>
            </React.Fragment>
          ))}
        </nav>

        {/* Dropdown for next subtopic */}
        {drillableOptions.length > 0 && (
          <div style={{ marginBottom: "1.5em" }}>
            <label style={{ marginRight: 10, color: "#64748b", fontWeight: 500 }}>
              {drillPath.length === 0 ? "Choose a topic:" : "Explore subtopics:"}
            </label>
            <select
              aria-label="Drilldown topic selection"
              className={styles.dropdown}
              value=""
              onChange={(e) => {
                if (e.target.value) handleDrilldown(e.target.value);
              }}
            >
              <option value="">-- Select --</option>
              {drillableOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        <h3 className={styles.chartTitle} style={{ marginTop: 0, marginBottom: "1em" }}>
          {generateChartTitle(drillPath)}
        </h3>

        {/* Chart is now fully contained within the white card */}
        <div className={styles.chartScrollWrapper}>
          <div
            className={styles.chartInner}
            style={{
              "--bar-count": chartData.length,
              minWidth: 500,
              width: Math.max(500, chartData.length * 80),
              maxWidth: "100%",
            }}
          >
            {loading ? (
              <div>
                <div className={styles.spinner} />
                <div style={{ textAlign: "center", color: "#64748b" }}>Loading chart…</div>
              </div>
            ) : chartData.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "2em" }}>
                No topics found.<br />
                <button onClick={() => setDrillPath([])} className={styles.button} style={{ marginTop: 16 }}>Back to top</button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={chartData}
                  barCategoryGap="15%"
                  barGap={2}
                  margin={{
                    top: 40,
                    right: 32,
                    left: leftMargin,
                    bottom: Math.max(105, bottomMargin),
                  }}
                >
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ top: 0 }} />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    type="category"
                    tick={({ x, y, payload }) => {
                      const label = firstTwoWordsAndMore(payload.value, 17);
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={20}
                          textAnchor="end"
                          fill="#64748b"
                          fontSize={13}
                          style={{
                            fontWeight: 500,
                            cursor: DRILLABLE_TOPICS.includes(payload.value) ? "pointer" : "default"
                          }}
                          transform={`rotate(-45, ${x}, ${y + 16})`}
                        >
                          <title>{payload.value}</title>
                          {label}
                        </text>
                      );
                    }}
                    label={{
                      value: `${toTitleCase(broaderTopic)} subtopics`,
                      position: "bottom",
                      offset: 90,
                      fontSize: axisFontSize,
                      fontWeight: 600,
                      fill: "#29292a",
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={[0, "auto"]}
                    tick={({ x, y, payload }) => (
                      <text
                        x={x - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={13}
                        fill="#64748b"
                      >
                        {(payload.value * 100).toFixed(0)}%
                      </text>
                    )}
                    width={60}
                    label={{
                      value: `Proportion of topics`,
                      angle: -90,
                      position: "insideLeft",
                      dx: -20,
                      fontSize: axisFontSize,
                      fontWeight: 600,
                      fill: "#29292a",
                    }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    offset={35}
                  />
                  {sourceTypes.map((src) => (
                    <Bar
                      key={src}
                      dataKey={src}
                      fill={SOURCE_TYPE_COLORS[src] || DEFAULT_BAR_COLOR}
                      onClick={handleBarClick}
                      cursor={({ payload }) => DRILLABLE_TOPICS.includes(payload.label) ? "pointer" : "default"}
                      isAnimationActive={true}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}