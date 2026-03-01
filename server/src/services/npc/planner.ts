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
  action_type?: "move" | "discover_place" | "discover_person" | "buy" | "event" | "marry" | "child_birth" | "adopt_pet" | "change_occupation";
  discovery_place?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovery_person?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchase?: { object_type: string; name: string; price: number; description?: string };
  event_participants?: string[];
  discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchased_objects?: { object_type: string; name: string; price: number; description?: string };
  attended_events?: string[];
  name_change?: { last_name: string };
  occupation_change?: { occupation: string };
  relationship_event?: "marriage" | "child_birth";
  family_membership?: { spouse_name?: string; child_name?: string };
  pet?: { species: string; name?: string; acquisition_mode?: "meet" | "buy" | "adopt" };
}

interface BatchPlanEntry {
  npc_id: string;
  actions: WeeklyPlanAction[];
}

const COMPRESSED_PLANNER_CONSTITUTION = `
- Simulate persistent real life: world state accumulates; no disposable entities.
- If an action references a non-existing person/place/entity/business/relationship, create it (after dedupe).
- Dedupe by normalized identity + geo proximity + recent-time window + relationship context.
- Main-character interactions: create first-class records immediately.
- NPC interactions: persist metadata at minimum; materialize full records when simulation requires.
- Behavior must follow human drives: belonging, safety, status, purpose, resources.
- Use neuroscience balance: attachment, reward prediction, stress regulation, habit loops, social homeostasis.
- Discoveries are natural and uncapped when context supports them; avoid artificial numeric limits.
- Relationships evolve gradually; include social network effects (introductions, trust, reputation, conflict, repair).
- Economic life must be plausible: earn/spend/save/borrow/invest/build/close businesses under constraints.
- Major transitions require plausibility checks: temporal, geographic, social-psychological, economic, life-stage.
- Prefer plausible adaptation over invalid jumps; if implausible, pivot to nearest valid action.
- Maintain continuity and inertia; no abrupt identity/personality oscillations without triggers.
- Failures should produce adaptive follow-up (retry/pivot/defer/help), not repetitive loops.
- Log major transitions deterministically with provenance (who/what/where/why/when/source).
- Output strict schema-valid JSON only; never emit malformed required fields.
`.trim();

const KNOWN_ACTION_TYPES = new Set([
  "move",
  "discover_place",
  "discover_person",
  "buy",
  "event",
  "marry",
  "child_birth",
  "adopt_pet",
  "change_occupation",
]);

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

function sanitizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
}

function sanitizeWeeklyAction(action: WeeklyPlanAction): WeeklyPlanAction | null {
  const actionText = sanitizeText(action.action);
  const reason = sanitizeText(action.reason);
  const place = sanitizeText(action.place);

  if (!actionText || !reason || !place) return null;

  const actionType = KNOWN_ACTION_TYPES.has(action.action_type || "move") ? action.action_type || "move" : "move";
  const normalized: WeeklyPlanAction = {
    ...action,
    action: actionText,
    reason,
    place,
    city: sanitizeText(action.city) || "Unknown",
    country: sanitizeText(action.country) || "Unknown",
    longitude: clampNumber(action.longitude, -180, 180) ?? 0,
    latitude: clampNumber(action.latitude, -90, 90) ?? 0,
    action_type: actionType,
  };

  if (actionType === "discover_place") {
    const discoveryPlaceName = sanitizeText(action.discovery_place?.name) || place;
    if (!discoveryPlaceName) return null;
    normalized.discovery_place = {
      name: discoveryPlaceName,
      description: sanitizeText(action.discovery_place?.description),
      latitude: clampNumber(action.discovery_place?.latitude, -90, 90) ?? normalized.latitude,
      longitude: clampNumber(action.discovery_place?.longitude, -180, 180) ?? normalized.longitude,
    };
  }

  if (actionType === "discover_person") {
    const firstName = sanitizeText(action.discovery_person?.first_name);
    if (!firstName) return null;
    normalized.discovery_person = {
      first_name: firstName,
      last_name: sanitizeText(action.discovery_person?.last_name),
      description: sanitizeText(action.discovery_person?.description),
      occupation: sanitizeText(action.discovery_person?.occupation),
    };
  }

  if (actionType === "adopt_pet" && action.pet) {
    const species = sanitizeText(action.pet.species);
    if (!species) return null;
    normalized.pet = {
      species,
      name: sanitizeText(action.pet.name),
      acquisition_mode: action.pet.acquisition_mode || "adopt",
    };
  }

  if (actionType === "change_occupation") {
    const nextOccupation = sanitizeText(action.occupation_change?.occupation);
    if (!nextOccupation) return null;
    normalized.occupation_change = { occupation: nextOccupation };
  }

  if (actionType === "marry") {
    const spouseName = sanitizeText(action.family_membership?.spouse_name);
    if (!spouseName) return null;
    normalized.family_membership = { ...(normalized.family_membership || {}), spouse_name: spouseName };
    normalized.relationship_event = "marriage";
  }

  if (actionType === "child_birth") {
    const childName = sanitizeText(action.family_membership?.child_name);
    if (!childName) return null;
    normalized.family_membership = { ...(normalized.family_membership || {}), child_name: childName };
    normalized.relationship_event = "child_birth";
  }

  return normalized;
}

function sanitizeWeeklyActions(actions: WeeklyPlanAction[] | undefined): WeeklyPlanAction[] {
  return (actions || []).map((a) => sanitizeWeeklyAction(a)).filter((a): a is WeeklyPlanAction => !!a);
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
    name_change: action.name_change,
    occupation_change: action.occupation_change,
    relationship_event: action.relationship_event,
    family_membership: action.family_membership,
    pet: action.pet,
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

PLANNER CONSTITUTION:
${COMPRESSED_PLANNER_CONSTITUTION}

NEUROSCIENCE-INSPIRED DECISION MODEL:
Balance these drives when choosing each action:
- Attachment: bonding, caregiving, belonging needs
- Reward prediction: pursue expected emotional/social payoff
- Stress regulation: avoid overload, seek recovery when depleted
- Habit loops: anchor routine (sleep, work, meals) for stability
- Social homeostasis: rebalance isolation vs connection

LIFE-COURSE RULES:
- Marriage and parenting are plausible when relationship context supports them
- Family duties (visits, weddings, caregiving) can motivate local or international travel
- NPCs may meet, buy, or adopt pets (unaware beings)
- Occupation changes are allowed when context supports career continuity
- Last-name changes only occur in marriage context and are optional
- Avoid abrupt identity churn, implausible job switching, or impossible family timelines

DISCOVERY IS NATURAL, NOT RARE:
In real life, people constantly discover new places and meet new people as part of daily activity. Going to a new restaurant = discover_place. Meeting a colleague's friend = discover_person.
- Discoveries should happen organically — do NOT artificially limit them
- Only use action_type "move" for revisiting a known location with no new interactions
- Each discovered person must be unique with a real name and occupation
- Each discovered place must be specific with real coordinates

Rules for each action:
1. Be realistic for personality, occupation, and life stage
2. Include a specific destination and real coordinates
3. Reflect how a real person lives — most days involve going somewhere new or meeting someone
4. Use action_type to accurately reflect what happens: discover_place for new spots, discover_person for meeting new people, buy for purchases, event for gatherings
5. If action_type is "buy", purchase.price must be a JSON number only
6. If action_type is "marry", include family_membership.spouse_name and relationship_event:"marriage"
7. If action_type is "child_birth", include family_membership.child_name and relationship_event:"child_birth"
8. If action_type is "adopt_pet", include pet:{species,name,acquisition_mode}
9. If action_type is "change_occupation", include occupation_change:{occupation}

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
          "action_type"?: "move"|"discover_place"|"discover_person"|"buy"|"event"|"marry"|"child_birth"|"adopt_pet"|"change_occupation",
          "discovery_place"?: { "name", "description", "latitude", "longitude" },
          "discovery_person"?: { "first_name", "last_name", "description", "occupation" },
          "purchase"?: { "object_type": "property"|"car"|"object", "name", "price", "description" },
          "event_participants"?: ["npc_id"],
          "name_change"?: { "last_name": "..." },
          "occupation_change"?: { "occupation": "..." },
          "relationship_event"?: "marriage"|"child_birth",
          "family_membership"?: { "spouse_name"?: "...", "child_name"?: "..." },
          "pet"?: { "species": "...", "name"?: "...", "acquisition_mode"?: "meet"|"buy"|"adopt" }
        }
      ]
    }
  ]
}

action: first person, max 5 words, -ing verbs.
reason: first person, exactly 7 words.
Return strict JSON only: no markdown, no comments, no trailing commas, no single quotes, no undefined.
Return minified JSON (single line).`;

  const response = await completeJSON<{ plans: BatchPlanEntry[] }>({
    model: "fast",
    systemPrompt: "You generate realistic weekly plans for beings in a life simulation. Use neuroscience-inspired decision-making: balance attachment, reward prediction, stress regulation, habit loops, and social homeostasis.",
    userPrompt: prompt,
    maxTokens: 4096,
  });

  const plans = response.plans || [];
  const actionsByNpc = new Map<string, IPlannedAction[]>();

  for (const entry of plans) {
    const npc = npcs.find((n) => n._id.toString() === entry.npc_id);
    if (!npc) continue;
    const otherNpcs = npcs.filter((n) => !n._id.equals(npc._id));
    const planned = sanitizeWeeklyActions(entry.actions).map((a) => toPlannedAction(a, sandbox, otherNpcs));
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
  const isMainCharacter = !!npc.is_main;
  const npcList =
    otherNpcs.length > 0
      ? `\nKnown people (use _id for event_participants): ${otherNpcs.map((n) => `${n._id}: ${n.first_name} ${n.last_name}`).join(", ")}`
      : "";

  const existingPlaces = (npc.discovered_places || []).map((p) => p.name).join(", ");
  const existingPeople = (npc.discovered_people || []).map((p) => `${p.first_name} ${p.last_name || ""}`).join(", ");

  const resolvedSandboxContext = sandboxContext || (await getSandboxContext(sandbox._id.toString(), npc._id.toString()));

  const roleLabel = isMainCharacter ? "MAIN CHARACTER (free will active)" : "NPC";

  const prompt = `You are planning a week for a ${roleLabel} in a life simulation that emulates real life.

Simulation context:
${JSON.stringify(resolvedSandboxContext)}

${roleLabel}:
Name: ${npc.first_name} ${npc.last_name}
Occupation: ${npc.occupation || "Unknown"}
Relationship status: ${npc.relationship_status || "Unknown"}
Soul: ${npc.soul_md || "Unknown"}
Life: ${(npc.life_md || "").slice(-300)}
${isMainCharacter ? `Life mission: ${npc.life_mission?.name || "None"} (progress: ${npc.life_mission?.progress ?? 0})` : `Relationship to player: ${npc.relationship_to_main_character || "Unknown"}`}
Home: ${npc.home_city}, ${npc.home_country} (${npc.home_longitude}, ${npc.home_latitude})
Current location: ${npc.current_place || npc.current_city || "Unknown"}
Current feeling: ${npc.current_feeling || "Unknown"}
Already discovered places: ${existingPlaces || "none"}
Already discovered people: ${existingPeople || "none"}
${npcList}

DATE: ${sandbox.current_month}/${sandbox.current_day}/${sandbox.current_year}

PLANNER CONSTITUTION:
${COMPRESSED_PLANNER_CONSTITUTION}

NEUROSCIENCE-INSPIRED DECISION MODEL:
Balance these drives when choosing each action:
- Attachment: bonding, caregiving, belonging needs
- Reward prediction: pursue expected emotional/social payoff
- Stress regulation: avoid overload, seek recovery when depleted
- Habit loops: anchor routine (sleep, work, meals) for stability
- Social homeostasis: rebalance isolation vs connection

DISCOVERY IS NATURAL, NOT RARE:
In real life, people constantly discover new places and meet new people as a natural part of daily activity. Going to a new restaurant = discover_place. Meeting a colleague's friend = discover_person. Visiting a new park = discover_place. Chatting with a barista = discover_person.
- Discoveries should happen organically as part of routine, work, socializing, errands, and leisure
- Do NOT artificially limit discoveries — use them whenever the action naturally involves a new place or person
- Only use action_type "move" for revisiting a known location with no new interactions
- The more socially active and exploratory a person's life, the more discoveries per week
- Each discovered person must be a unique, plausible individual with a real name and occupation
- Each discovered place must be a real, specific place with real coordinates near the action location

LIFE-COURSE RULES:
- Marriage and parenting are plausible when relationship context supports them
- Family duties (visits, weddings, caregiving) can motivate local or international travel
- Beings may meet, buy, or adopt pets (unaware beings)
- Occupation changes are allowed when context supports career continuity
- Last-name changes only occur in marriage context and are optional
- Avoid abrupt identity churn, implausible job switching, or impossible family timelines
- Purchases happen when context supports them (groceries, equipment, gifts, etc.)

Generate 7 daily actions for this being's week. Each action should:
1. Be realistic for personality, occupation, and life stage
2. Include a specific real-world destination with real coordinates
3. Reflect how a real person lives — most days involve going somewhere new or meeting someone
4. Use action_type to accurately reflect what happens: discover_place when visiting a new spot, discover_person when meeting someone new, buy when purchasing, event when attending a social gathering
5. If action_type is "buy", purchase.price must be a JSON number only

Return JSON: { "actions": [{ "action": "...", "reason": "...", "city": "...", "country": "...", "place": "...", "longitude": N, "latitude": N, "action_type"?: "move"|"discover_place"|"discover_person"|"buy"|"event"|"marry"|"child_birth"|"adopt_pet"|"change_occupation", "discovery_place"?: { "name", "description", "latitude", "longitude" }, "discovery_person"?: { "first_name", "last_name", "description", "occupation" }, "purchase"?: { "object_type", "name", "price", "description" }, "event_participants"?: ["npc_id"], "name_change"?: { "last_name" }, "occupation_change"?: { "occupation" }, "relationship_event"?: "marriage"|"child_birth", "family_membership"?: { "spouse_name"?, "child_name"? }, "pet"?: { "species", "name"?, "acquisition_mode"?: "meet"|"buy"|"adopt" } }] }

action: first person, max 5 words, -ing verbs.
reason: first person, exactly 7 words.
Return strict JSON only: no markdown, no comments, no trailing commas, no single quotes, no undefined.
Return minified JSON (single line).`;

  const response = await completeJSON<{ actions: WeeklyPlanAction[] }>({
    model: "fast",
    systemPrompt: "You generate realistic weekly plans for beings in a life simulation. Use neuroscience-inspired decision-making: balance attachment, reward prediction, stress regulation, habit loops, and social homeostasis.",
    userPrompt: prompt,
  });

  return sanitizeWeeklyActions(response.actions).map((a) => toPlannedAction(a, sandbox, otherNpcs));
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

  if (sandbox.free_will_enabled) {
    const mainCharacter = await Being.findOne({
      sandbox: sandbox._id,
      is_main: true,
      is_dead: { $ne: true },
      is_deleted: { $ne: true },
    });
    if (mainCharacter && (!mainCharacter.ai_action_queue || mainCharacter.ai_action_queue.length < 3)) {
      try {
        const mainActions = await generateWeeklyPlan({
          npc: mainCharacter,
          sandbox,
          otherNpcs: npcs,
        });
        const existingQueue = mainCharacter.ai_action_queue || [];
        const updatedQueue = [...mainActions, ...existingQueue].slice(0, MAX_AI_QUEUE_SIZE);
        mainCharacter.ai_action_queue = updatedQueue;
        await mainCharacter.save();
      } catch (err) {
        console.error("Main character AI plan generation failed:", err);
      }
    }
  }

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
