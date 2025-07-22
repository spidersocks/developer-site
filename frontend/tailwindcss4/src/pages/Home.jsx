import React from "react";
import styles from "./Home.module.css";

// Project data
const projects = [
  {
    title: "800m Training & Race Calculator",
    description: "A tool for runners and coaches to plan training and race splits for the 800 meters.",
    link: "/en/800m-calculator",
    badge: "Tool",
    date: "4th May 2025",
  },
  {
    title: "Pokémon VGC Teammate Calculator",
    description: "Predict your ideal Pokémon Regulation I VGC team based on Restricted picks.",
    link: "/poke-team-predictor",
    badge: "NEW",
    date: "22nd June 2025",
  },
  {
    title: "Podcast Project",
    description: "Explore topic distributions across podcasts and public news media.",
    link: "/podcast-project",
    badge: "BETA",
    date: "Ongoing",
  },
  // Add more projects as needed
];

export default function Home() {
  return (
    <>
      <title>Sean Fontaine | Portfolio & Web Apps</title>
      <meta
        name="description"
        content="Sean Fontaine's personal website and web app portfolio. Explore calculators and projects for athletes, developers, and more."
      />
      <link rel="canonical" href="https://www.seanfontaine.dev/" />
      <div className={styles.homeRoot}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.avatar}>
              <img
                src="/sean_fontaine.jpg"
                alt="Sean Fontaine"
                className={styles.avatarImg}
              />
            </div>
            <h1 className={styles.name}>Sean Fontaine</h1>
            <div className={styles.tagline}>Portfolio & Web Apps</div>
          </div>
          <nav className={styles.sidebarNav}>
            <ul>
              <li>
                <a href="https://github.com/spidersocks/developer-site" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
              {/* Add more nav links here if needed */}
            </ul>
          </nav>
          <footer className={styles.sidebarFooter}>
            &copy; {new Date().getFullYear()} Sean Fontaine
          </footer>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          <div className={styles.projects}>
            {projects.slice().reverse().map((proj, idx) => (
              <a
                className={styles.projectCard}
                href={proj.link}
                key={idx}
                tabIndex={0}
                aria-label={proj.title}
              >
                <div className={styles.projectTitle}>
                  {proj.title}
                  {proj.badge && (
                    <span className={styles[`badge${proj.badge}`] || styles.badge}>
                      {proj.badge}
                    </span>
                  )}
                </div>
                {proj.date && (
                  <div className={styles.projectDate}>{proj.date}</div>
                )}
                <div className={styles.projectDesc}>
                  {proj.description}
                </div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}