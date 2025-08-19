import React from "react";
import styles from "./About.module.css";
import Header from "../components/Header"; // reuse the header

export default function About() {
  return (
    <div className={styles.aboutRoot}>
      <Header />

      <main className={styles.aboutContent}>
        <div className={styles.aboutContainer}>
          <h1 className={styles.aboutTitle}>About Me</h1>
          <p className={styles.aboutText}>
            Hi, I’m <strong>Sean Fontaine</strong>, a data scientist and recent
            graduate from the <em>University of Michican School of Information</em>. I have
            experience in education
            showcased here in my portfolio.
          </p>
          <p className={styles.aboutText}>
            I specialize in <em>React, Vite, Tailwind, and data visualization</em>.
            I also enjoy working on projects that bridge technology with sports,
            research, and entertainment.
          </p>
          <p className={styles.aboutText}>
            When I’m not coding, I’m probably running, exploring new tech trends,
            or brainstorming my next project.
          </p>
        </div>
      </main>

      <footer className={styles.pageFooter}>
        © {new Date().getFullYear()} Sean Fontaine
      </footer>
    </div>
  );
}