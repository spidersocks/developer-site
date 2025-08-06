import React from "react";
import ReactMarkdown from "react-markdown";
import styles from "./App.module.css";
import PodcastChart from "./PodcastChart";
import StanceChart from "./StanceChart";

// Markdown content for the blog post
const markdown = `
# Podcasting the News: Topic, Sentiment, and Stance in US Podcasts and Public News Media

*Sean Fontaine and Chelsea Simpson · July 2025 · UMSI Capstone*

## Introduction

- Podcasts have expanded in recent years to become an alternative (and largely unregulated) news and political information ecosystem in the US.
- We want to understand how the political news content presented in leading podcasts systematically differs from that presented in traditional public news outlets.
- Specifically, we look at topic distributions, and the cross-media-medium sentiment and stances associated with these topics.

## Methods

- Data consists of one year of full podcast transcripts from the top 50 US podcasts (as of Q1 2025), collected in parallel with one year of stories from public news sources (e.g., NPR, PBS).
- Documents are processed, chunked, and modeled using BERTopic to identify nuanced topics within our combined corpus.
- Found topics are filtered for relevance to news and politics, and are then manually given labels, referencing the Pew Research Center’s topic taxonomy.
- Sentiment analysis (using VADER) and stance detection (using Ministral-8-B with Chain of Stance prompting) will be performed on documents aggregated by media type and Pew-aligned news topic.

## Results

- We will produce a summary of which topics are covered proportionally more in podcasts vs traditional news media.
- We will present comparative sentiment scores for major topics, and discuss topics of most and least sentiment alignment.
- We will present and discuss key differences in stance distributions (i.e. favor / against / neutral) across topics and media types.
- We will also aggregate data temporally to track changes in topic prevalence, sentiment, and stance between months.
- Visualizations will include UMAP scatters (for topics), grouped diverging bar charts, heatmaps, tree maps and ridgeline plots (for sentiment / stance). Some visualizations will be interactive.

### Interactive: Explore Topic Distribution Across Podcasts and News

`;

const discussion = `
## Discussion

- Will include interpretation of findings, in particular key differences discovered across media types.
- Discussing implications of findings for both media scholars and the general public.
- Evaluating the reliability of topic / sentiment / stance labels.
- Acknowledgement of the exploratory nature of findings, meaning findings are limited to this data and time period only.
- Discussion of future directions for further research.
`;

export default function App() {
  return (
    <div className={styles.podcastAppRoot}>
      <article className={styles.mainCard} style={{ maxWidth: 820 }}>
        <div className={styles.blogContent}>
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
        {/* Interactive chart inserted after the Results section */}
        <PodcastChart />
        <div style={{ fontSize: "0.98rem", color: "#64748b", marginTop: "0.8rem" }}>
          Figure 1: Topic Distributions by Media Type.
        </div>
        <StanceChart />
        <div style={{ fontSize: "0.98rem", color: "#64748b", marginTop: "0.8rem" }}>
          Figure 2: Relative Stance by Topic and Source Type.
        </div>
        <div className={styles.blogContent}>
          <ReactMarkdown>{discussion}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}