import { IBeing } from "../../database/models/being";

export interface StatusEntry {
  label: string;
  description: string;
}

export interface StatusPraesens {
  health: StatusEntry;
  vibe: StatusEntry;
  life_mission: StatusEntry;
}

const HEALTH_THRESHOLDS: [number, string, string][] = [
  [90, "PEAK", "physically thriving, energetic, confident in body"],
  [70, "HEALTHY", "feeling good, no complaints"],
  [50, "AVERAGE", "something's off, low energy, minor aches"],
  [30, "DECLINING", "noticeably unwell, struggling to keep up"],
  [0, "CRITICAL", "barely functioning, can die at any point"],
];

const VIBE_THRESHOLDS: [number, string, string][] = [
  [90, "EUPHORIC", "everything feels possible, radiating energy"],
  [70, "HAPPY", "content, optimistic, socially warm"],
  [50, "OK", "going through the motions"],
  [30, "LOW", "withdrawn, unmotivated, hard to enjoy things"],
  [0, "CRISIS", "can't get out of bed, everything feels pointless"],
];

const MISSION_THRESHOLDS: [number, string, string][] = [
  [90, "ON_THE_VERGE", "can almost taste it"],
  [70, "DRIVEN", "real momentum, sacrifices feel worth it"],
  [50, "PURSUING", "making progress but the road is long"],
  [30, "DRIFTING", "losing sight of the dream"],
  [0, "LOST", "forgot why this mattered, existential doubt"],
];

function resolveThreshold(
  value: number | undefined,
  thresholds: [number, string, string][]
): StatusEntry {
  const v = value ?? 0;
  for (const [min, label, description] of thresholds) {
    if (v >= min) return { label, description };
  }
  const last = thresholds[thresholds.length - 1];
  return { label: last[1], description: last[2] };
}

export function interpretBeingStats(character: IBeing): StatusPraesens {
  return {
    health: resolveThreshold(character.health_index, HEALTH_THRESHOLDS),
    vibe: resolveThreshold(character.vibe_index, VIBE_THRESHOLDS),
    life_mission: resolveThreshold(
      character.life_mission?.progress,
      MISSION_THRESHOLDS
    ),
  };
}
