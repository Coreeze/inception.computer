import { ObjectId } from "mongodb";
import { Being, IBeing, IPlannedAction } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { WorldHistory } from "../../database/models/worldHistory";
import { completeJSON } from "../ai/openrouter";
import { MAX_AI_QUEUE_SIZE } from "../../simulation/constants";
import { getSandboxContext } from "../sandbox/sandboxContext";

function getSimDateWithOffset(
  startYear: number,
  startMonth: number,
  startDay: number,
  dayOffset: number
): { year: number; month: number; day: number } {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (isLeapYear(startYear)) daysInMonth[1] = 29;

  let year = startYear;
  let month = startMonth;
  let day = startDay + dayOffset;

  while (day > daysInMonth[month - 1]) {
    day -= daysInMonth[month - 1];
    month++;
    if (month > 12) {
      month = 1;
      year++;
      daysInMonth[1] = isLeapYear(year) ? 29 : 28;
    }
  }
  return { year, month, day };
}

interface WeeklyPlanAction {
  action: string;
  reason: string;
  city: string;
  country: string;
  place: string;
  longitude: number;
  latitude: number;
  action_type?: "move" | "discover_place" | "discover_person" | "buy" | "event";
  discovery_place?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovery_person?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchase?: { object_type: string; name: string; price: number; description?: string };
  event_participants?: string[];
  discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchased_objects?: { object_type: string; name: string; price: number; description?: string };
  attended_events?: string[];
}

interface BatchPlanEntry {
  npc_id: string;
  actions: WeeklyPlanAction[];
}

function parseNumeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  const parsed = parseNumeric(value);
  if (parsed == null) return undefined;
  return Math.max(min, Math.min(max, parsed));
}

function compactSandboxContext(sandboxContext: any): any {
  const places = Array.isArray(sandboxContext?.places)
    ? sandboxContext.places.slice(0, 10)
    : sandboxContext?.places
      ? [sandboxContext.places]
      : [];
  const beings = Array.isArray(sandboxContext?.beings) ? sandboxContext.beings.slice(0, 20) : [];
  const events = Array.isArray(sandboxContext?.events) ? sandboxContext.events.slice(0, 12) : [];

  return {
    sandbox: {
      current_year: sandboxContext?.sandbox?.current_year,
      current_month: sandboxContext?.sandbox?.current_month,
      current_day: sandboxContext?.sandbox?.current_day,
      currency: sandboxContext?.sandbox?.currency,
    },
    places,
    beings,
    recent_events: events,
  };
}

function toPlannedAction(action: WeeklyPlanAction, sandbox: ISandboxDocument, otherNpcs: IBeing[]): IPlannedAction {
  const rawParticipants = action.event_participants || action.attended_events || [];
  const eventParticipants = rawParticipants
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter((id): id is ObjectId => !!id)
    .filter((id) => otherNpcs.some((n) => n._id.toString() === id.toString()));

  const purchase = action.purchase || action.purchased_objects;
  const purchasePrice = parseNumeric(purchase?.price);
  const safePurchase =
    purchase && purchasePrice != null
      ? {
          object_type: purchase.object_type || "object",
          name: purchase.name || "Unknown",
          price: purchasePrice,
          description: purchase.description,
        }
      : undefined;

  return {
    action: action.action,
    reason: action.reason,
    start_year: sandbox.current_year,
    start_month: sandbox.current_month,
    start_day: sandbox.current_day,
    country: action.country,
    city: action.city,
    place: action.place,
    longitude: clampNumber(action.longitude, -180, 180),
    latitude: clampNumber(action.latitude, -90, 90),
    action_type: action.action_type || "move",
    discovery_place: action.discovery_place || action.discovered_places,
    discovery_person: action.discovery_person || action.discovered_people,
    purchase: safePurchase,
    event_participants: eventParticipants,
  };
}

async function generateWeeklyPlansBatch({
  npcs,
  sandbox,
  sandboxContext,
}: {
  npcs: IBeing[];
  sandbox: ISandboxDocument;
  sandboxContext: any;
}): Promise<Map<string, IPlannedAction[]>> {
  const compactContext = compactSandboxContext(sandboxContext);
  const npcDetails = npcs.map((npc) => ({
    npc_id: npc._id.toString(),
    first_name: npc.first_name || "",
    last_name: npc.last_name || "",
    occupation: npc.occupation || "Unknown",
    soul_md: (npc.soul_md || "Unknown").slice(0, 120),
    life_md: (npc.life_md || "").slice(-140),
    relationship_to_player: npc.relationship_to_main_character || "Unknown",
    home_city: npc.home_city,
    home_country: npc.home_country,
    home_longitude: npc.home_longitude,
    home_latitude: npc.home_latitude,
    current_location: npc.current_place || npc.current_city || "Unknown",
    current_feeling: npc.current_feeling || "Unknown",
  }));

  const npcRoster = npcs.map((n) => ({
    npc_id: n._id.toString(),
    name: `${n.first_name || ""} ${n.last_name || ""}`.trim(),
  }));

  const prompt = `You are planning a week for multiple NPCs in a life simulation.

Simulation context:
${JSON.stringify(compactContext)}

DATE: ${sandbox.current_month}/${sandbox.current_day}/${sandbox.current_year}

NPC roster (use npc_id values for event_participants):
${JSON.stringify(npcRoster)}

Generate exactly 7 daily actions for each NPC below:
${JSON.stringify(npcDetails)}

Rules for each action:
1. Be realistic for personality and occupation
2. Include a specific destination and coordinates
3. Mix routine with variety
4. Occasionally include action_type: discover_place, discover_person, buy, or event
5. If action_type is "buy", purchase.price must be a JSON number only (no currency symbols, no text)

Return JSON:
{
  "plans": [
    {
      "npc_id": "...",
      "actions": [
        {
          "action": "...",
          "reason": "...",
          "city": "...",
          "country": "...",
          "place": "...",
          "longitude": N,
          "latitude": N,
          "action_type"?: "move"|"discover_place"|"discover_person"|"buy"|"event",
          "discovery_place"?: { "name", "description", "latitude", "longitude" },
          "discovery_person"?: { "first_name", "last_name", "description", "occupation" },
          "purchase"?: { "object_type": "property"|"car"|"object", "name", "price", "description" },
          "event_participants"?: ["npc_id"]
        }
      ]
    }
  ]
}

action: first person, max 5 words, -ing verbs.
reason: first person, exactly 7 words.
Use action_type only when appropriate (1-2 discover/buy/event per week). Default is "move".
Return strict JSON only: no markdown, no comments, no trailing commas, no single quotes, no undefined.
Return minified JSON (single line).`;

  const response = await completeJSON<{ plans: BatchPlanEntry[] }>({
    model: "fast",
    systemPrompt: "You generate realistic weekly plans for NPCs in a life simulation set in the real world.",
    userPrompt: prompt,
    maxTokens: 4096,
  });

  const plans = response.plans || [];
  const actionsByNpc = new Map<string, IPlannedAction[]>();

  for (const entry of plans) {
    const npc = npcs.find((n) => n._id.toString() === entry.npc_id);
    if (!npc) continue;
    const otherNpcs = npcs.filter((n) => !n._id.equals(npc._id));
    const planned = (entry.actions || []).map((a) => toPlannedAction(a, sandbox, otherNpcs));
    actionsByNpc.set(npc._id.toString(), planned);
  }

  return actionsByNpc;
}

export async function generateWeeklyPlan({
  npc,
  sandbox,
  otherNpcs = [],
  sandboxContext,
}: {
  npc: IBeing;
  sandbox: ISandboxDocument;
  otherNpcs?: IBeing[];
  sandboxContext?: any;
}): Promise<IPlannedAction[]> {
  const npcList =
    otherNpcs.length > 0
      ? `\nOther NPCs (use _id for event_participants): ${otherNpcs.map((n) => `${n._id}: ${n.first_name} ${n.last_name}`).join(", ")}`
      : "";

  const resolvedSandboxContext = sandboxContext || (await getSandboxContext(sandbox._id.toString(), npc._id.toString()));

  const prompt = `You are planning a week for an NPC in a life simulation.

  Simulation context:
  ${JSON.stringify(resolvedSandboxContext)}

    NPC:
    Name: ${npc.first_name} ${npc.last_name}
    Occupation: ${npc.occupation || "Unknown"}
    Soul: ${npc.soul_md || "Unknown"}
    Life: ${(npc.life_md || "").slice(-140)}
    Relationship to player: ${npc.relationship_to_main_character || "Unknown"}
    Home: ${npc.home_city}, ${npc.home_country} (${npc.home_longitude}, ${npc.home_latitude})
    Current location: ${npc.current_place || npc.current_city || "Unknown"}
    Current feeling: ${npc.current_feeling || "Unknown"}
    ${npcList}

    DATE: ${sandbox.current_month}/${sandbox.current_day}/${sandbox.current_year}

    Generate 7 daily actions for this NPC's week. Each action should:
    1. Be realistic for their personality and occupation
    2. Include a specific real-world destination with real coordinates
    3. Mix routine (work, home) with variety (social, errands, leisure)
    4. Occasionally include: discover_place (finding a new spot), discover_person (meeting someone new), buy (purchasing property/car/object), event (attending with others)
    5. If action_type is "buy", purchase.price must be a JSON number only (no currency symbols, no text)

    Return JSON: { "actions": [{ "action": "...", "reason": "...", "city": "...", "country": "...", "place": "...", "longitude": N, "latitude": N, "action_type"?: "move"|"discover_place"|"discover_person"|"buy"|"event", "discovery_place"?: { "name", "description", "latitude", "longitude" }, "discovery_person"?: { "first_name", "last_name", "description", "occupation" }, "purchase"?: { "object_type": "property"|"car"|"object", "name", "price", "description" }, "event_participants"?: ["npc_id"] }] }

    action: first person, max 5 words, -ing verbs.
    reason: first person, exactly 7 words.
    Use action_type only when appropriate (1-2 discover/buy/event per week). Default is "move".
    Return strict JSON only: no markdown, no comments, no trailing commas, no single quotes, no undefined.
    Return minified JSON (single line).`;

  const response = await completeJSON<{ actions: WeeklyPlanAction[] }>({
    model: "fast",
    systemPrompt: "You generate realistic weekly plans for NPCs in a life simulation set in the real world.",
    userPrompt: prompt,
  });

  return (response.actions || []).map((a) => toPlannedAction(a, sandbox, otherNpcs));
}

export async function generateAllNPCPlans({ sandbox }: { sandbox: ISandboxDocument }): Promise<IBeing[]> {
  const npcs = await Being.find({
    sandbox: sandbox._id,
    is_main: { $ne: true },
    is_dead: { $ne: true },
    is_deleted: { $ne: true },
  });

  const historyEntries: any[] = [];
  const updates: any[] = [];
  const updatedNpcIds = new Set<string>();

  if (npcs.length === 0) return [];

  const sharedSandboxContext = await getSandboxContext(sandbox._id.toString(), npcs[0]._id.toString());

  const batchSize = 4;
  for (let i = 0; i < npcs.length; i += batchSize) {
    const batch = npcs.slice(i, i + batchSize);
    let actionsByNpc = new Map<string, IPlannedAction[]>();

    try {
      actionsByNpc = await generateWeeklyPlansBatch({
        npcs: batch,
        sandbox,
        sandboxContext: sharedSandboxContext,
      });
    } catch (error) {
      console.error("Batch NPC plan generation failed, falling back to per-NPC planning:", error);
    }

    for (const npc of batch) {
      const npcID = npc._id.toString();
      let newActions = actionsByNpc.get(npcID);

      if (!newActions || newActions.length === 0) {
        try {
          newActions = await generateWeeklyPlan({
            npc,
            sandbox,
            otherNpcs: npcs.filter((n) => !n._id.equals(npc._id)),
            sandboxContext: sharedSandboxContext,
          });
        } catch (error) {
          console.error(`Error generating plan for NPC ${npc._id}:`, error);
          continue;
        }
      }

      for (let idx = 0; idx < newActions.length; idx++) {
        const action = newActions[idx];
        const simDate = getSimDateWithOffset(sandbox.current_year, sandbox.current_month, sandbox.current_day, idx);
        historyEntries.push({
          sandbox: sandbox._id,
          year: simDate.year,
          month: simDate.month,
          day: simDate.day,
          type: "npc_movement",
          actor_type: "npc",
          actor_id: npc._id,
          new_state: {
            country: action.country,
            city: action.city,
            place: action.place,
            longitude: action.longitude,
            latitude: action.latitude,
          },
          description: `${npc.first_name} ${action.action}`,
          metadata: { reason: action.reason },
        });
      }

      const existingAIQueue = npc.ai_action_queue || [];
      const updatedAIQueue = [...newActions, ...existingAIQueue].slice(0, MAX_AI_QUEUE_SIZE);
      const firstAction = (npc.player_action_queue || [])[0] || updatedAIQueue[0];

      updates.push({
        updateOne: {
          filter: { _id: npc._id },
          update: {
            $set: {
              ai_action_queue: updatedAIQueue,
              current_action: firstAction?.action,
              current_longitude: firstAction?.longitude,
              current_latitude: firstAction?.latitude,
              current_action_updated_at: new Date(),
            },
          },
        },
      });
      updatedNpcIds.add(npcID);
    }
  }

  if (updates.length > 0) {
    await Being.bulkWrite(updates).catch((err) => console.error("Error updating NPC plans:", err));
  }

  if (historyEntries.length > 0) {
    await WorldHistory.insertMany(historyEntries).catch((err) => console.error("Error logging NPC movement history:", err));
  }

  if (updatedNpcIds.size === 0) return npcs;

  const refreshed = await Being.find({ _id: { $in: Array.from(updatedNpcIds).map((id) => new ObjectId(id)) } });
  const refreshedByID = new Map(refreshed.map((npc) => [npc._id.toString(), npc]));
  return npcs.map((npc) => refreshedByID.get(npc._id.toString()) || npc);
}
