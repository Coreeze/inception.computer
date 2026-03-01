import { Request, Response } from "express";
import { User } from "../../database/models/user";
import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { Places } from "../../database/models/places";
import { completeJSON } from "../../services/ai/openrouter";

const CLASSIC_WORLD_STYLE_ID = "68d2400c61cd0dea7526beff";

/**
 * POST /sandbox-runtime/initialize
 * Creates player (User), character, sandbox, home place.
 * No auth — playerID is the identity (stored in localStorage).
 */
export const initializeEndpoint = async (req: Request, res: Response) => {
  try {
    const { playerID, first_name, last_name, soul_md, life_md, life_mission_name, home_city, home_country } = req.body;

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

    const { home_longitude, home_latitude, currency, wealth_index, monthly_income, monthly_expenses } = await completeJSON<{
      home_longitude: number;
      home_latitude: number;
      currency: string;
      wealth_index: number;
      monthly_income: number;
      monthly_expenses: number;
    }>({
      model: "fast",
      systemPrompt:
        "You are a world generator. You generate a world for a life simulation. Return JSON: { home_longitude: number, home_latitude: number, currency: string, wealth_index: number, monthly_income: number, monthly_expenses: number }",
      userPrompt:
        "Generate a world for a life simulation. The home_longitude and home_latitude must be realistic coordinates. wealth_index is absolute cash value in the currency. monthly_income is the average monthly income in the currency. monthly_expenses is the average monthly expenses in the currency.",
    });

    const sandbox = await Sandbox.create({
      user: user._id,
      artwork_style: CLASSIC_WORLD_STYLE_ID,
      start_year: 2026,
      start_month: 1,
      start_day: 1,
      current_year: 2026,
      current_month: 1,
      current_day: 1,
      day_duration_ms: 2000,
      currency: currency,
    });

    const character = await Being.create({
      user: user._id,
      sandbox: sandbox._id,
      species: "human",
      self_awareness: "aware",
      is_main: true,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      soul_md: soul_md,
      life_md: life_md,
      life_mission: {
        name: life_mission_name,
        progress: 50,
      },
      home_city: home_city.trim(),
      home_country: home_country.trim(),
      home_longitude: home_longitude,
      home_latitude: home_latitude,
      current_longitude: home_longitude,
      current_latitude: home_latitude,
      previous_longitude: home_longitude,
      previous_latitude: home_latitude,
      health_index: 75,
      vibe_index: 75,
      wealth_index: wealth_index,
      monthly_income: monthly_income,
      monthly_expenses: monthly_expenses,
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
    });

    return res.json({
      character: character.toObject(),
      sandbox: sandbox.toObject(),
      places: [homePlace.toObject()],
      npcs: [],
    });
  } catch (error: any) {
    console.error("Initialize error:", error);
    return res.status(400).json({ error: error.message });
  }
};
