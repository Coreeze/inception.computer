import { ObjectId } from "mongodb";
import { Being } from "../../database/models/being";
import { Places } from "../../database/models/places";
import { Edge } from "../../database/models/edge";
import { Event } from "../../database/models/event";

export interface WorldContext {
  character: {
    _id: string;
    first_name: string;
    last_name: string;
    occupation: string;
    soul_md: string;
    life_md: string;
    home_city: string;
    home_country: string;
    current_longitude: number;
    current_latitude: number;
    current_city?: string;
    current_country?: string;
    current_place?: string;
  } | null;
  location: { id: string; name: string; type: string } | null;
  nearbyBeings: { id: string; first_name: string; last_name: string }[];
  relationships: { id: string; type: string; toId: string; toType: string; md: string }[];
  recentEvents: { id: string; title: string; day: string }[];
}

export async function buildContext(
  sandboxID: string,
  mainCharacterID: string
): Promise<WorldContext> {
  const characterDoc = await Being.findById(mainCharacterID).lean();
  if (!characterDoc) {
    return {
      character: null,
      location: null,
      nearbyBeings: [],
      relationships: [],
      recentEvents: [],
    };
  }

  const [locationDoc, nearbyBeingsDoc, relationshipsDoc, recentEventsDoc] =
    await Promise.all([
      Places.findOne({
        sandbox: sandboxID,
        longitude: characterDoc.current_longitude,
        latitude: characterDoc.current_latitude,
      }).lean(),
      Being.find({
        sandbox: sandboxID,
        current_longitude: characterDoc.current_longitude,
        current_latitude: characterDoc.current_latitude,
        _id: { $ne: new ObjectId(mainCharacterID) },
      })
        .limit(10)
        .lean(),
      Edge.find({
        sandbox: sandboxID,
        $or: [
          { from: new ObjectId(mainCharacterID) },
          { to: new ObjectId(mainCharacterID) },
        ],
        is_active: true,
      })
        .limit(20)
        .lean(),
      Event.find({ character: new ObjectId(mainCharacterID) })
        .sort({ sim_year: -1, sim_month: -1, sim_day: -1 })
        .limit(10)
        .lean(),
    ]);

  return {
    character: {
      _id: characterDoc._id.toString(),
      first_name: characterDoc.first_name || "",
      last_name: characterDoc.last_name || "",
      occupation: characterDoc.occupation || "",
      soul_md: characterDoc.soul_md || "",
      life_md: characterDoc.life_md || "",
      home_city: characterDoc.home_city || "",
      home_country: characterDoc.home_country || "",
      current_longitude: characterDoc.current_longitude!,
      current_latitude: characterDoc.current_latitude!,
      current_city: characterDoc.current_city || "",
      current_country: characterDoc.current_country || "",
      current_place: characterDoc.current_place || "",
    },
    location: locationDoc
      ? {
          id: (locationDoc._id as ObjectId).toString(),
          name: locationDoc.name,
          type: locationDoc.type || "",
        }
      : null,
    nearbyBeings: nearbyBeingsDoc.map((b) => ({
      id: (b._id as ObjectId).toString(),
      first_name: b.first_name || "",
      last_name: b.last_name || "",
    })),
    relationships: relationshipsDoc.map((e) => ({
      id: (e._id as ObjectId).toString(),
      type: e.type,
      toId: e.to.toString(),
      toType: e.toType,
      md: e.md || "",
    })),
    recentEvents: recentEventsDoc.map((ev) => ({
      id: (ev._id as ObjectId).toString(),
      title: ev.title || "",
      day: `${ev.sim_year}-${ev.sim_month}-${ev.sim_day}`,
    })),
  };
}

export function formatContextForPrompt(context: WorldContext): string {
  const lines: string[] = [];
  if (context.character) {
    lines.push(
      `Player: ${context.character.first_name} ${context.character.last_name} (${context.character.occupation})`
    );
    lines.push(`Soul: ${context.character.soul_md}`);
    lines.push(`Life: ${context.character.life_md}`);
    lines.push(`Location: ${context.character.current_place || context.character.current_city}`);
  }
  if (context.nearbyBeings.length > 0) {
    lines.push(
      `Nearby: ${context.nearbyBeings.map((b) => `${b.first_name} ${b.last_name}`).join(", ")}`
    );
  }
  if (context.recentEvents.length > 0) {
    lines.push(
      `Recent: ${context.recentEvents.map((e) => `${e.day}: ${e.title}`).join("; ")}`
    );
  }
  return lines.join("\n");
}
