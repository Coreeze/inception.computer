import { Being } from "../../database/models/being";
import { completeJSON } from "../ai/openrouter";
import { IBeing } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { generateBeingPortraitBackground } from "../ai/portraitGenerator";

interface SpawnedNPC {
  first_name: string;
  last_name: string;
  occupation: string;
  relationship_to_main_character: string;
  relationship_index: number;
  soul_md: string;
  life_md: string;
  home_city: string;
  home_country: string;
  home_longitude: number;
  home_latitude: number;
  life_mission: string;
}

export async function spawnNPCs({
  userID,
  mainCharacterID,
  sandbox,
  playerCity,
  playerCountry,
  playerLon,
  playerLat,
  count = 10,
}: {
  userID: any;
  mainCharacterID: any;
  sandbox: ISandboxDocument;
  playerCity: string;
  playerCountry: string;
  playerLon: number;
  playerLat: number;
  count?: number;
}): Promise<IBeing[]> {
  const response = await completeJSON<{ npcs: SpawnedNPC[] }>({
    model: "fast",
    systemPrompt: `You generate diverse NPCs for a life simulation.
    Return JSON: { "npcs": [{ "first_name", "last_name", "occupation", "relationship_to_main_character", "relationship_index", "soul_md": "2 sentences about personality", "life_md": "2 sentences about current life", "home_city", "home_country", "home_longitude", "home_latitude", "life_mission": "1 compressed relevant sentence about the NPC's life mission" }] }
    Coordinates must be near ${playerCity}, ${playerCountry}. Use real places. Longitude -180 to 180, latitude -90 to 90.`,
    userPrompt: `Generate exactly ${count} diverse NPCs living in or near ${playerCity}, ${playerCountry}. 
    Mix occupations: barista, teacher, artist, nurse, developer, chef, etc.
    Each has a distinct personality (soul_md) and current situation (life_md). Each has a life mission (life_mission).
    Spread them across different neighborhoods. Player is at (${playerLon}, ${playerLat}).`,
    maxTokens: 4096,
  });

  const npcs = response.npcs?.slice(0, count) || [];
  const docs = npcs.map((n) => ({
    user: userID,
    sandbox: sandbox._id,
    main_character: mainCharacterID,
    species: "human",
    self_awareness: "unaware" as const,
    is_main: false,
    first_name: n.first_name?.trim() || "Unknown",
    last_name: n.last_name?.trim() || "",
    occupation: n.occupation || "Unknown",
    relationship_to_main_character: n.relationship_to_main_character || "stranger",
    relationship_index: Math.min(100, Math.max(0, n.relationship_index ?? 0)),
    soul_md: n.soul_md || "",
    life_md: n.life_md || "",
    home_city: n.home_city || playerCity,
    home_country: n.home_country || playerCountry,
    home_longitude: clamp(n.home_longitude, -180, 180) ?? playerLon,
    home_latitude: clamp(n.home_latitude, -90, 90) ?? playerLat,
    current_longitude: clamp(n.home_longitude, -180, 180) ?? playerLon,
    current_latitude: clamp(n.home_latitude, -90, 90) ?? playerLat,
    previous_longitude: clamp(n.home_longitude, -180, 180) ?? playerLon,
    previous_latitude: clamp(n.home_latitude, -90, 90) ?? playerLat,
    health_index: 70 + Math.floor(Math.random() * 25),
    vibe_index: 60 + Math.floor(Math.random() * 35),
    wealth_index: 2000 + Math.floor(Math.random() * 8000),
    monthly_income: 2000 + Math.floor(Math.random() * 4000),
    monthly_expenses: 1000 + Math.floor(Math.random() * 3000),
    life_mission: {
      name: n.life_mission?.trim(),
      progress: 50,
    },
    ai_action_queue: [],
  }));

  if (docs.length === 0) return [];

  const created = (await Being.insertMany(docs, { ordered: false })) as IBeing[];
  for (const npc of created) {
    generateBeingPortraitBackground(npc._id.toString());
  }
  return created;
}

function clamp(n: number | undefined, min: number, max: number): number | undefined {
  if (n == null || isNaN(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}
