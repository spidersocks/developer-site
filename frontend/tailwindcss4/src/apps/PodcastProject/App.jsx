// App.jsx
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import styles from "./App.module.css";
import PodcastChart from "./PodcastChart";
import StanceChart from "./StanceChart";
import PairedWordclouds from "./PairedWordclouds";

// Error boundary for nicer failures
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Optional: log to your service
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ color: "#dc2626", padding: "1rem" }}>Couldn’t load this view.</div>
      );
    }
    return this.props.children;
  }
}

/*
 We split the report into multiple Markdown constants so we can inject the
 figures (Figure 1 image, Figure 2/3/4 interactive charts) exactly where the
 document places them, and to allow JSX for styling that must bypass CSS Modules.
*/

// Title only (so we can inject a styled subtitle via JSX)
const mdTitle = `
# Podcasting the News – A Topic, Sentiment, and Stance Analysis of U.S. Podcasts and Public News Media
`;

// Intro split: Part 1 before the a)/b) lines; Part 2 after them
const mdIntroPart1 = `
## 1. Introduction

The digital age has profoundly changed the way in which individuals consume news content. Formerly the exclusive domain of traditional publishers, the past two decades have seen alternative digital media occupy a rapidly expanding portion of the contemporary news media environment. While the rise of news on social media is well studied, podcasts as emerging sources of news information and commentary are less well understood. Podcasts have recently overtaken newspapers as a source of news amongst American consumers ([Newman, 2025](#ref-newman-2025)); over 50% of Americans listen regularly, and 87% of listeners say they trust their podcast’s news content ([Pew Research Center, 2023](#ref-pew-2023)).

This project investigates the central question:

*In what ways does the news content presented in popular podcasts systematically differ from that produced by traditional public broadcasters?*

In answering this question, we look at:
`;

const mdIntroPart2 = `
Through this study, we aim to provide an evidence-based understanding of the role that podcasts play in the modern information landscape.
`;

// Related Work
const mdRelated = `
## 2. Related Work

The recent rise of podcasts as primary news sources ([Newman, 2025](#ref-newman-2025); [Pew Research Center, 2023](#ref-pew-2023)) has left scholarly analyses of their news content underdeveloped. Existing research on political podcasts tends to focus on more granular podcast messaging dynamics rather than larger-scale analyses of podcast content. A leading study of this type by DeMets and Spiro (2025), *Podcasts in the periphery: Tracing guest trajectories in political podcasts*, uses network analysis (i.e., network centrality; Louvain methods for communities) to map how guests on podcasts influence messaging on political and top polarizing issues. Our study expands on current research by shifting the focus from messenger to the messaging itself by analyzing topics, sentiment, stances, and framing within the wider podcast-news information ecosystem.

Our methods are grounded in established techniques for analyzing news media content. Sentiment analysis is commonly used in media studies as a metric to inform analysis of framing and tone. We build on the sentiment analysis approach taken by [Yu & Yang (2024)](#ref-yu-yang-2024), whose study uses sentiment as a metric to understand coverage of economic topics during the COVID-19 pandemic. To understand what is being discussed, we use BERTopic ([Grootendorst, 2022](#ref-grootendorst-2022)), a leading topic modeling technique that leverages embeddings to generate more context-aware and interpretable topics. Furthermore, to understand how topics are being discussed, we draw on a novel Chain of Stance (CoS) framework ([Ma et al., 2024](#ref-ma-2024)), an LLM-based prompting method that has recently outperformed leading stance detection models on SemEval-2016, a benchmark stance detection dataset.

By greatly extending the scope of existing research and combining state-of-the-art media research techniques, our study offers a new and far more comprehensive view into the podcast-news information ecosystem.
`;

// Methods – 3.1 Data + 3.2 Topic Modeling
const mdMethods_31_32 = `
## 3. Methodology

### 3.1 Data

We compiled a complete corpus of all content produced over the calendar year from July 1, 2024–July 1, 2025 by leading podcasts and public news outlets.

**Podcasts:** We select all podcasts in the Top 50 most-listened-to podcasts in the United States ([Edison Research, 2025](#ref-edison-2025)) during Q1 of 2025, excluding those affiliated with a traditional news outlet like *The Daily*, by *The New York Times* (see Appendix A). Transcripts are downloaded from [PodScribe](#ref-podscribe) (transcription using [Google Cloud’s Speech-to-Text](#ref-google-stt)) with timestamps and speaker tags removed.

**Public News Sources:** To serve as a ground comparison for our podcasts, we select NPR and PBS, the two largest public broadcasters in the United States. Articles are scraped and HTML parsed from the archive of each site ([NPR, 2025](#ref-npr-2025); [PBS, 2025](#ref-pbs-2025)).

The assembled dataset contains 8,344 podcast transcripts from 40 publishers, and 17,435 news articles from PBS and NPR.

### 3.2 Topic Modeling

To gain an understanding of what is being talked about in our corpus, we employ topic modeling, an unsupervised machine learning method that extracts core topics within a source using clusters of words and phrases that tend to co-occur. We do this with BERTopic ([Grootendorst, 2022](#ref-grootendorst-2022)), an embeddings-based approach that accounts for the context of words as well as raw frequencies to generate more sophisticated human-interpretable topics. Prior to modeling, corpus documents are split into chunks (of approx. 300 words) to allow the model to focus on smaller, more cohesive units of information. Results of modeling are 402,415 chunks assigned to 3,232 unique topics based on semantic similarity.
`;

// Methods – 3.3 Topic Labeling (text before and after Figure 1)
const mdMethods_33_beforeFig1 = `
### 3.3 Topic Labeling

Next, we label all found topics. Labels are assigned using the International Press Telecommunications Council’s ([IPTC, 2025](#ref-iptc-2025)) Media Topics, a standardized, hierarchical, and widely used media classification schema. This assignment is done by transforming IPTC topic labels and descriptions into embeddings using our BERTopic model’s transformer, and matching by highest cosine similarity. All topics are then human reviewed for accuracy, and changed when needed.
`;

const mdMethods_33_afterFig1 = `
An alternative labeling schema is also applied to identify specific named entities (i.e., people, countries, and events). This is applied to chunks using simple string matching in a non-mutually exclusive manner.

The result of this is 1 hierarchically grounded IPTC media topic and up to 46 named entity topics for each of our 402,415 chunks.
`;

// Methods – 3.4 and 3.5
const mdMethods_34_35 = `
### 3.4 Stance Detection

Stance detection is carried out using the Chain of Stance (CoS) prompting method ([Ma et al., 2024](#ref-ma-2024)). The method sequentially guides an LLM through six logical steps, gathering information and evidence about context, main idea, and tone before outputting a stance determination (see Appendix B for prompting details).

To implement this, the corpus is first filtered to 70 topics relevant to stance labeling (Appendix C). Inferences are then run on each document–topic pair in batches of 16 using an open-source LLM hosted on an AWS EC2 G5.xlarge instance. As Mistral models are open-source and have achieved top results in leading stance-detection research ([Ma et al., 2024](#ref-ma-2024)), we use Ministral-8B-Instruct-2410 ([Mistral AI, 2025](#ref-mistral-2025)), Mistral's newest and most powerful model under 10B.

The results of this process are 297,611 individual stance determinations (FAVOR, AGAINST, NONE). Outputs are encoded as both single-word strings and as numbers (1, -1, and 0) for plotting. Full model outputs for each stance are additionally logged for interpretability.

### 3.5 Sentiment Detection

Sentiment analysis is performed using two methods for comparison. We use the TextBlob and VADER (Valence Aware Dictionary and sEntiment Reasoner) libraries.

- **TextBlob:** rule-based approach using pre-determined lexicon to assign scores, chosen for our data because this approach returns sentiment and subjectivity scores and is a good general tool for most document types. Sentiment returns scores from -1 to 1 and subjectivity scores from 0 to 1.
- **VADER:** rule-based approach, specifically for social media texts, using pre-determined lexicon to assign scores, chosen for our data because this tool can capture emojis, slang and common social media word expressions. Sentiment scores are determined by a valence score from -4 to 4. The valence score includes positive, negative, neutral and compound scores with the compound score the overall sentiment score.

We set the sentiment thresholds to be the same for both models, < -0.5 for negative, > 0.5 for positive and used the compound score for the VADER model.
`;

// Analysis – 4.1 before and after Figure 2
const mdAnalysis_41_beforeFig2 = `
## 4. Analysis

### 4.1 Topic Distribution Analysis
`;

const mdAnalysis_41_afterFig2 = `
Overall, podcasts tend to under-cover hard news (e.g. war, public health, climate) in favor of personality-driven politics, crime & security, and content related to culture and values. Public news, on the other hand, dedicates more space to coverage of institutions and policy.

- **War and conflict:** 15% of public news vs 4% of podcasts.
- **Elections:** Podcasts tend to cover candidates (68%) over procedures (8%). Public news allocates proportionally more coverage to process (32%). Podcasts focus on national races (13% vs 1% state), while public news is more balanced (6% national, 9% state).
- **Government and policy:** Podcasts emphasize national security (65% vs 20%). Public news focuses on a greater range of policy issues like healthcare (15% vs 2%) and immigration policy (16% vs 8%).
- **Crime, law, and justice:** Podcasts center on crime incidents (64% vs 43%), especially headline homicide cases (24% vs 10%). Public news features more routine judiciary coverage (40%), and a wider range of crime issues like drug and cyber crime.
- **Society, values, rights:** Podcasts give more space than public news to niche societal topics like men (16% vs. < 1%), sexual behavior (49% vs. < 8%), discrimination (7% vs 1%), and free speech/censorship.
- **Health and environment:** Public news emphasizes communicable disease (69% vs 5%), while podcasts stress mental health (40%). Climate, resources, and sustainability topics are all more prominent in public news (42% vs 14%).
- **Family:** In topics of family, news tends to cover family planning (72% vs 20%). Podcasts tend to cover dating & relationships (39% vs 2%).

To summarize, while both public news and podcasts contain substantial news content, podcasts seem to favor vivid incidents, personalities, and culture topics; public broadcasters cover a broader range of procedural, institutional, and policy-centered topics.
`;

// Analysis – 4.2 with Figure 3 and formatted labels
const mdAnalysis_42_beforeFig3 = `
### 4.2 Stance Analysis
`;

const mdAnalysis_42_afterFig3 = `
We analyze three topic groups: people, countries, and political issues.

Note that reported stance scores use a FAVOR = 1, NONE = 0, and AGAINST = -1 encoding method. Reported correlations are weighted by topic Ns.

**People:**

<u>Alignment:</u> r = 0.74 (high). Both mediums cover basketball star Caitlin Clark most favorably, followed by the Pope. Sex offender Jeffrey Epstein is least favorable across both. Key political figures Donald Trump, Benjamin Netanyahu, and Elon Musk show minimal variation in average stance score by medium.

<u>Bias:</u> Compared to public news, podcasts tend, on average, to cover named public figures less favorably overall (negative mean Δ).

<u>People covered more favorably in podcasts:</u>
- The Trump cabinet – Robert F. Kennedy Jr (Δ = +0.20), Pete Hegseth (+0.16).
- Controversial figures – Diddy (Δ = +0.30), Luigi Mangione (+0.17), Bob Menendez (+0.15), Kanye West (+0.15).

<u>People covered less favorably in podcasts:</u>
- Democratic politicians – Kamala Harris (Δ = −0.45), Nancy Pelosi (−0.47), Joe Biden (−0.38), Pete Buttigieg (−0.36), AOC (−0.33), Tim Walz (−0.33), Bernie Sanders (−0.34).
- Foreign leaders – Xi Jinping (Δ = −0.45), Mark Carney (−0.19), Vladimir Putin (−0.14), Volodymyr Zelensky (−0.16).

**Countries:**

<u>Alignment:</u> r = 0.56 (moderate). El Salvador and India have most favorable stance scores overall across mediums. Pakistan (news) and Iran (podcasts) are least favorable by source.

<u>Bias:</u> Slightly more favorable coverage of countries in podcasts overall.

<u>Biggest differences:</u> Israel (Δ = +0.29) is covered much more favorably in podcasts, as is Taiwan (Δ = +0.14).

**Political Issues:**

<u>Alignment:</u> r = 0.15 (weak – showing largest divergence). Despite this, nuclear power is the topic viewed most favorably across mediums, and average stances on tariffs, immigration, and police show minimal stance score variation.

<u>Issues covered more favorably in podcasts:</u> Racism (Δ = +0.31), nuclear power (+0.20), abortion (+0.17), climate change (+0.13), war (+0.10).

Note: for topics like “racism”, while a negative stance reflects opposition, “less negative” in podcasts does not necessarily imply support.

<u>Issues covered less favorably in podcasts:</u> Euthanasia (Δ = −0.53), capital punishment (−0.43), communism (−0.39), Democratic Party (−0.27), military service (−0.21).
`;

// Analysis – 4.3 with Figure 4
const mdAnalysis_43_beforeFig4 = `
### 4.3 Framing Analysis

**Differences in framing.** Analysis of common words used across news topics shows that podcasts tend to emphasize people and lived experiences over news, which tends to emphasize institutions and officials. This is evidenced in top words: podcasts tilt to “people, time, money, apple, school, women, work, years”, while news tilts to “trump, president, federal, administration, government, state, health.”
`;

const mdAnalysis_43_afterFig4 = `
**Which podcasts are most similar to news?**

- **Agenda overlap:** Of all podcasts, political podcasts have the highest agenda overlap with traditional news sources. Of NPR’s 429 news topics, The Breakfast Club (310 shared topics), Ben Shapiro (307), Joe Rogan (295), Megyn Kelly (294), MeidasTouch (279) have the greatest alignment.
- **Lexical overlap:** Political podcasts also tend to use the most similar vocabulary to traditional news as measured by median Jaccard similarity of top 20 TF-IDF words by topic. Top podcasts are Ben Shapiro (0.103), Pod Save America (0.096), MeidasTouch (0.094), Megyn Kelly (0.071).
- **Tone alignment:** Tone alignment by per-topic sentiment correlation is moderate for left-leaning political shows (Pod Save America 0.355, MeidasTouch 0.361), but much lower for right leaning shows like Ben Shapiro (0.185). Comedy shows are the least aligned (Bad Friends −0.049; Smartless 0.069).

**Consensus gaps.** Overall, topics where many podcasts trend more positive than news skew towards lifestyle and behavior (e.g., sexual_behavior – 66% of podcasts more positive, mean Δ vs NPR +0.08).

Note: Most positive topics in podcasts are typically consumer / lifestyle topics (clothing, grocery, toys/games, streaming, health/beauty), suggesting noise in the data, some of which is likely sponsored advertiser content.
`;

// Discussion
const mdDiscussion = `
## 5. Discussion

### 5.1 Summary of Key Patterns

Over the course of a full year of content from podcasts and public news, we observe consistent systemic differences in the ways in which news is covered. Notably, podcasts allocate more space to personalities, vivid incidents, and discussion of culture and values. Public news focuses more on institutions, policy, and process. From stance analysis, we see that cross-medium alignment is strongest when discussing people, moderate when discussing countries, and weakest for political issues – a decrease as topics move from named individuals to more contested policy issues. Framing differences are reflected mainly in vocabulary, with podcasts describing more people and lived experiences, and public news centering more public officials and institutions.

### 5.2 Implications

<u>For news audiences:</u>
- Choice of news medium matters, and can present the same news topics through different lenses. In particular, our finding of weak stance alignment for more contested political issues suggest that different mediums are likely to present diverging frames, even when tone and topic are similar.

<u>For news producers:</u>
- Podcasts’ interweaving of news topics with coverage of people, lived-experience, and culture show that while covering similar topics, they occupy the news landscape in very different ways. Traditional news still remains an anchor for “hard” process and policy content, and serves as a useful counterbalance for the more personal and incident-driven cycles of new media.

<u>For researchers:</u>
- Results show the value a multifaceted approach (including topic modeling, sentiment analysis, stance detection, and framing) can bring to the understanding of a large text corpus.

### 5.3 Limitations

This study and its findings are exploratory in nature. We analyze only data from the calendar year July 1, 2024 – July 1, 2025, focus on only top U.S. podcasts and two public news outlets, and rely on largely automated labeling of topics, stance, sentiment, and framing. While we are careful to apply quality controls and manual review, several forms of noise and misclassification are likely still present (detailed in Section 6). We stress that results apply only to the podcasts and time period study, and that result magnitudes expressed in the paper are best interpreted as directional trends rather than exact point values.
`;

// References with anchors for internal jumps
const mdReferences = `
## References

<a id="ref-cpb"></a> Corporation for Public Broadcasting. (n.d.). About CPB. Retrieved August 14, 2025, from [https://cpb.org/aboutcpb](https://cpb.org/aboutcpb)

<a id="ref-demets-2025"></a> DeMets, S., & Spiro, E. (2025). Podcasts in the periphery: Tracing guest trajectories in political podcasts. *Social Networks, 82*, 65–79. [https://doi.org/10.1016/j.socnet.2025.01.001](https://doi.org/10.1016/j.socnet.2025.01.001)

<a id="ref-edison-2025"></a> Edison Research. (2025, May 2). The top 50 podcasts in the U.S. for Q1 2025 from Edison Podcast Metrics. [https://www.edisonresearch.com/the-top-50-podcasts-in-the-u-s-for-q1-2025-from-edison-podcast-metrics/](https://www.edisonresearch.com/the-top-50-podcasts-in-the-u-s-for-q1-2025-from-edison-podcast-metrics/)

<a id="ref-ferret-2016"></a> Ferret, O., Déjean, H., & Nioche, J. (2016). Knowledge-based Information Extraction from a Large-scale Text Corpus for Geopolitical Crisis Assessment. In *Proceedings of KONVENS 2016* (pp. 65–71). Bochumer Linguistische Arbeitsberichte. [https://aclanthology.org/W16-1306.pdf](https://aclanthology.org/W16-1306.pdf)

<a id="ref-google-stt"></a> Google. (n.d.). Speech-to-Text: AI speech recognition and transcription. Google Cloud. Retrieved August 14, 2025, from [https://cloud.google.com/speech-to-text](https://cloud.google.com/speech-to-text)

<a id="ref-grootendorst-2022"></a> Grootendorst, M. (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure (arXiv:2203.05794). *arXiv*. [https://arxiv.org/abs/2203.05794](https://arxiv.org/abs/2203.05794)

<a id="ref-hutto-2014"></a> Hutto, C. J., & Gilbert, E. E. (2014). VADER: A parsimonious rule-based model for sentiment analysis of social media text. In *Proceedings of ICWSM-14*. The AAAI Press.

<a id="ref-iptc-2025"></a> International Press Telecommunications Council. (2025, August 13). Media Topics (en-US)–IPTC NewsCodes controlled vocabularies. [https://www.iptc.org/std/NewsCodes/treeview/mediatopic/mediatopic-en-US.html](https://www.iptc.org/std/NewsCodes/treeview/mediatopic/mediatopic-en-US.html)

<a id="ref-loria-2018"></a> Loria, S. (2018). TextBlob documentation (Release 0.15.2). [https://textblob.readthedocs.io/en/dev/](https://textblob.readthedocs.io/en/dev/)

<a id="ref-ma-2024"></a> Ma, J., Wang, C., Xing, H., Zhao, D., & Zhang, Y. (2024). Chain of Stance: Stance Detection with Large Language Models (arXiv:2408.04649). *arXiv*. [https://arxiv.org/abs/2408.04649](https://arxiv.org/abs/2408.04649)

<a id="ref-mistral-2025"></a> Mistral AI. (2025). Ministral-8B-Instruct-2410 [Large language model]. Hugging Face. [https://huggingface.co/mistralai/Ministral-8B-Instruct-2410](https://huggingface.co/mistralai/Ministral-8B-Instruct-2410)

<a id="ref-newman-2025"></a> Newman, N. (2025, June 17). Overview and key findings of the 2025 Digital News Report. Reuters Institute for the Study of Journalism. [https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/dnr-executive-summary](https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2025/dnr-executive-summary)

<a id="ref-npr-2025"></a> NPR. (2025). News. Retrieved August 14, 2025, from [https://www.npr.org/sections/news/](https://www.npr.org/sections/news/)

<a id="ref-pbs-2025"></a> PBS. (2025). PBS News. Retrieved August 14, 2025, from [https://www.pbs.org/newshour/](https://www.pbs.org/newshour/)

<a id="ref-pew-2023"></a> Pew Research Center. (2023, April 18). Podcasts as a source of news and information. [https://www.pewresearch.org/journalism/2023/04/18/podcasts-as-a-source-of-news-and-information/](https://www.pewresearch.org/journalism/2023/04/18/podcasts-as-a-source-of-news-and-information/)

<a id="ref-pedregosa-2011"></a> Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos, A., Cournapeau, D., Brucher, M., Perrot, M., & Duchesnay, E. (2011). Scikit-learn: Machine learning in Python. *The Journal of Machine Learning Research, 12*, 2825–2830.

<a id="ref-podscribe"></a> PodScribe. (n.d.). Transcripts of the most popular podcasts. [https://podscribe.app/](https://podscribe.app/)

<a id="ref-rudnik-2019"></a> Rudnik, C., Ehrhart, T., Ferret, O., Teyssou, D., Troncy, R., & Tannier, X. (2019). Searching news articles using an event knowledge graph leveraged by Wikidata. In *Companion Proceedings of the 2019 World Wide Web Conference (WWW ’19 Companion)* (pp. 957–964). ACM. [https://doi.org/10.1145/3308560.3316761](https://doi.org/10.1145/3308560.3316761)

<a id="ref-yu-yang-2024"></a> Yu, L., & Yang, L. (2024). News media in crisis: A sentiment and emotion analysis of US news articles on unemployment in the COVID-19 pandemic. *Humanities and Social Sciences Communications, 11*(1), Article 854. [https://doi.org/10.1057/s41599-024-03225-9](https://doi.org/10.1057/s41599-024-03225-9)
`;

// Pages (Dashboard embeds figures at exact positions)
function DashboardPage() {
  return (
    <article className={styles.mainCard} style={{ maxWidth: 900 }}>
      <div className={styles.blogContent}>
        {/* Title */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdTitle}</ReactMarkdown>

        {/* Styled subtitle (kicker) */}
        <p className={styles.kicker}>SIADS 699 Capstone Project Final Report by Sean Fontaine & Chelsea Simpson</p>

        {/* Collage image above the Introduction heading */}
        <img
          src="https://seanfontaine.dev/collage.png"
          alt="Project collage"
          loading="lazy"
        />

        {/* Introduction (part 1) */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdIntroPart1}</ReactMarkdown>

        {/* Indented a) b) lines via JSX */}
        <div style={{ marginLeft: "1.5em" }}>
          <p>a) What topics are being talked about and how do topic distributions vary across mediums?</p>
          <p>b) How do stances, sentiments, and framings of key topics compare across mediums?</p>
        </div>

        {/* Intro (part 2) */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdIntroPart2}</ReactMarkdown>

        {/* Related Work */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdRelated}</ReactMarkdown>

        {/* Methods */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdMethods_31_32}</ReactMarkdown>

        {/* 3.3 Topic Labeling – before Figure 1 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdMethods_33_beforeFig1}</ReactMarkdown>

        {/* Figure 1: Static image as in the document */}
        <img
          src="https://seanfontaine.dev/iptc_media_topics_flowchart.jpg"
          alt="Excerpt of the IPTC Media Topics taxonomy"
          loading="lazy"
        />
        <div className={styles.figureCaption}>
          Figure 1: Excerpt of the IPTC Media Topics taxonomy (reproduced from Rudnik et al., 2019, Figure 3).
        </div>

        {/* 3.3 Topic Labeling – after Figure 1 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdMethods_33_afterFig1}</ReactMarkdown>

        {/* 3.4 and 3.5 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdMethods_34_35}</ReactMarkdown>

        {/* 4.1 Topic Distribution Analysis – heading before Figure 2 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_41_beforeFig2}</ReactMarkdown>
      </div>

      {/* Figure 2: Interactive topic distributions in-place with exact caption */}
      <div className={styles.chartScrollWrapper}>
        <PodcastChart />
      </div>
      <div className={styles.figureCaption}>
        Figure 2: The above interactive paired bar chart shows IPTC topic distributions for key news topics across news and podcast mediums. The initial chart displays the highest-level topics, and the height of each bar represents the overall proportion of content dedicated to that topic by medium. Each topic can be drilled down to view a distribution of its constituent subtopics.
      </div>

      <div className={styles.blogContent}>
        {/* 4.1 text after Figure 2 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_41_afterFig2}</ReactMarkdown>

        {/* 4.2 Stance Analysis – heading before Figure 3 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_42_beforeFig3}</ReactMarkdown>
      </div>

      {/* Figure 3: Relative stance in-place with exact caption */}
      <div className={styles.chartScrollWrapper}>
        <StanceChart />
      </div>
      <div className={styles.figureCaption}>
        Figure 3: Interactive paired dot plot shows key news topics and relative stance scores (z-standardized) by medium. Dot color represents podcasts vs public news, and dot position represents relative stance. Line color indicates which source is more favorable, and line intensity shows the size of the gap. Rows are sorted in ascending order by Δ, where Δ is equal to mean_podcast minus mean_news (Δ &gt; 0: podcasts more favorable).
      </div>

      <div className={styles.blogContent}>
        {/* 4.2 text after Figure 3 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_42_afterFig3}</ReactMarkdown>

        {/* 4.3 Framing Analysis – text before Figure 4 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_43_beforeFig4}</ReactMarkdown>
      </div>

      {/* Figure 4: Paired word clouds in-place with exact caption */}
      <div className={styles.chartScrollWrapper}>
        <PairedWordclouds />
      </div>
      <div className={styles.figureCaption}>
        Figure 4: Interactive paired sentiment word cloud showing top 10 words by in-topic TF-IDF from two sources on a given topic. Color gradient represents sentiment (negative = red, neutral = gray, positive = green).
      </div>

      <div className={styles.blogContent}>
        {/* 4.3 text after Figure 4 */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdAnalysis_43_afterFig4}</ReactMarkdown>

        {/* 5. Discussion */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdDiscussion}</ReactMarkdown>

        {/* References with anchors for in-text jumps */}
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{mdReferences}</ReactMarkdown>
      </div>
    </article>
  );
}

function TopicsPage() {
  return (
    <article className={styles.mainCard}>
      <div className={styles.chartScrollWrapper}>
        <PodcastChart />
      </div>
      <div className={styles.figureCaption}>
        Figure 2: The above interactive paired bar chart shows IPTC topic distributions for key news topics across news and podcast mediums. The initial chart displays the highest-level topics, and the height of each bar represents the overall proportion of content dedicated to that topic by medium. Each topic can be drilled down to view a distribution of its constituent subtopics.
      </div>
    </article>
  );
}

function StancePage() {
  return (
    <article className={styles.mainCard}>
      <div className={styles.chartScrollWrapper}>
        <StanceChart />
      </div>
      <div className={styles.figureCaption}>
        Figure 3: Interactive paired dot plot shows key news topics and relative stance scores (z-standardized) by medium. Dot color represents podcasts vs public news, and dot position represents relative stance. Line color indicates which source is more favorable, and line intensity shows the size of the gap. Rows are sorted in ascending order by Δ, where Δ is equal to mean_podcast minus mean_news (Δ &gt; 0: podcasts more favorable).
      </div>
    </article>
  );
}

function PairedWordcloudsPage() {
  return (
    <article className={styles.mainCard}>
      <div className={styles.chartScrollWrapper}>
        <PairedWordclouds />
      </div>
      <div className={styles.figureCaption}>
        Figure 4: Interactive paired sentiment word cloud showing top 10 words by in-topic TF-IDF from two sources on a given topic. Color gradient represents sentiment (negative = red, neutral = gray, positive = green).
      </div>
    </article>
  );
}

export default function App() {
  const location = useLocation();

  // Keep a solid white background to match the report.
  const rootClass = `${styles.podcastAppRoot} ${styles.whiteBg}`;

  // Optional: detect chart subroutes
  const path = location.pathname || "";
  const isChartPage =
    path.endsWith("/topics") ||
    path.endsWith("/stance") ||
    path.endsWith("/paired-wordclouds");

  return (
    <div className={rootClass} data-chart-page={isChartPage ? "true" : "false"}>
      <ErrorBoundary fallback={<div style={{ color: "#dc2626" }}>Couldn’t load this page.</div>}>
        <Routes>
          {/* Index (dashboard) */}
          <Route index element={<DashboardPage />} />
          {/* Dedicated routes */}
          <Route path="topics" element={<TopicsPage />} />
          <Route path="stance" element={<StancePage />} />
          <Route path="paired-wordclouds" element={<PairedWordcloudsPage />} />
          {/* Unknown subroutes -> dashboard */}
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}