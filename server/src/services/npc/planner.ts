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
  action_type?: "move" | "buy" | "event" | "marry" | "child_birth" | "adopt_pet" | "change_occupation";
  places?: { name: string; description?: string; latitude?: number; longitude?: number }[];
  people?: { first_name: string; last_name?: string; description?: string; occupation?: string }[];
  purchase?: { object_type: string; name: string; price: number; description?: string };
  event_participants?: string[];
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

const PLANNER_SYSTEM_PROMPT = `You plan weekly actions for a life simulation. Return minified JSON only.
Each action needs places[] and people[]. Create new ones if needed (don't duplicate known ones).
Types: buy, event, marry, child_birth, adopt_pet, change_occupation, move (max 2/week).
buy→include purchase{object_type,name,price,description}. event→include event_participants[npc_ids].
marry→family_membership.spouse_name+relationship_event:"marriage". child_birth→family_membership.child_name+relationship_event:"child_birth".
adopt_pet→pet{species,name,acquisition_mode}. change_occupation→occupation_change{occupation}.
Action shape: {action:"5-word -ing verb",reason:"7 words first person",city,country,place,longitude(REQUIRED float),latitude(REQUIRED float),action_type,places:[{name,description,latitude(REQUIRED),longitude(REQUIRED)}],people:[{first_name,last_name,description,occupation}],...optional fields above}
EVERY action and place MUST have real numeric latitude and longitude.`;

const COMPACT_INSTRUCTIONS = `7 actions. Each must interact with a person/place/object. No bare moves. Strict JSON, no markdown.`;

const KNOWN_ACTION_TYPES = new Set(["move", "buy", "event", "marry", "child_birth", "adopt_pet", "change_occupation"]);

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

  const rawPlaces = Array.isArray(action.places) ? action.places : [];
  normalized.places = rawPlaces
    .map((p) => {
      const name = sanitizeText(p.name);
      if (!name) return null;
      return {
        name,
        description: sanitizeText(p.description),
        latitude: clampNumber(p.latitude, -90, 90) ?? normalized.latitude,
        longitude: clampNumber(p.longitude, -180, 180) ?? normalized.longitude,
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  const rawPeople = Array.isArray(action.people) ? action.people : [];
  normalized.people = rawPeople
    .map((p) => {
      const firstName = sanitizeText(p.first_name);
      if (!firstName) return null;
      return {
        first_name: firstName,
        last_name: sanitizeText(p.last_name),
        description: sanitizeText(p.description),
        occupation: sanitizeText(p.occupation),
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  if (actionType === "adopt_pet" && action.pet) {
    const species = sanitizeText(action.pet.species);
    if (!species) return null;
    const validPetModes = new Set(["meet", "buy", "adopt"]);
    normalized.pet = {
      species,
      name: sanitizeText(action.pet.name),
      acquisition_mode: validPetModes.has(action.pet.acquisition_mode || "") ? action.pet.acquisition_mode! : "adopt",
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
  const places = (Array.isArray(sandboxContext?.places) ? sandboxContext.places : []).slice(0, 5).map((p: any) => p.name);
  const people = (Array.isArray(sandboxContext?.beings) ? sandboxContext.beings : []).slice(0, 5).map((b: any) => `${b.first_name} ${b.last_name}`);
  return { places, people };
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
    places: action.places || [],
    people: action.people || [],
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
  const anchor = npcs[0];
  const npcList = npcs.map((npc) => `${npc._id}:${npc.first_name} ${npc.last_name}`).join(", ");

  const prompt = `NPCs: ${npcList}
Area: ${anchor.home_city}/${anchor.home_country} (${anchor.home_latitude},${anchor.home_longitude})
Places: ${compactContext.places.join(", ") || "none"} | People: ${compactContext.people.join(", ") || "none"}
${COMPACT_INSTRUCTIONS}
All coordinates must be realistic and near (${anchor.home_latitude},${anchor.home_longitude}).
Return: {"plans":[{"npc_id":"...","actions":[...7 each...]}]}`;

  const response = await completeJSON<{ plans: BatchPlanEntry[] }>({
    model: "fast",
    systemPrompt: PLANNER_SYSTEM_PROMPT,
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

async function generateBeingWeeklyPlan({
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
  const resolvedSandboxContext = sandboxContext || (await getSandboxContext(sandbox._id.toString()));
  const compactContext = compactSandboxContext(resolvedSandboxContext);

  const prompt = `${npc.first_name} ${npc.last_name}, ${npc.home_city}/${npc.home_country} (${npc.home_latitude},${npc.home_longitude})
Places: ${compactContext.places.join(", ") || "none"} | People: ${compactContext.people.join(", ") || "none"}
${COMPACT_INSTRUCTIONS}
All coordinates must be realistic and near (${npc.home_latitude},${npc.home_longitude}).
Return: {"actions":[...7 actions...]}`;

  const response = await completeJSON<{ actions: WeeklyPlanAction[] }>({
    model: "fast",
    systemPrompt: PLANNER_SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return sanitizeWeeklyActions(response.actions).map((a) => toPlannedAction(a, sandbox, otherNpcs));
}

export async function generateMainWeeklyPlan({
  mainCharacter,
  sandbox,
  otherNpcs = [],
  sandboxContext,
}: {
  mainCharacter: IBeing;
  sandbox: ISandboxDocument;
  otherNpcs?: IBeing[];
  sandboxContext?: any;
}): Promise<IPlannedAction[]> {
  return generateBeingWeeklyPlan({
    npc: mainCharacter,
    sandbox,
    otherNpcs,
    sandboxContext,
  });
}

async function generateNPCWeeklyPlan({
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
  return generateBeingWeeklyPlan({
    npc,
    sandbox,
    otherNpcs,
    sandboxContext,
  });
}

export async function generateAllNPCPlans({ sandbox, mainCharacter }: { sandbox: ISandboxDocument; mainCharacter?: IBeing }): Promise<IBeing[]> {
  const npcs = await Being.find({
    sandbox: sandbox._id,
    is_main: { $ne: true },
    is_dead: { $ne: true },
    is_deleted: { $ne: true },
  });
  const npcsNeedingRefill = npcs.filter((npc) => (npc.ai_action_queue?.length || 0) <= 7);

  const historyEntries: any[] = [];
  const updates: any[] = [];
  const updatedNpcIds = new Set<string>();

  if (sandbox.free_will_enabled) {
    const mainCharacterDoc =
      mainCharacter ||
      (await Being.findOne({
        sandbox: sandbox._id,
        is_main: true,
        is_dead: { $ne: true },
        is_deleted: { $ne: true },
      }));
    if (mainCharacterDoc && (!mainCharacterDoc.ai_action_queue || mainCharacterDoc.ai_action_queue.length <= 7)) {
      try {
        const mainActions = await generateMainWeeklyPlan({
          mainCharacter: mainCharacterDoc,
          sandbox,
          otherNpcs: npcs,
        });
        console.log("Main character actions:", mainActions);
        const existingQueue = mainCharacterDoc.ai_action_queue || [];
        const updatedQueue = [...mainActions, ...existingQueue].slice(0, MAX_AI_QUEUE_SIZE);
        mainCharacterDoc.ai_action_queue = updatedQueue;
        if (!mainCharacter) {
          await mainCharacterDoc.save();
        }
      } catch (err) {
        console.error("Main character AI plan generation failed:", err);
      }
    }
  }

  if (npcs.length === 0) return [];
  if (npcsNeedingRefill.length === 0) return npcs;

  const sharedSandboxContext = await getSandboxContext(sandbox._id.toString(), npcsNeedingRefill[0]._id.toString());

  const batchSize = 4;
  for (let i = 0; i < npcsNeedingRefill.length; i += batchSize) {
    const batch = npcsNeedingRefill.slice(i, i + batchSize);
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
          newActions = await generateNPCWeeklyPlan({
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
