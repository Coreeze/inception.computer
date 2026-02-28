import { StatusPraesens } from "./statusPraesens";

export interface Signal {
  type: string;
  payload: Record<string, any>;
  priority: number;
}

export function checkSignals(
  prev: StatusPraesens,
  curr: StatusPraesens,
  daysSinceLastSignal: number
): Signal[] {
  const signals: Signal[] = [];

  if (prev.health.label !== curr.health.label) {
    signals.push({
      type: "HEALTH_SHIFT",
      payload: { from: prev.health.label, to: curr.health.label },
      priority: curr.health.label === "CRITICAL" ? 10 : 5,
    });
  }

  if (prev.vibe.label !== curr.vibe.label) {
    signals.push({
      type: "VIBE_SHIFT",
      payload: { from: prev.vibe.label, to: curr.vibe.label },
      priority: curr.vibe.label === "CRISIS" ? 10 : 5,
    });
  }

  if (prev.life_mission.label !== curr.life_mission.label) {
    signals.push({
      type: "MISSION_SHIFT",
      payload: { from: prev.life_mission.label, to: curr.life_mission.label },
      priority:
        curr.life_mission.label === "ON_THE_VERGE" ||
        curr.life_mission.label === "LOST"
          ? 8
          : 4,
    });
  }

  if (curr.health.label === "DECLINING" && curr.vibe.label === "LOW") {
    signals.push({ type: "BURNOUT", payload: {}, priority: 9 });
  }

  if (curr.health.label === "CRITICAL" && curr.vibe.label === "CRISIS") {
    signals.push({ type: "DEATH_SPIRAL", payload: {}, priority: 10 });
  }

  if (signals.length === 0 && daysSinceLastSignal >= 5) {
    signals.push({
      type: "QUIET_LIFE",
      payload: { daysSince: daysSinceLastSignal },
      priority: 1,
    });
  }

  return signals;
}
