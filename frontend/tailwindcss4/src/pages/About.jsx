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
            Hi, I'm Sean! I'm a computational researcher and PhD candidate in the
            Department of Computing at the Hong Kong Polytechnic University, with a
            background in education, communication, and sport. My research looks at
            how exercise and sleep relate. I'm supervised by Professor Fiona Yan Liu.
          </p>
        </div>
      </main>

      <footer className={styles.pageFooter}>
        © {new Date().getFullYear()} Sean Fontaine
      </footer>
    </div>
  );
}