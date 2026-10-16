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
            PhD candidate in Computing at the Hong Kong Polytechnic University.
            Computational research on the relationship between exercise and sleep,
            with prior work in applied data science, education, and elite athletics.
          </p>
        </section>

        {/* Education */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Education</h2>

          <div className={styles.roleHeader}>
            <p>
              <strong>PhD, Computing</strong> · The Hong Kong Polytechnic University
            </p>
            <p className={styles.inlineDates}>Sep 2026 — Sep 2029</p>
          </div>

          <div className={styles.roleHeader}>
            <p>
              <strong>M.S., Applied Data Science</strong> · University of Michigan
            </p>
            <p className={styles.inlineDates}>May 2023 — Aug 2025</p>
          </div>

          <div className={styles.roleHeader}>
            <p>
              <strong>M.Ed., Urban Education & Leadership</strong> · Loyola Marymount University
            </p>
            <p className={styles.inlineDates}>Jun 2020 — Aug 2022</p>
          </div>

          <div className={styles.roleHeader}>
            <p>
              <strong>B.A., Communication</strong> · University of California, Los Angeles
            </p>
            <p className={styles.inlineDates}>Sep 2016 — Jun 2020</p>
          </div>
        </section>

        {/* Experience */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience</h2>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Full-Stack Developer
                <span className={styles.company}> · DreamTune Limited</span>
              </h3>
              <p className={styles.inlineDates}>Jan 2026 — Aug 2026</p>
            </div>
            <ul>
              <li>
                Built Clozzz, a personalized sleep-audio app (Flutter, FastAPI, PostgreSQL, GCP),
                including recommendations, encrypted streaming, and offline sync. Also led UI, web, and scientific video (100K+ views).
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Freelance LLM Engineer
                <span className={styles.company}> · Little Scholars Creative Workshop</span>
              </h3>
              <p className={styles.inlineDates}>Oct 2025 — Dec 2025</p>
            </div>
            <ul>
              <li>
                Shipped a production WhatsApp RAG assistant (AWS Bedrock, Llama 3 70B) with safety filters
                and deterministic routing for scheduling and severe-weather queries.
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Athlete
                <span className={styles.company}> · Hong Kong Athletics Team</span>
              </h3>
              <p className={styles.inlineDates}>Apr 2023 — Jun 2025</p>
            </div>
            <ul>
              <li>
                Represented Hong Kong in the 800m and 1500m. Three Hong Kong records (800m twice; 4×800m relay)
                and two-time Hong Kong 800m champion, concurrent with graduate study.
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
            <ul>
              <li>
                Full-time computer science, English, and history teacher. Designed a 10-week JavaScript curriculum;
                97% pass rate and 193.5% average student reading growth.
              </li>
            </ul>
          </div>

          <div className={styles.entry}>
            <div className={styles.roleHeader}>
              <h3 className={styles.role}>
                Research Assistant
                <span className={styles.company}> · UCLA Emergence of Communication Lab</span>
              </h3>
              <p className={styles.inlineDates}>Sep 2019 — Jul 2020</p>
            </div>
            <ul>
              <li>
                Prepared and labeled infant vocal recordings for TalkBank, using Praat and EAF to segment and annotate speech audio.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}