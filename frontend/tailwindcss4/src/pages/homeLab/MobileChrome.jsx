import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./MobileChrome.module.css";

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2.5L18.5 9H14V4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5zm0 3.5h5V20H8v-1z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.36 4.36 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

/** Soft Aero channel-style thumb dock — Contact expands; Resume links through. */
export default function MobileChrome({ contacts }) {
  const [ready, setReady] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!contactOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setContactOpen(false);
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setContactOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [contactOpen]);

  if (!ready) return null;

  return createPortal(
    <div className={styles.root} ref={rootRef}>
      <div className={styles.dock}>
        {contactOpen ? (
          <div
            id="soft-aero-contact-sheet"
            className={styles.contactSheet}
            role="dialog"
            aria-label="Contact"
          >
            <div className={styles.iconRow}>
              {contacts.map(({ id, label, href, Icon, external }) => (
                <a
                  key={id}
                  className={styles.iconBtn}
                  href={href}
                  aria-label={label}
                  onClick={() => setContactOpen(false)}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.actions} aria-label="Contact and resume">
          <button
            type="button"
            className={`${styles.pill} ${contactOpen ? styles.pillOn : ""}`}
            aria-expanded={contactOpen}
            aria-controls="soft-aero-contact-sheet"
            onClick={() => setContactOpen((open) => !open)}
          >
            <PeopleIcon />
            Contact
          </button>
          <a className={styles.pill} href="/resume">
            <DocIcon />
            Resume
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
