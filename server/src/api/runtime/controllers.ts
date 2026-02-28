import { Request, Response } from "express";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { LLMLog } from "../../database/models/llmLog";
import {
  applyRuntimeAction,
} from "../../socket/sessionManager";
import {
  startHeartbeatScheduler,
  stopHeartbeatScheduler,
} from "../../simulation/heartbeat/heartbeatScheduler";
import { applyMissionProgressChange } from "../../simulation/subscribers/beingDecay";
import { MilestoneEvent } from "../../simulation/heartbeat/heartbeatSubscribers";
import { io, playerSocketMap } from "../../index";

export const heartbeatEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, action } = req.body;
    if (
      !playerID ||
      !characterID ||
      (action !== "play" && action !== "pause")
    ) {
      return res.status(400).json({ error: "Missing or invalid fields." });
    }

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });

    if (character.is_dead && action === "play") {
      return res.status(403).json({ error: "Character is dead." });
    }

    const runtimeUpdate = applyRuntimeAction(
      playerID,
      character._id.toString(),
      action
    );
    if (!runtimeUpdate.ok) {
      return res.status(409).json({ error: (runtimeUpdate as any).error });
    }

    if ((runtimeUpdate as any).characterToStop) {
      stopHeartbeatScheduler((runtimeUpdate as any).characterToStop);
    }

    if (action === "play") {
      startHeartbeatScheduler(playerID, character._id.toString());
    } else {
      stopHeartbeatScheduler(character._id.toString());
    }

    const runtimeState = action === "play" ? "playing" : "paused";
    const socketId = playerSocketMap.get(playerID);
    if (socketId && io) {
      io.to(socketId).emit("runtime_status", {
        characterId: character._id.toString(),
        runtimeState,
      });
    }

    return res.json({ success: true, runtime: { runtimeState } });
  } catch (error: any) {
    console.error("Heartbeat error:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const resolveChoiceEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, choice } = req.body;
    if (!playerID || !characterID || !choice) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });

    const sandbox = await Sandbox.findById(character.sandbox);
    if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

    if (!character.active_heartbeat_id) {
      return res.status(400).json({ error: "No pending choices" });
    }

    const heartbeatId = character.active_heartbeat_id;
    const milestoneEvents: MilestoneEvent[] = [];
    const dateStr = `${sandbox.current_month}/${sandbox.current_day}/${sandbox.current_year}`;

    if (choice === "ignore") {
      character.active_heartbeat_id = undefined;
      await character.save();
      return res.json({ success: true, resolution: "ignore" });
    }

    if (choice !== "option_a" && choice !== "option_b") {
      return res.status(400).json({ error: "Invalid choice." });
    }

    const llmLog = await LLMLog.findOne({
      heartbeat_id: heartbeatId,
      call_type: "choice_generation",
    });
    if (!llmLog) {
      character.active_heartbeat_id = undefined;
      await character.save();
      return res.status(404).json({ error: "Choice data not found" });
    }

    const choiceData = (llmLog.response as any)?.[choice];
    if (!choiceData) {
      return res.status(400).json({ error: "Invalid choice option" });
    }

    if (choiceData.health_impact) {
      character.health_index = Math.round(
        Math.max(0, Math.min(100, (character.health_index || 0) + choiceData.health_impact)) * 10
      ) / 10;
    }
    if (choiceData.vibe_impact) {
      character.vibe_index = Math.round(
        Math.max(0, Math.min(100, (character.vibe_index || 0) + choiceData.vibe_impact)) * 10
      ) / 10;
    }
    if (choiceData.wealth_impact) {
      character.wealth_index = Math.round(
        (character.wealth_index || 0) + choiceData.wealth_impact
      );
    }
    if (choiceData.life_mission_impact) {
      const m = applyMissionProgressChange(character, choiceData.life_mission_impact);
      if (m) milestoneEvents.push(m);
    }

    const place = choiceData.place ? ` at ${choiceData.place}` : "";
    character.life_md =
      (character.life_md || "") +
      `\n- **${dateStr}** — *${choiceData.action}${place}.*`;

    character.active_heartbeat_id = undefined;
    await character.save();

    return res.json({
      success: true,
      resolution: choice,
      action: choiceData.action,
      milestones: milestoneEvents,
      stats: {
        health: character.health_index,
        vibe: character.vibe_index,
        money: character.wealth_index,
        life_mission: character.life_mission?.progress,
      },
    });
  } catch (error: any) {
    console.error("Resolve choice error:", error);
    return res.status(400).json({ error: error.message });
  }
};
