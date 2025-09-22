import React from "react";
import styles from "./Home.module.css";
import Header from "../components/Header";

const projects = [
  {
    title: "800m Training & Race Calculator",
    description:
      "A tool for runners and coaches to plan training and race splits for the 800 meters.",
    link: "/en/800m-calculator",
    badge: "Tool",
    date: "May 2025",
    preview: "/800m_preview.jpg",
  },
  {
    title: "Pokémon VGC Teammate Predictor",
    description:
      "Predict your ideal Pokémon Regulation I VGC team based on Restricted core.",
    link: "/poke-team-predictor",
    badge: "Tool",
    date: "June 2025",
    preview: "/pokemon_preview.jpg",
  },
  {
    title: "Podcast Project",
    description:
      "Large-scale study comparing how news content in podcast systematically differs from that in traditional news. Includes interactive charts.",
    link: "/podcast-project",
    badge: "Research", 
    date: "August 2025",
    preview: "/collage_preview.png",
  },
  {
    title: "StethoScribe",
    description:
      "A real-time, AI-powered medical scribe for generating clinical notes from conversations using AWS Transcribe and Bedrock.",
    link: "/medical-scribe",
    badge: "BETA",
    date: "September 2025",
    preview: "/stethoscribe_preview.jpg",
  },
];

export default function Home() {
  return (
    <div className={styles.homeRoot}>
      <Header />

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.mainContentContainer}>
          <div className={styles.projects}>
            {[...projects].reverse().map((project, index) => (
              <a
                href={project.link}
                className={styles.projectCard}
                key={project.title}
                aria-label={`View ${project.title}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {project.preview && (
                  <img
                    src={project.preview}
                    alt={`Preview of ${project.title}`}
                    className={styles.projectPreviewImg}
                    loading="lazy"
                  />
                )}
                <div className={styles.projectTitle}>
                  {project.title}
                  {project.badge && (
                    <span className={styles.badge}>{project.badge}</span>
                  )}
                </div>
                <div className={styles.projectDate}>{project.date}</div>
                <div className={styles.projectDesc}>{project.description}</div>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.pageFooter}>
        © {new Date().getFullYear()} Sean Fontaine
      </footer>
    </div>
  );
}