import { TIP_TOPICS, dailyTip } from "./adviceShared";
import styles from "./AdviceVariants.module.css";

/** Quiet gif tip cards (production) */
export function AdviceGifCards({ compact = false, className = "" } = {}) {
  return (
    <section
      className={`${styles.card} ${styles.quirk} ${compact ? styles.compact : ""}${className ? ` ${className}` : ""}`}
      aria-label="Daily wisdom"
    >
      <div className={styles.quirkHead}>Daily wisdom</div>
      <div className={`${styles.body} ${styles.gifGrid}`}>
        {TIP_TOPICS.map((topic) => (
          <div key={topic.id} className={styles.gifCard}>
            <img src={topic.gif} alt="" />
            <div>
              <b>{topic.label}</b>
              <p>{dailyTip(topic)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
