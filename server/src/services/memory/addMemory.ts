import { ObjectId } from "mongodb";
import { Memory, IMemory } from "../../database/models/memory";
import { IBeing } from "../../database/models/being";

/**
 * Inception memory system — memory_md with importance scoring 1-5.
 *
 * Retrieval score = importance × decay_factor × recency_weight
 * Importance 1-2: compressed periodically
 * Importance 4-5: persist indefinitely
 */

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const words1 = new Set(cleanText(a).split(" "));
  const words2 = new Set(cleanText(b).split(" "));
  const intersection = [...words1].filter((w) => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function addMemory({
  userID,
  mainCharacterID,
  ownerID,
  memoryMd,
  importance,
  type,
  involvedBeings = [],
  involvedPlaces = [],
  simYear,
  simMonth,
  simDay,
  tags = [],
}: {
  userID: string | ObjectId;
  mainCharacterID: string | ObjectId;
  ownerID: string | ObjectId;
  memoryMd: string;
  importance: number;
  type: "observation" | "reflection" | "conversation" | "event" | "emotion";
  involvedBeings?: (string | ObjectId)[];
  involvedPlaces?: (string | ObjectId)[];
  simYear?: number;
  simMonth?: number;
  simDay?: number;
  tags?: string[];
}): Promise<IMemory | null> {
  if (!memoryMd || memoryMd.trim() === "") return null;

  const existing = await Memory.find({
    owner: ownerID,
    main_character: mainCharacterID,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  for (const mem of existing) {
    if (jaccardSimilarity(mem.memory_md, memoryMd) > 0.7) {
      await Memory.findByIdAndUpdate(mem._id, {
        $inc: { retrieval_count: 1 },
        $set: { sim_year: simYear, sim_month: simMonth, sim_day: simDay },
      });
      return null;
    }
  }

  const memory = await Memory.create({
    user: userID,
    main_character: mainCharacterID,
    owner: ownerID,
    memory_md: memoryMd,
    importance: Math.max(1, Math.min(5, Math.round(importance))),
    type,
    involved_beings: involvedBeings,
    involved_places: involvedPlaces,
    sim_year: simYear,
    sim_month: simMonth,
    sim_day: simDay,
    tags,
  });

  return memory;
}

/**
 * Retrieve most relevant memories for a being.
 * Score = importance × decay_factor × recency_weight
 */
export async function retrieveMemories({
  ownerID,
  mainCharacterID,
  limit = 10,
  types,
}: {
  ownerID: string | ObjectId;
  mainCharacterID: string | ObjectId;
  limit?: number;
  types?: string[];
}): Promise<IMemory[]> {
  const filter: any = {
    owner: ownerID,
    main_character: mainCharacterID,
    is_compressed: { $ne: true },
  };
  if (types && types.length > 0) {
    filter.type = { $in: types };
  }

  const memories = await Memory.find(filter)
    .sort({ importance: -1, createdAt: -1 })
    .limit(limit * 2)
    .lean() as unknown as IMemory[];

  const now = Date.now();
  const scored = memories.map((m) => {
    const ageMs = now - new Date(m.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.1, 1 - ageDays / 365);
    const score = m.importance * m.decay_factor * recencyWeight;
    return { memory: m, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topMemories = scored.slice(0, limit).map((s) => s.memory);

  if (topMemories.length > 0) {
    const ids = topMemories.map((m) => m._id);
    await Memory.updateMany(
      { _id: { $in: ids } },
      { $inc: { retrieval_count: 1 } }
    );
  }

  return topMemories;
}

/**
 * Apply decay to all memories for a sandbox.
 * Called periodically (e.g. every 30 heartbeats).
 */
export async function decayMemories(
  mainCharacterID: string | ObjectId
): Promise<void> {
  await Memory.updateMany(
    {
      main_character: mainCharacterID,
      importance: { $lte: 3 },
      decay_factor: { $gt: 0.05 },
    },
    { $mul: { decay_factor: 0.95 } }
  );
}
