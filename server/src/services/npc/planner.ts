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
  discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchased_objects?: { object_type: string; name: string; price: number; description?: string };
  attended_events?: string[];
}

export async function generateWeeklyPlan({
  npc,
  sandbox,
  otherNpcs = [],
}: {
  npc: IBeing;
  sandbox: ISandboxDocument;
  otherNpcs?: IBeing[];
}): Promise<IPlannedAction[]> {
  const npcList =
    otherNpcs.length > 0
      ? `\nOther NPCs (use _id for event_participants): ${otherNpcs.map((n) => `${n._id}: ${n.first_name} ${n.last_name}`).join(", ")}`
      : "";

  const sandboxContext = await getSandboxContext(sandbox._id.toString(), npc._id.toString());

  const prompt = `You are planning a week for an NPC in a life simulation.

  Simulation context:
  ${JSON.stringify(sandboxContext)}

    NPC:
    Name: ${npc.first_name} ${npc.last_name}
    Occupation: ${npc.occupation || "Unknown"}
    Soul: ${npc.soul_md || "Unknown"}
    Life: ${(npc.life_md || "").slice(-300)}
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

    Return JSON: { "actions": [{ "action": "...", "reason": "...", "city": "...", "country": "...", "place": "...", "longitude": N, "latitude": N, "action_type"?: "move"|"discover_place"|"discover_person"|"buy"|"event", "discovery_place"?: { "name", "description", "latitude", "longitude" }, "discovery_person"?: { "first_name", "last_name", "description", "occupation" }, "purchase"?: { "object_type": "property"|"car"|"object", "name", "price", "description" }, "event_participants"?: ["npc_id"] }] }

    action: first person, max 5 words, -ing verbs.
    reason: first person, exactly 7 words.
    Use action_type only when appropriate (1-2 discover/buy/event per week). Default is "move".`;

  const response = await completeJSON<{ actions: WeeklyPlanAction[] }>({
    model: "fast",
    systemPrompt: "You generate realistic weekly plans for NPCs in a life simulation set in the real world.",
    userPrompt: prompt,
  });

  return response.actions.map((a) => ({
    action: a.action,
    reason: a.reason,
    start_year: sandbox.current_year,
    start_month: sandbox.current_month,
    start_day: sandbox.current_day,
    country: a.country,
    city: a.city,
    place: a.place,
    longitude: a.longitude,
    latitude: a.latitude,
    action_type: a.action_type || "move",
    discovered_places: a.discovered_places,
    discovered_people: a.discovered_people,
    purchased_objects: a.purchased_objects,
    attended_events: a.attended_events
      ?.filter((id) => {
        try {
          const oid = new ObjectId(id);
          return otherNpcs.some((n) => n._id.toString() === oid.toString());
        } catch {
          return false;
        }
      })
      .map((id) => new ObjectId(id)),
  }));
}

export async function generateAllNPCPlans({ sandbox }: { sandbox: ISandboxDocument }): Promise<IBeing[]> {
  const npcs = await Being.find({
    sandbox: sandbox._id,
    is_main: { $ne: true },
    is_dead: { $ne: true },
    is_deleted: { $ne: true },
  });

  const updatedNpcs: IBeing[] = [];
  const historyEntries: any[] = [];

  const batchSize = 5;
  for (let i = 0; i < npcs.length; i += batchSize) {
    const batch = npcs.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (npc) => {
        try {
          const newActions = await generateWeeklyPlan({
            npc,
            sandbox,
            otherNpcs: npcs.filter((n) => !n._id.equals(npc._id)),
          });
          console.log(newActions);

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

          return await Being.findByIdAndUpdate(
            npc._id,
            {
              $set: {
                ai_action_queue: updatedAIQueue,
                current_action: firstAction?.action,
                current_longitude: firstAction?.longitude,
                current_latitude: firstAction?.latitude,
                current_action_updated_at: new Date(),
              },
            },
            { new: true }
          );
        } catch (error) {
          console.error(`Error generating plan for NPC ${npc._id}:`, error);
          return npc;
        }
      })
    );

    updatedNpcs.push(...(batchResults.filter(Boolean) as IBeing[]));
  }

  if (historyEntries.length > 0) {
    await WorldHistory.insertMany(historyEntries).catch((err) => console.error("Error logging NPC movement history:", err));
  }

  return updatedNpcs;
}
