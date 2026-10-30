import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { openProps, projects } from "./projects";
import { lifeEvents } from "./life";
import { clockText } from "./shared/plazaMeta";
import { AnalogCounter } from "./shared/AnalogCounter";
import { useVisitorCount } from "./shared/useVisitorCount";
import { AdviceGifCards } from "./variants/AdviceVariants";
import { VideoMini } from "./variants/VideoVariants";
import MobileChrome from "./MobileChrome";
import MarqueePill from "./MarqueePill";
import ProjectStrip from "./ProjectStrip";
import styles from "./Home2.module.css";

const MARQUEE = [
  "About",
  "PhD Computing · Hong Kong Polytechnic University",
  "Exercise and sleep research",
  "Selected projects",
];

const CONTACTS = [
  {
    id: "mail",
    label: "Email",
    href: "mailto:sean-hm.fontaine@connect.polyu.hk",
    Icon: MailIcon,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/sean-fontaine-2aab9b177/",
    Icon: LinkedInIcon,
    external: true,
  },
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/spidersocks/",
    Icon: GitHubIcon,
    external: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/seanfontainehk/",
    Icon: InstagramIcon,
    external: true,
  },
];

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.6-1.5-1.5-1.9-1.5-1.9-1.2-.8.1-.8.1-.8 1.3.1 2 .9 2 .9 1.1 2 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.6-.3-5.3-1.3-5.3-6 0-1.3.4-2.3 1.1-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.7.9 1.1 2 1.1 3.2 0 4.8-2.7 5.7-5.3 6 .4.3.8 1 .8 2v3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.84-2.2 3.8-2.2 4.06 0 4.8 2.67 4.8 6.1V24h-4v-7.9c0-1.9 0-4.3-2.6-4.3-2.6 0-3 2-3 4.1V24h-4V8z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.9.2 2.3.4.6.2 1 .5 1.5 1 .5.5.8.9 1 1.5.2.4.3 1.1.4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.9-.4 2.3-.2.6-.5 1-1 1.5-.5.5-.9.8-1.5 1-.4.2-1.1.3-2.3.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.9-.2-2.3-.4-.6-.2-1-.5-1.5-1-.5-.5-.8-.9-1-1.5-.2-.4-.3-1.1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.9.4-2.3.2-.6.5-1 1-1.5.5-.5.9-.8 1.5-1 .4-.2 1.1-.3 2.3-.4C8.4 2.2 8.8 2.2 12 2.2m0-2.2C8.7 0 8.3 0 7.1.1c-1.3.1-2.2.3-3 .6-.8.3-1.5.7-2.2 1.4C1.2 2.8.8 3.5.5 4.3c-.3.8-.5 1.7-.6 3C0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.3 2.2.6 3 .3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.7.5 3 .6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.3-.1 2.2-.3 3-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.7.6-3 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.3-2.2-.6-3-.3-.8-.7-1.5-1.4-2.2C21.2 1.2 20.5.8 19.7.5c-.8-.3-1.7-.5-3-.6C15.7 0 15.3 0 12 0z" />
      <path d="M12 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8.1 4 4 0 0 1 0 8.1zm6.4-11.7a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.236l7.386 6.153a1 1 0 0 0 1.228 0L20 8.236V18H4Z" />
    </svg>
  );
}

/** Tiny plaza-style pair of visitors (not a tip gif). */
function VisitorIcon() {
  return (
    <svg
      className={styles.visitorIcon}
      viewBox="0 0 32 28"
      width="32"
      height="28"
      aria-hidden="true"
    >
      <circle cx="11" cy="7" r="4" fill="#7fd0ff" stroke="#1f5f86" strokeWidth="1.2" />
      <path
        d="M4.5 22c0-4 2.8-6.5 6.5-6.5S17.5 18 17.5 22"
        fill="#dff4ff"
        stroke="#1f5f86"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="22" cy="8" r="3.5" fill="#ffd27a" stroke="#1f5f86" strokeWidth="1.2" />
      <path
        d="M16.5 22c0-3.4 2.4-5.5 5.5-5.5S27.5 18.6 27.5 22"
        fill="#fff0c8"
        stroke="#1f5f86"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Home2() {
  const [time, setTime] = useState(() => clockText(new Date()));
  const [timelineMax, setTimelineMax] = useState(null);
  const [resumeHeight, setResumeHeight] = useState(null);
  const [timelineGrabbing, setTimelineGrabbing] = useState(false);
  const { count, justCounted } = useVisitorCount();
  const logRef = useRef(null);
  const leftRef = useRef(null);
  const centerRef = useRef(null);
  const rightRef = useRef(null);
  const updatesRef = useRef(null);
  const resumeImgRef = useRef(null);
  const timelineDragRef = useRef(null);
  const featured = projects[0];
  const rest = projects.slice(1);

  useEffect(() => {
    const id = setInterval(() => setTime(clockText(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // Pin timeline + resume bottoms to the center column so all three
  // columns meet at roughly the same baseline on desktop.
  useLayoutEffect(() => {
    const center = centerRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    const updates = updatesRef.current;
    const list = logRef.current;
    const resumeImg = resumeImgRef.current;
    if (!center || !left || !right || !updates || !list || !resumeImg) return undefined;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.matchMedia("(max-width: 960px)").matches) {
          setTimelineMax(null);
          setResumeHeight(null);
          return;
        }

        const targetH = center.offsetHeight;

        const aboveTimeline =
          list.getBoundingClientRect().top - right.getBoundingClientRect().top;
        const timelineNext = Math.floor(targetH - aboveTimeline);
        const timelineCapped = Number.isFinite(timelineNext)
          ? Math.max(64, timelineNext)
          : null;
        setTimelineMax((prev) => (prev === timelineCapped ? prev : timelineCapped));

        // Height of everything in the left column except the preview image
        // (order-independent: Contact can sit above Resume).
        const leftExtras = left.offsetHeight - resumeImg.offsetHeight;
        const resumeNext = Math.max(96, Math.round(targetH - leftExtras));
        setResumeHeight((prev) => (prev === resumeNext ? prev : resumeNext));
      });
    };

    const ro = new ResizeObserver(sync);
    ro.observe(center);
    ro.observe(left);
    for (const child of right.children) {
      if (child !== updates) ro.observe(child);
    }
    for (const child of left.children) {
      ro.observe(child);
    }
    const imgs = [
      ...center.querySelectorAll("img"),
      resumeImg,
      ...left.querySelectorAll("img"),
    ];
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", sync, { once: true });
    });
    window.addEventListener("resize", sync);
    sync();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [count]);

  useLayoutEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [timelineMax]);

  useEffect(() => {
    if (!timelineGrabbing) return undefined;
    const onMove = (e) => {
      const drag = timelineDragRef.current;
      const list = logRef.current;
      if (!drag || !list) return;
      list.scrollTop = drag.scrollTop - (e.clientY - drag.y);
    };
    const onUp = () => {
      timelineDragRef.current = null;
      setTimelineGrabbing(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [timelineGrabbing]);

  const onTimelinePointerDown = (e) => {
    if (e.button !== 0) return;
    if (
      e.pointerType === "touch" ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    ) {
      return;
    }
    const list = logRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    if (e.clientX > rect.right - 14) return;
    timelineDragRef.current = {
      y: e.clientY,
      scrollTop: list.scrollTop,
    };
    setTimelineGrabbing(true);
    e.preventDefault();
  };

  return (
    <div
      className={`${styles.page}${timelineGrabbing ? ` ${styles.pageGrabbing}` : ""}`}
    >
      <MobileChrome contacts={CONTACTS} />
      <div className={styles.shell}>
        <header className={styles.header}>
          <img
            className={styles.heroCutout}
            src="/plaza/sean-cutout.webp"
            alt=""
            width="170"
            height="148"
          />
          <div className={styles.headerContent}>
            <div className={styles.brandRow}>
              <div className={styles.brand}>
                <p className={styles.kicker}>personal site</p>
                <h1>
                  Sean <span>Fontaine</span>
                </h1>
              </div>
              <div className={styles.headerActions}>
                <span className={styles.clock} aria-label="Current time">
                  {time}
                </span>
              </div>
            </div>
            <MarqueePill items={MARQUEE} />
          </div>
        </header>

        <div className={styles.grid}>
          <aside className={styles.left} ref={leftRef}>
            <div className={`${styles.navCard} ${styles.contactCard}`} id="contact">
              <div className={styles.navTab}>Contact</div>
              <div className={styles.contactRow}>
                {CONTACTS.map(({ id, label, href, Icon, external }) => (
                  <a
                    key={id}
                    className={`${styles.contactBtn} ${styles.wiiHoverSm}`}
                    href={href}
                    aria-label={label}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            <div className={`${styles.navCard} ${styles.resumeCard}`} id="resume">
              <div className={styles.navTab}>Resume</div>
              <a
                className={`${styles.resumeLink} ${styles.wiiHover}`}
                href="/resume"
                aria-label="Open resume"
              >
                <img
                  ref={resumeImgRef}
                  className={styles.resumePreview}
                  src="/plaza/resume-preview.png?v=2"
                  alt="Preview of Sean Fontaine resume"
                  style={
                    resumeHeight != null
                      ? { height: `${resumeHeight}px` }
                      : undefined
                  }
                />
                <span className={styles.resumeCta}>Open resume →</span>
              </a>
            </div>

            <AdviceGifCards className={styles.dailyWisdom} />
          </aside>

          <main className={styles.center} ref={centerRef}>
            <section className={styles.welcome} id="about">
              <div className={styles.cardHead}>About</div>
              <div className={styles.cardBody}>
                <p>
                  Hi, I&apos;m Sean — PhD candidate in Computing at Hong Kong Polytechnic
                  University. I study how exercise and sleep relate, under Professor
                  Fiona Yan Liu.
                </p>
                <img
                  className={styles.welcomeMii}
                  src="/plaza/sean-mii.webp"
                  alt=""
                  width="72"
                  height="135"
                />
              </div>
            </section>

            <section className={styles.featured} id="work">
              <div className={styles.cardHead}>Featured project</div>
              <a
                className={`${styles.featureCard} ${styles.wiiHover}`}
                href={featured.link}
                {...openProps(featured.link)}
              >
                <img src={featured.preview} alt="" />
                <div>
                  <strong>{featured.title}</strong>
                  <em>
                    {featured.badge} · {featured.date}
                  </em>
                  <p>{featured.description}</p>
                </div>
                <img className={styles.newGif} src="/plaza/new.webp" alt="New" />
              </a>
            </section>

            <section className={styles.moreProjects}>
              <div className={styles.cardHead}>More projects</div>
              <ProjectStrip projects={rest} />
            </section>
          </main>

          <aside className={styles.right} ref={rightRef}>
            <div className={styles.counterCard}>
              <div className={styles.cardHead}>Visitors</div>
              <div className={styles.counterBody}>
                <VisitorIcon />
                <AnalogCounter value={count} justCounted={justCounted} />
              </div>
            </div>

            <div className={styles.seanTv} id="sean-tv">
              <VideoMini compact />
            </div>

            <div className={styles.updates} id="timeline" ref={updatesRef}>
              <div className={styles.cardHead}>Timeline</div>
              <ol
                ref={logRef}
                className={`${styles.timelineList}${
                  timelineGrabbing ? ` ${styles.timelineGrabbing}` : ""
                }`}
                style={
                  timelineMax != null ? { maxHeight: `${timelineMax}px` } : undefined
                }
                onPointerDown={onTimelinePointerDown}
              >
                {lifeEvents.map((event) => (
                  <li key={`${event.year}-${event.title}`}>
                    <img src={event.gif} alt="" />
                    <div>
                      <b>{event.year}</b>
                      <span>{event.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Sean Fontaine</p>
      </footer>
    </div>
  );
}
