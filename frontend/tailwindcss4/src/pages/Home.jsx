import React from "react";
import styles from "./Home.module.css";

const projects = [
  {
    title: "800m Training & Race Calculator",
    description: "A tool for runners and coaches to plan training and race splits for the 800 meters.",
    link: "/en/800m-calculator",
    badge: "Tool",
    date: "4th May 2025",
    preview: "/800m_preview.jpg",
  },
  {
    title: "Pokémon VGC Teammate Calculator",
    description: "Predict your ideal Pokémon Regulation I VGC team based on Restricted core.",
    link: "/poke-team-predictor",
    badge: "NEW",
    date: "22nd June 2025",
    preview: "/pokemon_preview.jpg",
  },
  {
    title: "Podcast Project",
    description: "Explore topic distributions across podcasts and public news media.",
    link: "/podcast-project",
    badge: "BETA",
    date: "Ongoing",
    preview: "/collage_preview.png",
  },
];

export default function Home() {
  return (
    <div className={styles.homeRoot}>
      {/* Header Section */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarContainer}>
          <div className={styles.sidebarHeader}>
            <div className={styles.avatar}>
              <img
                src="/sean_fontaine.jpg"
                alt="Sean Fontaine"
                className={styles.avatarImg}
              />
            </div>
            <div>
              <h1 className={styles.name}>Sean Fontaine</h1>
              <div className={styles.tagline}>Portfolio & Web Apps</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.contentWrapper}>
        <div className={styles.scrollContainer}>
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
                    {/* Project Preview Image */}
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
                        <span className={styles[`badge${project.badge}`] || styles.badge}>
                          {project.badge}
                        </span>
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
      </div>
    </div>
  );
}