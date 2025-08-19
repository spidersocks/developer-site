import React from "react";
import styles from "./About.module.css";
import Header from "../components/Header";

export default function About() {
  return (
    <div className={styles.aboutRoot}>
      <Header />

      <main className={styles.aboutContent}>
        <div className={styles.aboutContainer}>
          {/* Image spans the same width as the text column */}
          <img
            src="/about_me.png"
            alt="About me"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: "8px",
              marginBottom: "1.25rem",
            }}
          />
          
          <h1 className={styles.aboutTitle}>About Me</h1>
          <p className={styles.aboutText}>
            I am a data scientist with a background in
            education, communications, and sport. I have a passion for applying
            machine learning methods to real‑world problems.
          </p>

          <p className={styles.aboutText}>
            After starting my formal data science education at <strong>UCLA</strong>, I joined
            Teach For America, where I taught for 2 years as a
            multiple‑subjects teacher at Alliance College‑Ready Public Schools while earning my
            M.Ed.
          </p>

          <p className={styles.aboutText}>
            I then returned to Hong Kong to complete my remote
            <em> Master’s in Applied Data Science</em> from the
            <strong> University of Michigan School of Information</strong>, while simultaneously competing for the
            Hong Kong Athletics Team, breaking 3 Hong Kong records
            and balancing elite training with graduate study and work commitments.
          </p>

          <p className={styles.aboutText}>
            I enjoy building practical, user‑friendly tools in my domains of interest.
            I encourage you to explore these on my <a href="/projects"><strong>projects</strong></a> page!
          </p>

          <p className={styles.aboutText}>
            <strong>What I bring:</strong>
          </p>
          <ul className={styles.aboutText} style={{ marginLeft: "1.25rem" }}>
            <li>
              End‑to‑end ML experience: data collection, modeling, evaluation, and deployment.
            </li>
            <li>
              End‑user mindset: clean user interfaces, transparent metrics, clearly and accessibly communicated insights.
            </li>
            <li>
              Mission‑guided: equity‑driven; passionate about improving lives through my work.
            </li>
            <li>
              Athlete discipline: excellent organization, resilient under pressure.
            </li>
          </ul>

          <p className={styles.aboutText}>
            I am excited to continue to grow as a data professional and to build more tools
            that solve issues in the domains I am passionate about.
          </p>
        </div>
      </main>

      <footer className={styles.pageFooter}>
        © {new Date().getFullYear()} Sean Fontaine
      </footer>
    </div>
  );
}