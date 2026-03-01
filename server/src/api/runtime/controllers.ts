import { Request, Response } from "express";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { User } from "../../database/models/user";
import { Chat } from "../../database/models/chat";
import { Places } from "../../database/models/places";
import { getChoice, deleteChoice } from "../../simulation/heartbeat/choiceStore";
import { applyRuntimeAction } from "../../socket/sessionManager";
import { startHeartbeatScheduler, stopHeartbeatScheduler } from "../../simulation/heartbeat/heartbeatScheduler";
import { applyMissionProgressChange } from "../../simulation/subscribers/beingDecay";
import { MilestoneEvent } from "../../simulation/heartbeat/heartbeatSubscribers";
import { completeJSON } from "../../services/ai/openrouter";
import { generateFlux2FastImage } from "../../services/ai/fal";
import { stringifyCharacter, stringifyNPC } from "../../services/character/serialize";
import { io, playerSocketMap } from "../../index";
import { formatSimDate } from "../../utils/formatSimDate";
import { getPlayerSession } from "../../socket/sessionManager";

const PERSISTED_PLACE_EPSILON = 0.0015;

function normalizeMapboxPlaceName(mapboxSummary: unknown): string | undefined {
  if (typeof mapboxSummary !== "string") return undefined;
  const trimmed = mapboxSummary.trim();
  if (!trimmed) return undefined;
  const withoutCategory = trimmed.replace(/\s+\([^)]*\)\s*$/, "").trim();
  return withoutCategory || undefined;
}

function buildFallbackPlaceName(latitude: number, longitude: number): string {
  return `Saved point ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function buildWhatsHerePlaceImagePrompt(params: {
  name: string;
  description?: string;
  city?: string;
  country?: string;
  mapboxSummary?: unknown;
  quickSummary?: unknown;
}): string {
  const details = [
    params.name,
    params.description || "",
    params.city || "",
    params.country || "",
    typeof params.mapboxSummary === "string" ? params.mapboxSummary.trim() : "",
    typeof params.quickSummary === "string" ? params.quickSummary.trim() : "",
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(", ");

  return `sims 4 style, no text, no logos: ${details}`;
}

async function resolveChatParticipants(playerID: string, characterID: string, npcID: string) {
  const user = await User.findOne({ player_id: playerID });
  if (!user) {
    throw new Error("Player not found");
  }
  const character = await Being.findById(characterID);
  if (!character) {
    throw new Error("Character not found");
  }
  if (character.user?.toString() !== user._id.toString()) {
    throw new Error("Character does not belong to player");
  }
  const npc = await Being.findOne({
    _id: npcID,
    main_character: character._id,
    is_deleted: { $ne: true },
    is_dead: { $ne: true },
  });
  if (!npc) {
    throw new Error("NPC not found");
  }
  return { user, character, npc };
}

async function resolvePlayerAndCharacter(playerID: string, characterID: string) {
  const user = await User.findOne({ player_id: playerID });
  if (!user) {
    throw new Error("Player not found");
  }
  const character = await Being.findById(characterID);
  if (!character) {
    throw new Error("Character not found");
  }
  if (character.user?.toString() !== user._id.toString()) {
    throw new Error("Character does not belong to player");
  }
  return { user, character };
}

function buildBeingImagePrompt(being: any): string {
  const details = [
    `${(being.first_name || "").trim()} ${(being.last_name || "").trim()}`.trim(),
    being.gender || "",
    being.occupation || "",
    being.description || "",
    being.body_type || "",
    being.skin_tone || "",
    being.hair_color || "",
    being.hair_type || "",
    being.eye_color || "",
    being.eye_emotions || "",
    typeof being.glasses === "boolean" ? (being.glasses ? "wearing glasses" : "no glasses") : "",
    being.current_city && being.current_country ? `living in ${being.current_city}, ${being.current_country}` : "",
  ]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const fallback = "a human character portrait with visible full body and grounded everyday outfit";
  return details.length > 0 ? details.join(", ") : fallback;
}

function buildPlaceImagePrompt(place: any): string {
  const details = [
    place.name || "",
    place.type || "",
    place.description || "",
    place.city || "",
    place.country || "",
    place.appearance_prompt || "",
    Array.isArray(place.tags) ? place.tags.join(", ") : "",
  ]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const fallback = "an outdoor place in a life simulation world, realistic details and atmosphere";
  return details.length > 0 ? details.join(", ") : fallback;
}

export const heartbeatEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, action } = req.body;
    if (!playerID || !characterID || (action !== "play" && action !== "pause")) {
      return res.status(400).json({ error: "Missing or invalid fields." });
    }

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });

    if (character.is_dead && action === "play") {
      return res.status(403).json({ error: "Character is dead." });
    }

    const runtimeUpdate = applyRuntimeAction(playerID, character._id.toString(), action);
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
    const dateStr = formatSimDate(sandbox.current_year, sandbox.current_month, sandbox.current_day);

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
      character.health_index = Math.round(Math.max(0, Math.min(100, (character.health_index || 0) + choiceData.health_impact)) * 10) / 10;
    }
    if (choiceData.vibe_impact) {
      character.vibe_index = Math.round(Math.max(0, Math.min(100, (character.vibe_index || 0) + choiceData.vibe_impact)) * 10) / 10;
    }
    if (choiceData.wealth_impact) {
      character.wealth_index = Math.round((character.wealth_index || 0) + choiceData.wealth_impact);
    }
    if (choiceData.life_mission_impact) {
      const m = applyMissionProgressChange(character, choiceData.life_mission_impact);
      if (m) milestoneEvents.push(m);
    }

    const place = choiceData.place ? ` at ${choiceData.place}` : "";
    character.life_md = (character.life_md || "") + `\n- **${dateStr}** — *${choiceData.action}${place}.*`;

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
    const { playerID, characterID, npcID, content, kind, imagePrompt, imageURL } = req.body;
    const messageKind = kind === "image" ? "image" : "text";
    const textMessage = typeof content === "string" ? content.trim() : "";
    const imagePromptMessage = typeof imagePrompt === "string" ? imagePrompt.trim() : "";
    const selectedImageURL = typeof imageURL === "string" ? imageURL.trim() : "";
    if (!playerID || !characterID || !npcID) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (messageKind === "text" && !textMessage) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (messageKind === "image" && !imagePromptMessage) {
      return res.status(400).json({ error: "Image prompt is required" });
    }
    if (messageKind === "image" && !selectedImageURL) {
      return res.status(400).json({ error: "Generated image is required" });
    }
    if (textMessage.length > 600) {
      return res.status(400).json({ error: "Message too long (max 600 chars)" });
    }
    if (imagePromptMessage.length > 400) {
      return res.status(400).json({ error: "Image prompt too long (max 400 chars)" });
    }

    const { user, character, npc } = await resolveChatParticipants(playerID, characterID, npcID);

    const userMessageData: Record<string, unknown> = {
      user: user._id,
      main_character: character._id,
      type: messageKind,
      channel: "texting",
      sender: "user",
      sender_id: npc._id,
      content: messageKind === "image" ? imagePromptMessage : textMessage,
    };

    if (messageKind === "image") {
      userMessageData.image_url = selectedImageURL;
    }

    const userMessage = await Chat.create(userMessageData);

    const recentChats = await Chat.find({
      main_character: character._id,
      sender_id: npc._id,
      channel: "texting",
      sender: { $in: ["user", "npc"] },
    })
      .sort({ createdAt: -1 })
      .limit(12);

    const transcript = recentChats
      .reverse()
      .map((c) => {
        if (c.type === "image") {
          return `${c.sender}: [Image sent] Prompt: ${c.content}`;
        }
        return `${c.sender}: ${c.content}`;
      })
      .join("\n");

    const latestUserMessageContext = messageKind === "image" ? `[Image sent] Prompt: ${imagePromptMessage}` : textMessage;

    const npcReplyJSON = await completeJSON<{ reply: string }>({
      model: "fast",
      systemPrompt: "You write short in-character NPC text replies for a life simulation.",
      userPrompt: `You are replying as this NPC:\n${stringifyNPC(npc)}\n\nMain character context:\n${stringifyCharacter(
        character
      )}\n\nConversation so far:\n${transcript}\n\nLatest user message:\n${latestUserMessageContext}\n\nReturn JSON only: {"reply":"..."}.\nRules: 1-3 short sentences. Stay in-character. No markdown. No emojis.`,
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
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "NPC not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const generateChatImagePreviewEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, npcID, imagePrompt } = req.body;
    const prompt = typeof imagePrompt === "string" ? imagePrompt.trim() : "";
    if (!playerID || !characterID || !npcID || !prompt) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (prompt.length > 400) {
      return res.status(400).json({ error: "Image prompt too long (max 400 chars)" });
    }

    await resolveChatParticipants(playerID, characterID, npcID);
    const imageUrl = await generateFlux2FastImage(prompt);
    return res.json({ imageUrl });
  } catch (error: any) {
    console.error("Generate chat image preview error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "NPC not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const generateBeingImageEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, beingID } = req.body;
    if (!playerID || !characterID || !beingID) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { character } = await resolvePlayerAndCharacter(playerID, characterID);
    const targetBeing =
      character._id.toString() === beingID
        ? character
        : await Being.findOne({
            _id: beingID,
            main_character: character._id,
            is_deleted: { $ne: true },
            is_dead: { $ne: true },
          });

    if (!targetBeing) {
      return res.status(404).json({ error: "Being not found" });
    }

    if (targetBeing.image_url) {
      return res.json({ imageUrl: targetBeing.image_url });
    }

    const prompt = buildBeingImagePrompt(targetBeing);
    const imageUrl = await generateFlux2FastImage(prompt, { imageSize: "portrait_16_9" });
    targetBeing.image_url = imageUrl;
    await targetBeing.save();

    return res.json({ imageUrl });
  } catch (error: any) {
    console.error("Generate being image error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const generatePlaceImageEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, placeID } = req.body;
    if (!playerID || !characterID || !placeID) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { character } = await resolvePlayerAndCharacter(playerID, characterID);
    const place = await Places.findOne({
      _id: placeID,
      main_character: character._id,
    });

    if (!place) {
      return res.status(404).json({ error: "Place not found" });
    }

    if (place.image_url) {
      return res.json({ imageUrl: place.image_url });
    }

    const prompt = buildPlaceImagePrompt(place);
    const imageUrl = await generateFlux2FastImage(prompt, { imageSize: "portrait_16_9" });
    place.image_url = imageUrl;
    await place.save();

    return res.json({ imageUrl });
  } catch (error: any) {
    console.error("Generate place image error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const travelCharacterEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, longitude, latitude } = req.body;

    if (!playerID || !characterID || typeof longitude !== "number" || typeof latitude !== "number") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: "Coordinates out of range" });
    }

    const user = await User.findOne({ player_id: playerID });
    if (!user) return res.status(404).json({ error: "Player not found" });

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });
    if (character.user?.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Character does not belong to player" });
    }
    if (character.is_dead) return res.status(403).json({ error: "Character is dead." });

    character.previous_longitude = character.current_longitude;
    character.previous_latitude = character.current_latitude;
    character.current_longitude = longitude;
    character.current_latitude = latitude;
    character.current_place = undefined;
    character.current_city = undefined;
    character.current_country = undefined;
    character.current_action = "traveling";
    character.current_action_updated_at = new Date();
    await character.save();

    return res.json({
      success: true,
      characterAction: {
        current_action: character.current_action,
        current_longitude: character.current_longitude,
        current_latitude: character.current_latitude,
        current_place: character.current_place,
        current_city: character.current_city,
        current_country: character.current_country,
        player_action_queue: character.player_action_queue || [],
      },
    });
  } catch (error: any) {
    console.error("Travel character error:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const whatsHereEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, longitude, latitude, quickSummary, mapboxSummary } = req.body;

    if (!playerID || !characterID || typeof longitude !== "number" || typeof latitude !== "number") {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: "Coordinates out of range" });
    }

    const user = await User.findOne({ player_id: playerID });
    if (!user) return res.status(404).json({ error: "Player not found" });

    const character = await Being.findById(characterID);
    if (!character) return res.status(404).json({ error: "Character not found" });
    if (character.user?.toString() !== user._id.toString()) {
      return res.status(403).json({ error: "Character does not belong to player" });
    }

    const allPlaces = await Places.find({
      main_character: character._id,
      is_deleted: { $ne: true },
    }).select("name city country longitude latitude");

    const nearbyNPCs = await Being.find({
      main_character: character._id,
      is_deleted: { $ne: true },
      is_dead: { $ne: true },
    }).select("first_name last_name current_action current_longitude current_latitude");

    const placeContext = allPlaces
      .slice(0, 25)
      .map((p) => {
        const lon = typeof p.longitude === "number" ? p.longitude.toFixed(4) : "n/a";
        const lat = typeof p.latitude === "number" ? p.latitude.toFixed(4) : "n/a";
        return `${p.name || "Unknown"} (${lat}, ${lon})`;
      })
      .join(", ");

    const npcContext = nearbyNPCs
      .slice(0, 25)
      .map((n) => {
        const name = `${n.first_name || ""} ${n.last_name || ""}`.trim() || "Unknown";
        const lon = typeof n.current_longitude === "number" ? n.current_longitude.toFixed(4) : "n/a";
        const lat = typeof n.current_latitude === "number" ? n.current_latitude.toFixed(4) : "n/a";
        return `${name} [${n.current_action || "idle"}] (${lat}, ${lon})`;
      })
      .join(", ");

    const generated = await completeJSON<{ description: string }>({
      model: "fast",
      systemPrompt: "You write short location flavor text for a life simulation map. Return strict JSON with key 'description'.",
      userPrompt: [
        `Coordinates: latitude ${latitude.toFixed(6)}, longitude ${longitude.toFixed(6)}.`,
        `Quick summary from UI: ${typeof quickSummary === "string" ? quickSummary : "none"}`,
        `Mapbox metadata summary: ${typeof mapboxSummary === "string" ? mapboxSummary : "none"}`,
        `Known places context: ${placeContext || "none"}`,
        `Known NPC context: ${npcContext || "none"}`,
        "Write 1-2 short sentences. Keep it grounded and concrete. No markdown. No emojis.",
        'Return JSON only: {"description":"..."}',
      ].join("\n"),
      maxTokens: 220,
    });

    const description = (generated?.description || "").trim();
    const normalizedName = normalizeMapboxPlaceName(mapboxSummary) || buildFallbackPlaceName(latitude, longitude);
    let persistedPlace: any = null;

    try {
      const nearbyPlaces = await Places.find({
        main_character: character._id,
        latitude: { $gte: latitude - PERSISTED_PLACE_EPSILON, $lte: latitude + PERSISTED_PLACE_EPSILON },
        longitude: { $gte: longitude - PERSISTED_PLACE_EPSILON, $lte: longitude + PERSISTED_PLACE_EPSILON },
      }).limit(20);

      const normalizedNameLower = normalizedName.toLowerCase();
      const existingByName = nearbyPlaces.find((place) => (place.name || "").trim().toLowerCase() === normalizedNameLower);
      const existing = existingByName || nearbyPlaces[0];

      if (existing) {
        const nextDescription = description || existing.description;
        const shouldUpdateDescription = !!nextDescription && nextDescription !== existing.description;
        const shouldUpdateName = (existing.name || "").trim().toLowerCase() !== normalizedNameLower;
        if (shouldUpdateDescription || shouldUpdateName) {
          if (shouldUpdateDescription) existing.description = nextDescription;
          if (shouldUpdateName) existing.name = normalizedName;
          await existing.save();
        }
        persistedPlace = existing;
      } else {
        persistedPlace = await Places.create({
          user: character.user,
          sandbox: character.sandbox,
          main_character: character._id,
          name: normalizedName,
          description: description || undefined,
          latitude,
          longitude,
          introduced_via: "player_save",
          introduced_by: character._id,
          md: [
            "Saved from map interaction.",
            typeof mapboxSummary === "string" && mapboxSummary.trim() ? `Mapbox summary: ${mapboxSummary.trim()}` : "",
            typeof quickSummary === "string" && quickSummary.trim() ? `Quick summary: ${quickSummary.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }

      if (persistedPlace && !persistedPlace.image_url) {
        const imagePrompt = buildWhatsHerePlaceImagePrompt({
          name: persistedPlace.name || normalizedName,
          description: persistedPlace.description || description || undefined,
          city: persistedPlace.city || undefined,
          country: persistedPlace.country || undefined,
        });
        try {
          const imageUrl = await generateFlux2FastImage(imagePrompt, { imageSize: "landscape_16_9" });
          if (imageUrl) {
            persistedPlace.image_url = imageUrl;
            await persistedPlace.save();
          }
        } catch (imageError) {
          console.error("Whats-here place image generation failed:", imageError);
        }
      }
    } catch (persistError) {
      console.error("Persist whats-here place error:", persistError);
    }

    return res.json({
      description: description || "No additional context available right now.",
      place: persistedPlace
        ? {
            _id: persistedPlace._id.toString(),
            name: persistedPlace.name,
            type: persistedPlace.type,
            longitude: persistedPlace.longitude,
            latitude: persistedPlace.latitude,
            image_url: persistedPlace.image_url,
            description: persistedPlace.description,
            city: persistedPlace.city,
            country: persistedPlace.country,
            is_home: persistedPlace.is_home,
            is_work: persistedPlace.is_work,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Whats here error:", error);
    return res.status(400).json({ error: error.message });
  }
};

export const setFreeWillEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, enabled } = req.body;
    if (!playerID || !characterID || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { character } = await resolvePlayerAndCharacter(playerID, characterID);
    const sandbox = await Sandbox.findById(character.sandbox);
    if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

    sandbox.free_will_enabled = enabled;
    await sandbox.save();

    return res.json({ success: true, free_will_enabled: sandbox.free_will_enabled });
  } catch (error: any) {
    console.error("Set free will error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const doStuffSuggestEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID } = req.body;
    if (!playerID || !characterID) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const session = getPlayerSession(playerID);
    if (!session?.isPlaying) {
      return res.status(409).json({ error: "Simulation must be playing" });
    }

    const { character } = await resolvePlayerAndCharacter(playerID, characterID);
    if (character.is_dead) return res.status(403).json({ error: "Character is dead." });

    const sandbox = await Sandbox.findById(character.sandbox);
    if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

    const npcs = await Being.find({
      main_character: character._id,
      is_deleted: { $ne: true },
      is_dead: { $ne: true },
    }).select("first_name last_name occupation current_action current_city current_country");

    const npcContext = npcs
      .slice(0, 15)
      .map((n) => `${n.first_name || ""} ${n.last_name || ""} (${n.occupation || "unknown"})`.trim())
      .join(", ");

    const dateStr = formatSimDate(sandbox.current_year, sandbox.current_month, sandbox.current_day);

    const response = await completeJSON<{
      option_a: {
        action: string;
        reason: string;
        city: string;
        country: string;
        place: string;
        longitude: number;
        latitude: number;
        action_type?: string;
        discovery_person?: any;
        discovery_place?: any;
        purchase?: any;
        pet?: any;
      };
      option_b: {
        action: string;
        reason: string;
        city: string;
        country: string;
        place: string;
        longitude: number;
        latitude: number;
        action_type?: string;
        discovery_person?: any;
        discovery_place?: any;
        purchase?: any;
        pet?: any;
      };
    }>({
      model: "fast",
      systemPrompt: "You suggest 2 short life-simulation actions grounded in the character's mission, needs, and context. Return strict JSON only.",
      userPrompt: `CHARACTER:
Name: ${character.first_name} ${character.last_name}
Occupation: ${character.occupation || "Unknown"}
Location: ${character.current_place || character.current_city || "Unknown"}, ${character.current_country || "Unknown"} (${
        character.current_longitude
      }, ${character.current_latitude})
Health: ${character.health_index ?? 0}/100
Vibe: ${character.vibe_index ?? 0}/100
Wealth: ${character.wealth_index ?? 0}
Mission: ${character.life_mission?.name || "None"} (progress: ${character.life_mission?.progress ?? 0})
Soul: ${(character.soul_md || "").slice(0, 120)}
Recent life: ${(character.life_md || "").slice(-200)}
Known people: ${npcContext || "none"}
DATE: ${dateStr}

Suggest exactly 2 actions. One should be low-friction (near current location), the other more ambitious.
Most actions in real life involve discovering new places or meeting new people — prefer discover_place and discover_person over plain "move".
Only use "move" if revisiting a known location with no new interaction.
If discover_person, include discovery_person: {first_name, last_name, description, occupation}. Make them a unique, plausible individual.
If discover_place, include discovery_place: {name, description, latitude, longitude}. Use a real, specific place with real coordinates.
If adopt_pet, include pet: {species, name, acquisition_mode: "meet"|"buy"|"adopt"}.
If buy, include purchase: {object_type, name, price, description}.

action: first person, max 5 words, -ing verbs.
reason: first person, exactly 7 words.
Return JSON: {"option_a":{...},"option_b":{...}}
Strict JSON only. No markdown. Minified.`,
      maxTokens: 800,
    });

    return res.json({ suggestions: response });
  } catch (error: any) {
    console.error("Do stuff suggest error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};

export const doStuffSelectEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, characterID, selectedAction } = req.body;
    if (!playerID || !characterID || !selectedAction) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const session = getPlayerSession(playerID);
    if (!session?.isPlaying) {
      return res.status(409).json({ error: "Simulation must be playing" });
    }

    const { character } = await resolvePlayerAndCharacter(playerID, characterID);
    if (character.is_dead) return res.status(403).json({ error: "Character is dead." });

    const action = {
      action: selectedAction.action,
      place: selectedAction.place,
      reason: selectedAction.reason,
      country: selectedAction.country,
      city: selectedAction.city,
      longitude: selectedAction.longitude,
      latitude: selectedAction.latitude,
      action_type: selectedAction.action_type,
      discovery_place: selectedAction.discovery_place,
      discovery_person: selectedAction.discovery_person,
      purchase: selectedAction.purchase,
      pet: selectedAction.pet,
    };

    const queue = character.player_action_queue || [];
    if (queue.length === 0) {
      character.current_action = action.action;
      character.current_longitude = action.longitude ?? character.current_longitude;
      character.current_latitude = action.latitude ?? character.current_latitude;
      character.current_place = action.place;
      character.current_city = action.city;
      character.current_country = action.country;
      character.current_action_updated_at = new Date();
      queue.push(action);
    } else {
      queue.push(action);
    }
    character.player_action_queue = queue;
    await character.save();

    return res.json({
      success: true,
      characterAction: {
        current_action: character.current_action,
        current_longitude: character.current_longitude,
        current_latitude: character.current_latitude,
        current_place: character.current_place,
        current_city: character.current_city,
        current_country: character.current_country,
        player_action_queue: character.player_action_queue || [],
      },
    });
  } catch (error: any) {
    console.error("Do stuff select error:", error);
    const message = error?.message || "Request failed";
    if (message === "Player not found") return res.status(404).json({ error: message });
    if (message === "Character not found") return res.status(404).json({ error: message });
    if (message === "Character does not belong to player") return res.status(403).json({ error: message });
    return res.status(400).json({ error: message });
  }
};
