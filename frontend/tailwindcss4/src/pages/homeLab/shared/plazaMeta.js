export const PLAZA_API = "https://unified-backend.fly.dev/plaza";
export const VISIT_SESSION_KEY = "plaza_visit_counted";
export const COUNTER_FALLBACK = 900;

export function formatCounter(n) {
  return String(Math.max(0, Math.floor(n))).padStart(6, "0");
}

export function clockText(date) {
  let hours = date.getHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds} ${suffix}`;
}
