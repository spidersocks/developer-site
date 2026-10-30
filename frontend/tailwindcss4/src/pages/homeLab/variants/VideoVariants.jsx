import { useMemo, useState } from "react";
import {
  VIDEO_CHANNELS,
  dailyVideo,
  embedUrl,
  thumbUrl,
} from "./videoShared";
import styles from "./VideoVariants.module.css";

function visitChannel() {
  // Per-visit coin flip: Sleep vs Running as the default tab
  return Math.random() < 0.5 ? "sleep" : "run";
}

function useChannel(initial) {
  const [channelId, setChannelId] = useState(() => initial ?? visitChannel());
  const channel = VIDEO_CHANNELS.find((c) => c.id === channelId) ?? VIDEO_CHANNELS[0];
  const video = useMemo(() => dailyVideo(channel), [channel]);
  return { channel, video, channelId, setChannelId };
}

function PlayPoster({ video, playlistId, title }) {
  const [playing, setPlaying] = useState(false);
  const watchUrl = playlistId
    ? `https://www.youtube.com/watch?v=${video.id}&list=${playlistId}`
    : `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <div className={styles.stage}>
      {playing ? (
        <>
          <iframe
            title={title || video.title}
            src={embedUrl(video, playlistId, true)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className={styles.playerChrome}>
            <a
              className={styles.playerChromeBtn}
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube
            </a>
            <button
              type="button"
              className={styles.playerChromeBtn}
              onClick={() => setPlaying(false)}
              aria-label="Close video"
            >
              Close
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={styles.posterBtn}
          style={{ backgroundImage: `url(${thumbUrl(video.id)})` }}
          onClick={() => setPlaying(true)}
          aria-label={`Play ${video.title}`}
        />
      )}
    </div>
  );
}

function ChannelTabs({ channelId, setChannelId }) {
  return (
    <div className={styles.tabs}>
      {VIDEO_CHANNELS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={c.id === channelId ? styles.tabOn : styles.tab}
          onClick={() => setChannelId(c.id)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Small click-to-play Sean TV widget (production) */
export function VideoMini({ title = "Sean TV", compact = false } = {}) {
  const { channel, video, channelId, setChannelId } = useChannel();

  return (
    <section
      className={`${styles.wrap} ${compact ? styles.sidebar : ""}`}
      aria-label={title}
    >
      <div className={styles.mini}>
        <div className={styles.head}>
          <span>{title}</span>
          <ChannelTabs channelId={channelId} setChannelId={setChannelId} />
        </div>
        <PlayPoster video={video} playlistId={channel.playlistId} />
        <p className={styles.caption}>
          <strong className={styles.captionLabel}>Video of the day:</strong>{" "}
          {video.title}
        </p>
      </div>
    </section>
  );
}
