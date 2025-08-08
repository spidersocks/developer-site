import React, { useEffect, useMemo, useState } from "react";
import SentimentWordcloud from "./Wordcloud";
import styles from "./PairedWordclouds.module.css";
import { topicMetaMap } from "./topicMetaMap";

// Capitalize every word (for People and Countries topics)
function capitalizeWords(str) {
  return str.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1));
}

const API_BASE = "https://podcast-project-backend.onrender.com";

// --- Helper for highlighting "All News"/"All Podcasts" ---
const highlightOptionStyle = {
  fontWeight: 'bold',
  background: '#f1f5f9',
  color: '#334155'
};

const isCountry = t =>
  /^topic_(united_states|israel|iran|united_kingdom|china|el_salvador|canada|mexico|russia|india|saudi_arabia|pakistan|taiwan|russia_ukraine|india_pakistan)$/.test(t);

const isPerson = t =>
  /^topic_(joe_biden|donald_trump|kamala_harris|bernie_sanders|elon_musk|mark_zuckerberg|robert_f._kennedy_jr|justin_trudeau|tim_cook|diddy|taylor_swift|taylor_swift_travis_kelce|vladimir_putin|volodymyr_zelensky|tim_walz|chuck_schumer|sam_altman|nancy_pelosi|kevin_mccarthy|ron_desantis|mike_johnson|jeff_bezos|jeffrey_epstein|pete_buttigieg|bob_menendez|alexandria_ocasio-cortez|kanye_west|ali_khamenei|claudia_sheinbaum|karoline_leavitt|luigi_mangione|mark_carney|caitlin_clark|pete_hegseth|benjamin_netanyahu|jd_vance)$/.test(t);

const newsStoryKeys = Object.entries(topicMetaMap)
  .filter(([key, val]) => val === "News Stories")
  .map(([key]) => key.replace(/^topic_/, ''))
  .map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

const isNewsStory = newsStoryKeys.length
  ? new RegExp(`^topic_(${newsStoryKeys.join('|')})$`)
  : null;

function isNewsStoryTopic(t) {
  return isNewsStory ? isNewsStory.test(t) : false;
}

function WordcloudWithSentiment({ sourceType, sourceName, topic }) {
  const [sentimentLabel, setSentimentLabel] = useState("Neutral");
  const [sentimentValue, setSentimentValue] = useState(0.0);

  useEffect(() => {
    if (!sourceType || !sourceName || !topic) return;
    const paramString = [
      `source_type=${encodeURIComponent(sourceType)}`,
      `source_name=${encodeURIComponent(sourceName)}`,
      `topic=${encodeURIComponent(topic)}`
    ].join("&");
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
          if (typeof json.data[0].avg_sentiment_score === "number") {
            setSentimentValue(json.data[0].avg_sentiment_score);
          } else {
            setSentimentValue(0.0);
          }
        } else {
          setSentimentLabel("Neutral");
          setSentimentValue(0.0);
        }
      });
  }, [sourceType, sourceName, topic]);

  return (
    <div style={{ width: "100%" }}>
      <SentimentWordcloud
        sourceType={sourceType}
        sourceName={sourceName}
        topic={topic}
        style={{ minWidth: 0, marginBottom: 0, marginLeft: "auto", marginRight: "auto" }}
      />
      <div style={{
        textAlign: "center",
        marginTop: "0.7em",
        color: "#475569",
        fontWeight: 500,
        fontSize: "1.01rem"
      }}>
        Sentiment: <span style={{
          color: sentimentValue >= 0.2 ? "#1a9850"
            : sentimentValue <= -0.2 ? "#d73027"
            : "#7a7a7a",
          fontWeight: 700
        }}>{sentimentValue.toFixed(2)} ({sentimentLabel})</span>
      </div>
    </div>
  );
}

export default function PairedWordclouds() {
  const [sources, setSources] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sourceA, setSourceA] = useState(null);
  const [sourceB, setSourceB] = useState(null);
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/wordcloud/options/`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const srcs = Array.isArray(json?.sources) ? json.sources : [];
        setSources(srcs);

        const allNews = srcs.find((s) => s.source_type === "news" && s.source_name === "news");
        const allPodcasts = srcs.find((s) => s.source_type === "podcast" && s.source_name === "podcast");

        if (!sourceA && allNews) setSourceA(allNews);
        if (!sourceB && allPodcasts) setSourceB(allPodcasts);
      })
      .catch(() => {
        setSources([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sourceA || !sourceB) {
      setTopics([]);
      setTopic(null);
      return;
    }
    fetch(
      `${API_BASE}/api/wordcloud/common_topics/`
      + `?left_source_type=${encodeURIComponent(sourceA.source_type)}`
      + `&left_source_name=${encodeURIComponent(sourceA.source_name)}`
      + `&right_source_type=${encodeURIComponent(sourceB.source_type)}`
      + `&right_source_name=${encodeURIComponent(sourceB.source_name)}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json?.topics) && json.topics.length > 0) {
          setTopics(json.topics);
          if (!json.topics.find((t) => t.key === topic)) {
            setTopic(json.topics[0].key);
          }
        } else {
          setTopics([]);
          setTopic(null);
        }
      });
  }, [sourceA, sourceB]);

  const sourceOptions = useMemo(() => {
    const allNews = sources.filter(s => s.source_type === "news" && s.source_name === "news")
      .map(s => ({...s, display: "All News", isAll: true}));
    const news = sources.filter(s => s.source_type === "news" && s.source_name !== "news")
      .map(s => ({...s, display: s.source_name, isAll: false}))
      .sort((a, b) => a.source_name.localeCompare(b.source_name));

    const allPodcasts = sources.filter(s => s.source_type === "podcast" && s.source_name === "podcast")
      .map(s => ({...s, display: "All Podcasts", isAll: true}));
    const podcasts = sources.filter(s => s.source_type === "podcast" && s.source_name !== "podcast")
      .map(s => ({...s, display: s.source_name, isAll: false}))
      .sort((a, b) => a.source_name.localeCompare(b.source_name));

    return [
      ...allNews,
      ...news,
      ...allPodcasts,
      ...podcasts
    ];
  }, [sources]);

  const encode = (s) => `${s.source_type}:::${s.source_name}`;
  const decode = (v) => {
    const [source_type, source_name] = String(v).split(":::");
    return { source_type, source_name };
  };

  // --- Group topics: Countries, People, News Stories, then meta-topics, then Other ---
  const groupedTopics = useMemo(() => {
    const allTopics = topics.find(t => t.key === "all_topics")
      ? [{ key: "all_topics", label: "All Topics" }]
      : [];

    const groups = {};
    for (const t of topics) {
      if (t.key === "all_topics") continue;
      let meta;
      if (isCountry(t.key)) meta = "Countries";
      else if (isPerson(t.key)) meta = "People";
      else if (isNewsStoryTopic(t.key)) meta = "News Stories";
      else meta = topicMetaMap[t.key] || "Other";
      if (!groups[meta]) groups[meta] = [];
      // Capitalize for people/countries
      let label = t.label;
      if (meta === "Countries" || meta === "People") {
        label = capitalizeWords(label);
      }
      groups[meta].push({ ...t, label });
    }

    const specialOrder = ["Countries", "People", "News Stories"];
    const metaOrder = [
      ...specialOrder.filter(meta => groups[meta]),
      ...Object.keys(groups)
        .filter(meta => !specialOrder.includes(meta) && meta !== "Other")
        .sort(),
      ...(groups["Other"] ? ["Other"] : []),
    ];

    return [
      ...allTopics,
      ...metaOrder.map(meta => ({
        meta,
        topics: groups[meta].sort((a, b) => a.label.localeCompare(b.label)),
        isSpecial: specialOrder.includes(meta),
      })),
    ];
  }, [topics]);

  // --- Get display names for meta-title ---
  function getDisplaySourceName(source) {
    if (!source) return "…";
    if (source.source_type === "news" && source.source_name === "news") return "All News";
    if (source.source_type === "podcast" && source.source_name === "podcast") return "All Podcasts";
    return source.source_name;
  }

  const sourceAName = getDisplaySourceName(sourceA);
  const sourceBName = getDisplaySourceName(sourceB);

  // Find the topic label, and capitalize if People or Countries
  let topicLabel = topic;
  for (const group of groupedTopics) {
    const found = (group.topics || [group]).find(t => t.key === topic);
    if (found) {
      topicLabel = found.label;
      break;
    }
  }

  return (
    <div style={{ width: "100%", marginTop: 48 }}>
      <h3
        style={{
          marginTop: 0,
          marginBottom: 0,
          fontWeight: 700,
          color: "#29292a",
          fontSize: "clamp(1.05rem, 2vw + 1rem, 1.6rem)",
          lineHeight: 1.15,
        }}
      >
        Sentiment WordClouds for {sourceAName} and {sourceBName} on Topic {topicLabel}
      </h3>
      <div style={{ color: "#64748b", fontSize: "1.05rem", marginBottom: 8, marginTop: 2 }}>
        Top 10 words by in-topic TF-IDF, colored by sentiment.
      </div>

      {/* Paired clouds */}
      <div className={styles.pairedWrapper}>
        <div className={styles.wordcloudCol} style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
          {topic && sourceA ? (
            <>
              <WordcloudWithSentiment
                sourceType={sourceA.source_type}
                sourceName={sourceA.source_name}
                topic={topic}
              />
              <div style={{
                marginTop: "0.8em",
                width: "100%",
                display: "flex",
                justifyContent: "center"
              }}>
                <span style={{
                  color: "#64748b",
                  fontSize: "1.05rem",
                  fontWeight: 500,
                  marginRight: 7,
                  minWidth: "fit-content"
                }}>
                  Source A:
                </span>
                <select
                  id="sourceA"
                  className={styles.select}
                  value={sourceA ? encode(sourceA) : ""}
                  onChange={(e) => setSourceA(decode(e.target.value))}
                  disabled={sourceOptions.length === 0}
                  style={{minWidth: 120, maxWidth: 220}}
                >
                  {sourceOptions.map((s) => (
                    <option
                      key={encode(s)}
                      value={encode(s)}
                      style={s.isAll ? highlightOptionStyle : {}}
                    >
                      {s.display}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div style={{ padding: "2em", textAlign: "center", color: "#64748b" }}>
              No topics in common for these sources.
            </div>
          )}
        </div>
        <div className={styles.wordcloudCol} style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
          {topic && sourceB ? (
            <>
              <WordcloudWithSentiment
                sourceType={sourceB.source_type}
                sourceName={sourceB.source_name}
                topic={topic}
              />
              <div style={{
                marginTop: "0.8em",
                width: "100%",
                display: "flex",
                justifyContent: "center"
              }}>
                <span style={{
                  color: "#64748b",
                  fontSize: "1.05rem",
                  fontWeight: 500,
                  marginRight: 7,
                  minWidth: "fit-content"
                }}>
                  Source B:
                </span>
                <select
                  id="sourceB"
                  className={styles.select}
                  value={sourceB ? encode(sourceB) : ""}
                  onChange={(e) => setSourceB(decode(e.target.value))}
                  disabled={sourceOptions.length === 0}
                  style={{minWidth: 120, maxWidth: 220}}
                >
                  {sourceOptions.map((s) => (
                    <option
                      key={encode(s)}
                      value={encode(s)}
                      style={s.isAll ? highlightOptionStyle : {}}
                    >
                      {s.display}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div style={{ padding: "2em", textAlign: "center", color: "#64748b" }}>
              No topics in common for these sources.
            </div>
          )}
        </div>
      </div>

      {/* Topic dropdown centered below both sources */}
      <div style={{
        marginTop: "1em",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <span style={{
          color: "#64748b",
          fontSize: "1.05rem",
          fontWeight: 500,
          marginRight: 7,
          minWidth: "fit-content"
        }}>
          Topic:
        </span>
        <select
          id="topic"
          className={styles.select}
          value={topic || ""}
          onChange={e => setTopic(e.target.value)}
          disabled={groupedTopics.length === 0}
          style={{minWidth: 120, maxWidth: 240}}
        >
          {groupedTopics.map(group =>
            group.key ? (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ) : (
              <optgroup
                key={group.meta}
                label={group.meta}
                style={group.isSpecial ? { fontWeight: "bold", color: "#475569" } : {}}
              >
                {group.topics.map(t => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )
          )}
        </select>
      </div>
    </div>
  );
}