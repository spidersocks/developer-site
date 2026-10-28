import { sleepTips, tipIndexForDate } from "../sleepTips";
import { runningTips } from "../runningTips";

export const TIP_TOPICS = [
  {
    id: "run",
    label: "Running",
    gif: "/plaza/tip-run.gif",
    tips: runningTips,
    salt: 11,
  },
  {
    id: "sleep",
    label: "Sleep",
    gif: "/plaza/tip-sleep.gif",
    tips: sleepTips,
    salt: 0,
  },
];

export function dailyTip(topic) {
  return topic.tips[tipIndexForDate(topic.tips.length, topic.salt)];
}
