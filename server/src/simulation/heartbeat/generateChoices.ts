import { ObjectId } from "mongodb";
import { IBeing } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { setChoice } from "./choiceStore";
import { Signal } from "./signals";
import { StatusPraesens } from "./statusPraesens";
import { completeJSON } from "../../services/ai/openrouter";
import { io, playerSocketMap } from "../../index";

interface GenerateChoicesParams {
  character: IBeing;
  sandbox: ISandboxDocument;
  signals: Signal[];
  statusPraesens: StatusPraesens;
  heartbeatId: ObjectId;
  userID: string;
}

export async function generateChoices({
  character,
  sandbox,
  signals,
  statusPraesens,
  heartbeatId,
  userID,
}: GenerateChoicesParams): Promise<void> {
  try {
    character.active_heartbeat_id = heartbeatId;
    character.is_processing = true;
    await character.save();

    const signalDescriptions = signals
      .map((s) => `${s.type}: ${JSON.stringify(s.payload)}`)
      .join("; ");

    const prompt = `You are generating life choices for a character in a life simulation.

CHARACTER:
Name: ${character.first_name} ${character.last_name}
Occupation: ${character.occupation || "Unknown"}
City: ${character.current_city || character.home_city}
Health: ${statusPraesens.health.label} — ${statusPraesens.health.description}
Vibe: ${statusPraesens.vibe.label} — ${statusPraesens.vibe.description}
Mission: ${character.life_mission?.name || "None"} (${statusPraesens.life_mission.label})
Soul: ${character.soul_md || "Unknown"}
Recent life: ${(character.life_md || "").slice(-500)}

SIGNALS FIRED: ${signalDescriptions}
DATE: ${sandbox.current_month}/${sandbox.current_day}/${sandbox.current_year}

Generate a crossroads moment. Return JSON with:
- situation: 1 sentence describing the moment
- option_a: { action, place, health_impact (-10 to 10), vibe_impact (-10 to 10), wealth_impact (-500 to 500), life_mission_impact (-5 to 5), reaction (1 sentence) }
- option_b: { action, place, health_impact, vibe_impact, wealth_impact, life_mission_impact, reaction }

Options should be meaningfully different — one safe, one risky. Impacts should be realistic.`;

    const response = await completeJSON<{
      situation: string;
      option_a: {
        action: string;
        place: string;
        health_impact: number;
        vibe_impact: number;
        wealth_impact: number;
        life_mission_impact: number;
        reaction: string;
      };
      option_b: {
        action: string;
        place: string;
        health_impact: number;
        vibe_impact: number;
        wealth_impact: number;
        life_mission_impact: number;
        reaction: string;
      };
    }>({
      model: "fast",
      systemPrompt: "You are a narrative engine for a life simulation. Generate meaningful crossroads moments.",
      userPrompt: prompt,
    });

    setChoice(heartbeatId, response);

    character.is_processing = false;
    await character.save();

    const socketId = playerSocketMap.get(userID);
    if (socketId && io) {
      io.to(socketId).emit("choices_ready", {
        characterId: character._id.toString(),
        heartbeatId: heartbeatId.toString(),
        choices: response,
        signals,
      });
    }
  } catch (error) {
    console.error("generateChoices failed:", error);
    character.is_processing = false;
    character.active_heartbeat_id = undefined;
    await character.save();
  }
}
