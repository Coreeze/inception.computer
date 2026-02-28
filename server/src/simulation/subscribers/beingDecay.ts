import {
  HeartbeatSubscriber,
  HeartbeatContext,
  MilestoneEvent,
} from "../heartbeat/heartbeatSubscribers";
import { DECAY_RATES } from "../constants";
import { IBeing } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyHealthChange(character: IBeing, amount: number): void {
  character.health_index =
    Math.round(
      clamp((character.health_index || 0) + amount, 0, 100) * 10
    ) / 10;
}

export function applyVibeChange(character: IBeing, amount: number): void {
  character.vibe_index =
    Math.round(
      clamp((character.vibe_index || 0) + amount, 0, 100) * 10
    ) / 10;
}

export function applyWealthChange(character: IBeing, amount: number): void {
  character.wealth_index = Math.round(
    (character.wealth_index || 0) + amount
  );
}

export function applyMissionProgressChange(
  character: IBeing,
  amount: number
): MilestoneEvent | null {
  if (!character.life_mission) return null;
  const prev = character.life_mission.progress || 0;
  character.life_mission.progress = clamp(prev + amount, 0, 100);
  if (prev < 100 && character.life_mission.progress >= 100) {
    return {
      type: "life_mission_completed",
      data: { mission: character.life_mission.name },
    };
  }
  return null;
}

export function deathCheck({
  character,
  sandbox,
}: {
  character: IBeing;
  sandbox: ISandboxDocument;
}): boolean {
  if (
    (character.health_index ?? 50) <= 0 ||
    (character.vibe_index ?? 50) <= 0
  ) {
    character.is_dead = true;
    character.death_year = sandbox.current_year;
    character.death_month = sandbox.current_month;
    character.death_day = sandbox.current_day;
    return true;
  }
  return false;
}

export const beingDecay: HeartbeatSubscriber = {
  name: "being_decay",
  onHeartbeat(context: HeartbeatContext) {
    const { character, npcs, milestoneEvents } = context;

    applyHealthChange(character, -DECAY_RATES.health);
    applyVibeChange(character, -DECAY_RATES.vibe);

    if (deathCheck({ character, sandbox: context.sandbox })) return;

    const dailyExpense = (character.monthly_expenses || 0) / 30;
    if (dailyExpense > 0) {
      applyWealthChange(character, -dailyExpense);
    }

    const missionMilestone = applyMissionProgressChange(
      character,
      -DECAY_RATES.life_mission
    );
    if (missionMilestone) milestoneEvents.push(missionMilestone);

    if (context.heartbeatCount % 7 === 0) {
      for (const npc of npcs) {
        if (npc.relationship_index != null && npc.relationship_index > 0) {
          npc.relationship_index = Math.max(0, npc.relationship_index - 1);
        }
      }
    }

    if (context.heartbeatCount % 30 === 0) {
      const income = character.monthly_income || 0;
      if (income > 0) applyWealthChange(character, income);
    }
  },
};
