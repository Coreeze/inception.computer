import { Request, Response } from "express";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { User } from "../../database/models/user";
import { Chat } from "../../database/models/chat";
import { getChoice, deleteChoice } from "../../simulation/heartbeat/choiceStore";
import {
  applyRuntimeAction,
} from "../../socket/sessionManager";
import {
  startHeartbeatScheduler,
  stopHeartbeatScheduler,
} from "../../simulation/heartbeat/heartbeatScheduler";
import { applyMissionProgressChange } from "../../simulation/subscribers/beingDecay";
import { MilestoneEvent } from "../../simulation/heartbeat/heartbeatSubscribers";
import { completeJSON } from "../../services/ai/openrouter";
import { stringifyCharacter, stringifyNPC } from "../../services/character/serialize";
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
      deleteChoice(heartbeatId);
      return res.json({ success: true, resolution: "ignore" });
    }

    if (choice !== "option_a" && choice !== "option_b") {
      return res.status(400).json({ error: "Invalid choice." });
    }

    const choices = getChoice(heartbeatId);
    if (!choices) {
      character.active_heartbeat_id = undefined;
      await character.save();
      return res.status(404).json({ error: "Choice data not found" });
    }

    const choiceData = (choices as any)?.[choice];
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
    deleteChoice(heartbeatId);

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

export const sendChatMessageEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, npcID, content } = req.body;
    const message = typeof content === "string" ? content.trim() : "";
    if (!playerID || !characterID || !npcID || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (message.length > 600) {
      return res.status(400).json({ error: "Message too long (max 600 chars)" });
    }

    const user = await User.findOne({ player_id: playerID });
    if (!user) return res.status(404).json({ error: "Player not found" });

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });
    if (character.user?.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Character does not belong to player" });
    }

    const npc = await Being.findOne({
      _id: npcID,
      main_character: character._id,
      is_deleted: { $ne: true },
      is_dead: { $ne: true },
    });
    if (!npc) return res.status(404).json({ error: "NPC not found" });

    const userMessage = await Chat.create({
      user: user._id,
      main_character: character._id,
      type: "text",
      channel: "texting",
      sender: "user",
      sender_id: npc._id,
      content: message,
    });

    const recentChats = await Chat.find({
      main_character: character._id,
      sender_id: npc._id,
      type: "text",
      channel: "texting",
      sender: { $in: ["user", "npc"] },
    })
      .sort({ createdAt: -1 })
      .limit(12);

    const transcript = recentChats
      .reverse()
      .map((c) => `${c.sender}: ${c.content}`)
      .join("\n");

    const npcReplyJSON = await completeJSON<{ reply: string }>({
      model: "fast",
      systemPrompt: "You write short in-character NPC text replies for a life simulation.",
      userPrompt: `You are replying as this NPC:\n${stringifyNPC(npc)}\n\nMain character context:\n${stringifyCharacter(character)}\n\nConversation so far:\n${transcript}\n\nLatest user message:\n${message}\n\nReturn JSON only: {"reply":"..."}.\nRules: 1-3 short sentences. Stay in-character. No markdown. No emojis.`,
      maxTokens: 300,
    });

    const npcReply = (npcReplyJSON.reply || "").trim();
    if (!npcReply) {
      return res.status(500).json({ error: "NPC reply generation failed" });
    }

    const npcMessage = await Chat.create({
      user: user._id,
      main_character: character._id,
      type: "text",
      channel: "texting",
      sender: "npc",
      sender_id: npc._id,
      content: npcReply,
    });

    npc.chat_count = (npc.chat_count || 0) + 1;
    npc.last_contact_at = new Date();
    await npc.save();

    const chats = [userMessage, npcMessage];
    return res.json({ chats });
  } catch (error: any) {
    console.error("Send chat message error:", error);
    return res.status(400).json({ error: error.message });
  }
};
