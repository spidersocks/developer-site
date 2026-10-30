import { tipIndexForDate } from "../sleepTips";
import { PLAYLIST_ID, sleepVideos } from "../sleepVideos";
import { RUNNING_PLAYLIST_ID, runningVideos } from "../runningVideos";

export const VIDEO_CHANNELS = [
  {
    id: "sleep",
    label: "Sleep",
    videos: sleepVideos.filter((v) => v.kind === "youtube"),
    playlistId: PLAYLIST_ID,
    salt: 3,
  },
  {
    id: "run",
    label: "Running",
    videos: runningVideos.filter((v) => v.kind === "youtube" && !v.vertical),
    playlistId: RUNNING_PLAYLIST_ID,
    salt: 7,
  },
];

export function dailyVideo(channel) {
  const idx = tipIndexForDate(channel.videos.length, channel.salt);
  return channel.videos[idx] ?? channel.videos[0];
}

export function thumbUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function embedUrl(video, playlistId, autoplay = false) {
  // controls=0: YouTube's chrome is huge in a sidebar player and often sticks
  // on screen; we use a light custom overlay instead. iv_load_policy=3 hides cards.
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    controls: "0",
    iv_load_policy: "3",
    playsinline: "1",
    disablekb: "1",
    fs: "0",
  });
  if (playlistId) params.set("list", playlistId);
  if (autoplay) {
    params.set("autoplay", "1");
  }
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`;
}
