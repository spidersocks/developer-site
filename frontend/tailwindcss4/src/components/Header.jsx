import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./Header.module.css";

/* === Social Icons === */
function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.6-1.5-1.5-1.9-1.5-1.9-1.2-.8.1-.8.1-.8 1.3.1 2 .9 2 .9 1.1 2 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.6-.3-5.3-1.3-5.3-6 0-1.3.4-2.3 1.1-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.7.9 1.1 2 1.1 3.2 0 4.8-2.7 5.7-5.3 6 .4.3.8 1 .8 2v3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.84-2.2 3.8-2.2 4.06 0 4.8 2.67 4.8 6.1V24h-4v-7.9c0-1.9 0-4.3-2.6-4.3-2.6 0-3 2-3 4.1V24h-4V8z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.9.2 2.3.4.6.2 1 .5 1.5 1 .5.5.8.9 1 1.5.2.4.3 1.1.4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.9-.4 2.3-.2.6-.5 1-1 1.5-.5.5-.9.8-1.5 1-.4.2-1.1.3-2.3.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.9-.2-2.3-.4-.6-.2-1-.5-1.5-1-.5-.5-.8-.9-1-1.5-.2-.4-.3-1.1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.9.4-2.3.2-.6.5-1 1-1.5.5-.5.9-.8 1.5-1 .4-.2 1.1-.3 2.3-.4C8.4 2.2 8.8 2.2 12 2.2m0-2.2C8.7 0 8.3 0 7.1.1c-1.3.1-2.2.3-3 .6-.8.3-1.5.7-2.2 1.4C1.2 2.8.8 3.5.5 4.3c-.3.8-.5 1.7-.6 3C0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.2.6 3 .3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.7.5 3 .6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.2-.3 3-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.7.6-3 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.2-.6-3-.3-.8-.7-1.5-1.4-2.2C21.2 1.2 20.5.8 19.7.5c-.8-.3-1.7-.5-3-.6C15.7 0 15.3 0 12 0z" />
      <path d="M12 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8.1 4 4 0 0 1 0 8.1zm6.4-11.7a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="27"
      height="27"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.236l7.386 6.153a1 1 0 0 0 1.228 0L20 8.236V18H4Z" />
    </svg>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Left: Brand */}
        <Link to="/" className={styles.brand}>
          <div className={styles.avatar}>
            <img
              src="/sean_fontaine.jpg"
              alt="Sean Fontaine"
              className={styles.avatarImg}
            />
          </div>
          <div>
            <h1 className={styles.name}>Sean Fontaine</h1>
            <p className={styles.subheading}>Data Scientist</p>
          </div>
        </Link>

        {/* Center: Nav (desktop only) */}
        <nav className={styles.navCenter}>
          <Link to="/about" className={styles.navLink}>About</Link>
          <Link to="/projects" className={styles.navLink}>Projects</Link>
          <Link to="/resume" className={styles.navLink}>Resume</Link>
        </nav>

        {/* Right: Socials (desktop) + Hamburger (mobile) */}
        <div className={styles.rightSide}>
          {/* Desktop socials */}
          <div className={styles.socials}>
            <a href="https://github.com/spidersocks/" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <GitHubIcon />
            </a>
            <a href="https://www.linkedin.com/in/sean-fontaine-2aab9b177/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <LinkedInIcon />
            </a>
            <a href="https://www.instagram.com/seanfontainehk/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <InstagramIcon />
            </a>
            <a
              href="mailto:sfontaine20@ucla.edu"
              aria-label="Email"
            >
              <MailIcon />
            </a>
          </div>

          {/* Hamburger button */}
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <Link to="/about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>About</Link>
          <Link to="/projects" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Projects</Link>
          <Link to="/resume" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Resume</Link>

          {/* Mobile socials */}
          <div className={styles.mobileSocials}>
            <a href="https://github.com/spidersocks/" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <GitHubIcon />
            </a>
            <a href="https://www.linkedin.com/in/sean-fontaine-2aab9b177/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <LinkedInIcon />
            </a>
            <a href="https://www.instagram.com/seanfontainehk/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <InstagramIcon />
            </a>
            <a
              href="mailto:sfontaine20@ucla.edu"
              aria-label="Email"
            >
              <MailIcon />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}