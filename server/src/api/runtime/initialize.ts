import { Request, Response } from "express";
import { User } from "../../database/models/user";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { Places } from "../../database/models/places";
import { WorldStyles } from "../../database/models/worldStyles";
import { spawnNPCs } from "../../services/npc/spawnNPCs";
import { generateAllNPCPlans } from "../../services/npc/planner";

/**
 * POST /sandbox-runtime/initialize
 * Creates player (User), character, sandbox, home place.
 * No auth — playerID is the identity (stored in localStorage).
 */
export const initializeEndpoint = async (req: Request, res: Response) => {
  try {
    const {
      playerID,
      first_name,
      last_name,
      soul_md,
      life_md,
      life_mission_name,
      home_city,
      home_country,
      home_longitude,
      home_latitude,
    } = req.body;

    if (!playerID || !first_name || !last_name) {
      return res.status(400).json({ error: "playerID, first_name, last_name required" });
    }

    let user = await User.findOne({ player_id: playerID });
    if (!user) {
      user = await User.create({
        player_id: playerID,
        is_anonymous: true,
      });
    }

    let worldStyle = await WorldStyles.findOne({ user: user._id });
    if (!worldStyle) {
      worldStyle = await WorldStyles.create({
        user: user._id,
        name: "Default",
        id: "default",
        examples: ["realistic", "grounded"],
        character_prompt: "realistic human portrait",
        background_image: "",
        object_prompt: "",
        environment_prompt: "",
        place_prompt: "",
      });
    }

    const sandbox = await Sandbox.create({
      user: user._id,
      artwork_style: worldStyle._id,
      start_year: 2026,
      start_month: 1,
      start_day: 1,
      current_year: 2026,
      current_month: 1,
      current_day: 1,
      day_duration_ms: 6000,
      currency: "USD",
    });

    const character = await Being.create({
      user: user._id,
      sandbox: sandbox._id,
      species: "human",
      self_awareness: "aware",
      is_main: true,
      first_name: first_name.trim(),
      last_name: last_name?.trim() || "",
      soul_md: soul_md || "",
      life_md: life_md || "",
      life_mission: {
        name: life_mission_name || "Live a meaningful life",
        progress: 50,
      },
      home_city: home_city || "Paris",
      home_country: home_country || "France",
      home_longitude: home_longitude ?? 2.3522,
      home_latitude: home_latitude ?? 48.8566,
      current_longitude: home_longitude ?? 2.3522,
      current_latitude: home_latitude ?? 48.8566,
      previous_longitude: home_longitude ?? 2.3522,
      previous_latitude: home_latitude ?? 48.8566,
      health_index: 75,
      vibe_index: 75,
      wealth_index: 5000,
      monthly_income: 3000,
      monthly_expenses: 2000,
    });

    const homePlace = await Places.create({
      user: user._id,
      sandbox: sandbox._id,
      main_character: character._id,
      name: "Home",
      type: "home",
      is_home: true,
      longitude: character.home_longitude,
      latitude: character.home_latitude,
      city: character.home_city,
      country: character.home_country,
      introduced_via: "player_save",
    });

    let npcs: any[] = [];
    try {
      npcs = await spawnNPCs({
        userID: user._id,
        mainCharacterID: character._id,
        sandbox,
        playerCity: character.home_city || "Paris",
        playerCountry: character.home_country || "France",
        playerLon: character.home_longitude ?? 2.3522,
        playerLat: character.home_latitude ?? 48.8566,
        count: 10,
      });
      await generateAllNPCPlans({ sandbox });
    } catch (err) {
      console.error("NPC spawn/plan failed (continuing):", err);
    }

    return res.json({
      character: character.toObject(),
      sandbox: sandbox.toObject(),
      places: [homePlace.toObject()],
      npcs: npcs.map((n) => n.toObject?.() ?? n),
    });
  } catch (error: any) {
    console.error("Initialize error:", error);
    return res.status(400).json({ error: error.message });
  }
};
