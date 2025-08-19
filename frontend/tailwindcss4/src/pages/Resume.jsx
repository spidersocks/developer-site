import React from "react";
import styles from "./Resume.module.css";

export default function Resume() {
  return (
    <div className={styles.resumeRoot}>
      {/* Download PDF pinned top-right */}
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
            </a> ·
            <a
              href="https://github.com/spidersocks"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a> ·
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
          <p className={styles.skills}>
            Applied Data Scientist (MADS @ Michigan) with end‑to‑end ML experience and product mindset.
            Strengths in feature engineering, interactive applications, and LLM‑based pipelines.
          </p>
        </section>

        {/* Experience */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience</h2>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Independent Data Scientist
                <span className={styles.company}> · Portfolio Projects</span>
              </h3>
              <p className={styles.inlineDates}>Apr 2025 — Present</p>
            </div>
            <ul className={styles.bullets}>
              <li>
                <strong>News vs. Podcasts Analysis:</strong> Multi‑stage NLP pipeline with LLM integration analyzing 25K+ articles/transcripts; interactive visualizations for cross‑medium comparison.
              </li>
              <li>
                <strong>800m Performance Calculator:</strong> FastAPI + React app achieving 84% accuracy (±1 sec) on race predictions; widely used by Hong Kong athletes.
              </li>
              <li>
                <strong>VGC Team Recommender:</strong> Multi‑label XGBoost classifier; F1‑score 0.78 (23% improvement over baseline).
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                CS & Mathematics Tutor
                <span className={styles.company}> · All Round Education Academy</span>
              </h3>
              <p className={styles.inlineDates}>Sep 2022 — Jul 2023</p>
            </div>
            <ul className={styles.bullets}>
              <li>
                <strong>Project Guidance:</strong> Mentored IB/A‑Level students through reak-world Python/Java projects; emphasized problem decomposition and object-oriented programming.
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Teacher | TFA Corps Member
                <span className={styles.company}> · Alliance MIT (Teach For America)</span>
              </h3>
              <p className={styles.inlineDates}>Jun 2020 — Jun 2022</p>
            </div>
            <ul className={styles.bullets}>
              <li>
                <strong>Curriculum Design:</strong> Developed 10-week JavaScript curriculum for students.
              </li>
              <li>
                <strong>Student Growth:</strong> Led data‑driven instruction. Students achieved 97% pass rate on programming assessments; 193.5% average annual growth on reading.
              </li>
            </ul>
          </div>
        </section>

        {/* Education */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Education</h2>
          
          <div className={styles.roleHeader}>
            <p className={styles.skills}>
              <strong>Master of Applied Data Science</strong> · University of Michigan
            </p>
            <p className={styles.inlineDates}>May 2023 — Aug 2025</p>
          </div>
          
          <div className={styles.roleHeader}>
            <p className={styles.skills}>
              <strong>M.Ed., Urban Education & Leadership</strong> · Loyola Marymount University
            </p>
            <p className={styles.inlineDates}>Sep 2021 — Jul 2022</p>
          </div>
          
          <div className={styles.roleHeader}>
            <p className={styles.skills}>
              <strong>B.A., Communication</strong> · UCLA
            </p>
            <p className={styles.inlineDates}>Sep 2016 — Jul 2020</p>
          </div>
        </section>

        {/* Skills */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills</h2>
          <p className={styles.skills}>
            <strong>ML:</strong> Random Forest, XGBoost, clustering, feature engineering, F1/AUC evaluation • 
            <strong>Programming:</strong> Python (pandas, scikit‑learn, NumPy), FastAPI, React • 
            <strong>NLP:</strong> Text classification, stance detection, transformer models, prompt chaining • 
            <strong>Viz:</strong> Altair, Plotly, D3.js • 
            <strong>Languages:</strong> English (Native), Mandarin (Professional)
          </p>
        </section>
      </main>
    </div>
  );
}