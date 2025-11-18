// Resume.jsx
import React from "react";
import styles from "./Resume.module.css";

export default function Resume() {
  return (
    <div className={styles.resumeRoot}>
      {/* Download PDF button located top right */}
      <a
        href="/Sean_Fontaine_Resume.pdf"
        className={styles.downloadBtn}
        download="Sean_Fontaine_Resume.pdf"
      >
        Download PDF
      </a>

      <main className={styles.content}>
        {/* Header Section */}
        <section className={styles.headerSection}>
          <h1 className={styles.name}>Sean Fontaine</h1>
          <p className={styles.contact}>
            <a href="mailto:sfontaine20@ucla.edu">sfontaine20@ucla.edu</a> ·
            <span> Hong Kong SAR</span> ·
            <a
              href="https://www.linkedin.com/in/sean-fontaine-2aab9b177"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>{" "}
            ·
            <a
              href="https://github.com/spidersocks"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>{" "}
            ·
            <a
              href="https://www.seanfontaine.dev/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Website
            </a>
          </p>
        </section>

        {/* Summary */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Summary</h2>
          <p>
            Applied Data Scientist (MADS @ Michigan) with end‑to‑end ML experience and a product mindset.
            Strengths in feature engineering, interactive apps, and LLM pipelines for real‑world use.
          </p>
        </section>

        {/* Selected Projects*/}
        <section className={`${styles.section} ${styles.projects}`}>
          <h2 className={styles.sectionTitle}>Selected Projects</h2>

          <p>
            <strong>
              <a
                href="https://www.seanfontaine.dev/medical-scribe"
                className={styles.projectTitleLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                StethoscribeAI — Real‑time Medical Scribe:
              </a>
            </strong>{" "}
            Live transcription of clinician–patient conversations, medical entity extraction, and structured notes;
            supports English, Cantonese, and Mandarin.{" "}
            <span style={{ fontSize: "0.95em", fontStyle: "italic", color: "#666" }}>
              Stack: React, FastAPI, WebSockets, AWS Transcribe/Translate, Comprehend Medical, AWS Bedrock (Mistral 70B).
            </span>
          </p>

          <p>
            <strong>
              <a
                href="https://www.seanfontaine.dev/podcast-project"
                className={styles.projectTitleLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                News vs. Podcasts Analysis:
              </a>
            </strong>{" "}
            BERTopic topic modeling, LLM‑based stance (Mistral, CoS), and sentiment (VADER/TextBlob) over 25K+ articles/transcripts,
            with interactive dashboards comparing podcasts and public news.{" "}
            <span style={{ fontSize: "0.95em", fontStyle: "italic", color: "#666" }}>
              Stack: Python, BERTopic, sentence‑transformers, FastAPI, Plotly/Recharts.
            </span>
          </p>

          <p>
            <strong>
              <a
                href="https://www.seanfontaine.dev/800m-calculator"
                className={styles.projectTitleLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                800m Performance Calculator:
              </a>
            </strong>{" "}
            FastAPI + React app using linear regression to predict race times from training splits;
            84% predictions within ±1s on test data; widely used by Hong Kong athletes.{" "}
            <span style={{ fontSize: "0.95em", fontStyle: "italic", color: "#666" }}>
              Stack: FastAPI, React, scikit‑learn.
            </span>
          </p>

          <p>
            <strong>
              <a
                href="https://www.seanfontaine.dev/poke-team-predictor"
                className={styles.projectTitleLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                VGC Team Recommender:
              </a>
            </strong>{" "}
            Multi‑label XGBoost for teammate recommendation from a restricted core;
            example‑based F1 0.78 (+23% vs baseline).{" "}
            <span style={{ fontSize: "0.95em", fontStyle: "italic", color: "#666" }}>
              Stack: XGBoost, scikit‑learn, FastAPI, Joblib.
            </span>
          </p>
        </section>

        {/* Technical Skills */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Technical Skills</h2>
          <p>
            <strong>ML:</strong> XGBoost, Random Forest; clustering, PCA, F1/AUC.{" "}
            <strong>NLP:</strong> Transformers, BERTopic, LLM pipelines.{" "}
            <strong>Data & Apps:</strong> Python, FastAPI, React, Plotly, SQL, WebSockets.{" "}
            <strong>Languages:</strong> English (Native), Mandarin (Advanced), Cantonese (Limited Working).
          </p>
        </section>

        {/* Experience */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience</h2>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Freelance LLM Engineer
                <span className={styles.company}> · Little Scholars Creative Workshop</span>
              </h3>
              <p className={styles.inlineDates}>Oct 2025 — Nov 2025</p>
            </div>
            <ul>
              <li>
                Built and deployed WhatsApp RAG assistant using AWS Bedrock (Llama 3), FastAPI & WhatsApp Cloud API; 
                integrated DynamoDB/S3 retrieval and custom safety filters.
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                CS & Mathematics Tutor
                <span className={styles.company}> · All Round Education Academy</span>
              </h3>
              <p className={styles.inlineDates}>Sep 2022 — Jul 2023</p>
            </div>
            <ul>
              <li>
                Mentored IB/A‑Level students on Python/Java projects; taught advanced math and OOP.
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Teacher | TFA Corps Member
                <span className={styles.company}> · Alliance MIT (Teach For America)</span>
              </h3>
              <p className={styles.inlineDates}>Jun 2020 — Jun 2022</p>
            </div>
            <ul>
              <li>
                Designed 10‑week JavaScript curriculum; 97% pass rate and 193.5% student reading growth.
              </li>
            </ul>
          </div>
        </section>

        {/* Education */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Education</h2>

          <div className={styles.roleHeader}>
            <p>
              <strong>Master of Applied Data Science</strong> · University of Michigan
            </p>
            <p className={styles.inlineDates}>May 2023 — Aug 2025</p>
          </div>

          <div className={styles.roleHeader}>
            <p>
              <strong>M.Ed., Urban Education & Leadership</strong> · Loyola Marymount University
            </p>
            <p className={styles.inlineDates}>Sep 2021 — Jul 2022</p>
          </div>

          <div className={styles.roleHeader}>
            <p>
              <strong>B.A., Communication</strong> · UCLA
            </p>
            <p className={styles.inlineDates}>Sep 2016 — Jul 2020</p>
          </div>
        </section>
      </main>
    </div>
  );
}