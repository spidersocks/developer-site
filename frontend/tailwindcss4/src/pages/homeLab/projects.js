export const projects = [
  {
    title: "Clozzz Sleep Series",
    short: "Sleep Series",
    description:
      "A weekly video on the science of sleep. 100k views and counting.",
    link: "https://www.youtube.com/@clozzz_app",
    badge: "Video",
    date: "July 2026",
    preview: "/projects/clozzz-sleep-series/preview.png",
    previewPosition: "bottom",
  },
  {
    title: "Clozzz",
    short: "Sleep audio app",
    description:
      "A sleep-audio app I designed and built with the DreamTune team. Personalized, lab-tested music.",
    link: "https://www.clozzz.com",
    badge: "App",
    date: "May 2026",
    preview: "/projects/clozzz/preview.png",
  },
  {
    title: "StethoScribe",
    short: "Clinical notes AI",
    description:
      "Real-time clinical notes from a conversation, using speech-to-text and a language model.",
    link: "/stethoscribe",
    badge: "Beta",
    date: "Sep 2025",
    preview: "/projects/stethoscribe/preview.jpg",
  },
  {
    title: "Podcasting the News",
    short: "News vs podcasts study",
    description:
      "A study of how news in podcasts differs from news in print and broadcast. Interactive charts.",
    link: "/podcast-project",
    badge: "Research",
    date: "Aug 2025",
    preview: "/projects/podcast/collage_preview.png",
  },
  {
    title: "Teammate Predictor",
    short: "Pokémon VGC teammate tool",
    description:
      "Suggests competitive teammates from a restricted core. Built on public battle data.",
    link: "/poke-team-predictor",
    badge: "Tool",
    date: "June 2025",
    preview: "/projects/pokemon/preview.jpg",
  },
  {
    title: "800m Calculator",
    short: "800m race & training splits",
    description:
      "Plan training and race splits for the 800 meters. Used by runners and coaches.",
    link: "/en/800m-calculator",
    badge: "Tool",
    date: "May 2025",
    preview: "/projects/800m/preview.jpg",
  },
];

export function openProps(link) {
  return link.startsWith("http")
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}
