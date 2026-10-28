export const sleepTips = [
  "Try to wake up at a similar time every day, even on weekends!",
  "Try to get 7-9 hours of sleep per night - your body needs it!",
  "Try to expose yourself to bright morning light within an hour of waking.",
  "Keep evening light dim and avoid bright screens before bed.",
  "Maintain a consistent bedtime routine starting ~60 minutes before sleep.",
  "If you can’t sleep, get out of bed and do something boring until you feel sleepy.",
  "Try to lie in your bed only for sleeping - not for work or screen time.",
  "Avoid large meals and heavy alcohol close to bedtime.",
  "Limit caffeine after midday (or at least 6 hours before bedtime).",
  "Use a sleep mask or blackout curtains to make your bedroom as dark as comfortable.",
  "Keep your bedroom cool, quiet, and comfortable for sleep.",
  'If you struggle with too many thoughts at night, try writing a "worry journal".',
  "Try gentle breath observation — observe breathing without controlling it — to reduce pre‑sleep arousal.",
  "If you’re trying to fall asleep, aim to “stay awake calmly” rather than forcing sleep.",
  "Short naps (10–30 minutes, before ~3pm) can boost alertness without disrupting night sleep.",
  "Avoid long naps (>60 minutes) late in the day if you struggle to sleep at night.",
  "Use steady background sound (fan/white noise) for noisy rooms.",
  "Audio that is familiar but a little bit boring can help calm your mind at night.",
  "If you use sleep medication, do so under medical guidance and for brief, targeted periods when needed.",
  "If you wake at night, avoid checking the clock, and keep lights low if you must get up.",
  "Replace stimulating evening activities (intense work/social media) with calming ones (reading, gentle audio).",
  "Limit fluid intake close to bedtime to reduce nighttime bathroom trips.",
  "Favor predictable sleep times over “catching up” by sleeping in — consistency is key.",
  "Prioritize treatment when sleep problems persist ≥3 nights/week for ≥3 months — seek professional help.",
  "Track one small change at a time (7-day experiment) to identify what actually improves your sleep.",
  "Don’t obsess over “perfect” sleep — reducing anxiety about sleep often improves it most.",
];

/** Stable tip index for a calendar day (local time). */
export function tipIndexForDate(length, salt = 0, date = new Date()) {
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.abs(Math.floor(start / 86400000) + salt) % length;
}
