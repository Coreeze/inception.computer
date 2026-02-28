import { ObjectId } from "mongodb";
import { IBeing, IPlannedAction } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { ObjectModel } from "../../database/models/object";
import { Event } from "../../database/models/event";
import { MilestoneEvent, broadcastHeartbeat } from "./heartbeatSubscribers";
import { StatusPraesens, interpretBeingStats } from "./statusPraesens";
import { checkSignals } from "./signals";
import { generateChoices } from "./generateChoices";

async function processNPCAction(
  npc: IBeing,
  action: IPlannedAction,
  character: IBeing,
  sandbox: ISandboxDocument,
  npcs: IBeing[],
  dateStr: string
): Promise<void> {
  const actionType = action.action_type || "move";

  if (actionType === "discover_place" && action.discovery_place) {
    const dp = action.discovery_place;
    const places = npc.discovered_places || [];
    places.push({
      name: dp.name,
      description: dp.description,
      latitude: dp.latitude ?? action.latitude,
      longitude: dp.longitude ?? action.longitude,
    });
    npc.discovered_places = places;
  }

  if (actionType === "discover_person" && action.discovery_person) {
    const dperson = action.discovery_person;
    const people = npc.discovered_people || [];
    people.push({
      first_name: dperson.first_name,
      last_name: dperson.last_name,
      description: dperson.description,
      occupation: dperson.occupation,
    });
    npc.discovered_people = people;
  }

  if (actionType === "buy" && action.purchase) {
    const p = action.purchase;
    const wealth = npc.wealth_index ?? 0;
    if (wealth >= p.price) {
      await ObjectModel.create({
        sandbox: sandbox._id,
        name: p.name,
        type: p.object_type,
        description: p.description,
        owner: npc._id,
        ownerType: "npc",
        purchase_price: p.price,
      });
      npc.wealth_index = wealth - p.price;
    }
  }

  if (actionType === "event") {
    const participantIds = [npc._id, ...(action.event_participants || [])];
    const participantNames = [
      `${npc.first_name} ${npc.last_name}`,
      ...(action.event_participants || []).map((id) => {
        const found = npcs.find((n) => n._id.toString() === id.toString());
        return found ? `${found.first_name} ${found.last_name}` : "Unknown";
      }),
    ];
    await Event.create({
      character: character._id,
      user: character.user,
      category: "mundane",
      sim_year: sandbox.current_year,
      sim_month: sandbox.current_month,
      sim_day: sandbox.current_day,
      title: `${npc.first_name} ${npc.last_name} - ${action.action}`,
      description: action.reason,
      longitude: action.longitude,
      latitude: action.latitude,
      location_name: action.place,
      participants: participantIds,
      participant_names: participantNames,
    });
  }
}

export interface NPCUpdate {
  npcId: string;
  current_action: string | undefined;
  current_longitude: number | undefined;
  current_latitude: number | undefined;
  current_place: string | undefined;
  current_city: string | undefined;
  current_country: string | undefined;
  discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number }[];
  discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string }[];
  wealth_index?: number;
}

export interface HeartbeatResult {
  heartbeat_id: string;
  date: { year: number; month: number; day: number };
  stats: {
    health: number;
    vibe: number;
    money: number;
    life_mission: number;
  };
  statChanges: {
    health: number;
    vibe: number;
    money: number;
    life_mission: number;
  };
  // statusPraesens: StatusPraesens | null;
  isDead: boolean;
  deathReason: string | null;
  characterAction: {
    current_action: string | undefined;
    current_longitude: number | undefined;
    current_latitude: number | undefined;
    current_place: string | undefined;
    current_city: string | undefined;
    current_country: string | undefined;
    player_action_queue: any[];
  };
  npcUpdates: NPCUpdate[];
}

export async function processHeartbeat(character: IBeing, sandbox: ISandboxDocument, npcs: IBeing[], userID: string): Promise<HeartbeatResult> {
  const heartbeat_id = new ObjectId();
  const milestoneEvents: MilestoneEvent[] = [];

  const prevStats = {
    health: character.health_index ?? 0,
    vibe: character.vibe_index ?? 0,
    money: character.wealth_index ?? 0,
    life_mission: character.life_mission?.progress ?? 0,
  };

  const prevStatus = interpretBeingStats(character);

  await broadcastHeartbeat({
    character,
    sandbox,
    npcs,
    heartbeatCount: sandbox.heartbeat_count || 0,
    milestoneEvents,
  });

  if (character.is_dead) {
    await character.save();

    return {
      heartbeat_id: heartbeat_id.toString(),
      date: {
        year: sandbox.current_year,
        month: sandbox.current_month,
        day: sandbox.current_day,
      },
      stats: { health: 0, vibe: 0, money: character.wealth_index ?? 0, life_mission: character.life_mission?.progress ?? 0 },
      statChanges: { health: -prevStats.health, vibe: -prevStats.vibe, money: 0, life_mission: 0 },
      // statusPraesens: null,
      isDead: true,
      deathReason: character.death_reason || null,
      characterAction: {
        current_action: undefined,
        current_longitude: character.current_longitude,
        current_latitude: character.current_latitude,
        current_place: character.current_place,
        current_city: character.current_city,
        current_country: character.current_country,
        player_action_queue: [],
      },
      npcUpdates: [],
    };
  }

  // const statusPraesens = interpretBeingStats(character);
  // const signals = checkSignals(prevStatus, statusPraesens, sandbox.days_since_last_signal || 0);

  // if (signals.length > 0) {
  //   sandbox.days_since_last_signal = 0;
  // } else {
  //   sandbox.days_since_last_signal = (sandbox.days_since_last_signal || 0) + 1;
  // }

  // if (signals.length > 0 && !character.active_heartbeat_id) {
  //   generateChoices({
  //     character,
  //     sandbox,
  //     signals,
  //     statusPraesens,
  //     heartbeatId: heartbeat_id,
  //     userID,
  //   }).catch((err) => console.error("Choice generation fire-and-forget failed:", err));
  // }

  const dateStr = `Day ${sandbox.current_day}, Month ${sandbox.current_month}, Year ${sandbox.current_year}`;

  if (character.player_action_queue?.length) {
    const action = character.player_action_queue.shift();
    if (action && !action.is_idle) {
      character.current_action = action.action;
      character.current_longitude = action.longitude ?? character.current_longitude;
      character.current_latitude = action.latitude ?? character.current_latitude;
      character.current_place = action.place;
      character.current_city = action.city;
      character.current_country = action.country;
      character.current_action_updated_at = new Date();
      const place = action.place ? ` at ${action.place}` : "";
      character.life_md = (character.life_md || "") + `\n${dateStr}: ${action.action}${place}`;
    }
  } else {
    character.current_action = undefined;
  }

  const npcUpdates: NPCUpdate[] = [];
  for (const npc of npcs) {
    if (npc.ai_action_queue?.length) {
      const action = npc.ai_action_queue.shift() as IPlannedAction | undefined;
      if (action) {
        await processNPCAction(npc, action, character, sandbox, npcs, dateStr);
        npc.current_action = action.action;
        npc.current_longitude = action.longitude ?? npc.current_longitude;
        npc.current_latitude = action.latitude ?? npc.current_latitude;
        npc.current_place = action.place;
        npc.current_city = action.city;
        npc.current_country = action.country;
        const place = action.place ? ` at ${action.place}` : "";
        npc.life_md = (npc.life_md || "") + `\n${dateStr}: ${action.action}${place}`;
      }
    }
    npcUpdates.push({
      npcId: npc._id.toString(),
      current_action: npc.current_action,
      current_longitude: npc.current_longitude,
      current_latitude: npc.current_latitude,
      current_place: npc.current_place,
      current_city: npc.current_city,
      current_country: npc.current_country,
      discovered_places: npc.discovered_places,
      discovered_people: npc.discovered_people,
      wealth_index: npc.wealth_index,
    });
    await npc.save();
  }

  await character.save();
  await sandbox.save();

  const newStats = {
    health: character.health_index ?? 0,
    vibe: character.vibe_index ?? 0,
    money: character.wealth_index ?? 0,
    life_mission: character.life_mission?.progress ?? 0,
  };

  return {
    heartbeat_id: heartbeat_id.toString(),
    date: {
      year: sandbox.current_year,
      month: sandbox.current_month,
      day: sandbox.current_day,
    },
    stats: newStats,
    statChanges: {
      health: newStats.health - prevStats.health,
      vibe: newStats.vibe - prevStats.vibe,
      money: newStats.money - prevStats.money,
      life_mission: newStats.life_mission - prevStats.life_mission,
    },
    // statusPraesens,
    isDead: false,
    deathReason: null,
    characterAction: {
      current_action: character.current_action,
      current_longitude: character.current_longitude,
      current_latitude: character.current_latitude,
      current_place: character.current_place,
      current_city: character.current_city,
      current_country: character.current_country,
      player_action_queue: character.player_action_queue || [],
    },
    npcUpdates,
  };
}
