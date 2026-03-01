import { ObjectId } from "mongodb";
import { Being, IBeing, IPlannedAction } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { ObjectModel } from "../../database/models/object";
import { Event } from "../../database/models/event";
import { Places } from "../../database/models/places";
import { MilestoneEvent, broadcastHeartbeat } from "./heartbeatSubscribers";
import { StatusPraesens, interpretBeingStats } from "./statusPraesens";
import { checkSignals } from "./signals";
import { generateChoices } from "./generateChoices";
import { formatSimDate } from "../../utils/formatSimDate";

async function processBeingAction(
  being: IBeing,
  action: IPlannedAction,
  character: IBeing,
  sandbox: ISandboxDocument,
  npcs: IBeing[],
  dateStr: string
): Promise<void> {
  const actionType = action.action_type || "move";
  const isMain = !!being.is_main;

  if (action.place && action.longitude != null && action.latitude != null) {
    const placeName = action.place.trim();
    if (placeName) {
      if (isMain) {
        const existing = await Places.findOne({
          main_character: character._id,
          name: placeName,
        });
        if (!existing) {
          const description =
            actionType === "discover_place" && action.discovery_place?.description
              ? action.discovery_place.description
              : undefined;
          try {
            await Places.create({
              user: character.user,
              sandbox: sandbox._id,
              main_character: character._id,
              name: placeName,
              description,
              latitude: action.latitude,
              longitude: action.longitude,
              city: action.city,
              country: action.country,
              introduced_via: actionType === "discover_place" ? "player_discover" : "exploration",
              introduced_by: being._id,
            });
          } catch {}
        }
      } else {
        const places = being.discovered_places || [];
        const alreadyKnown = places.some(
          (p) => p.name?.toLowerCase() === placeName.toLowerCase()
        );
        if (!alreadyKnown) {
          places.push({
            name: placeName,
            description: action.discovery_place?.description,
            latitude: action.latitude,
            longitude: action.longitude,
          });
          being.discovered_places = places;
        }
      }
    }
  }

  if (actionType === "discover_place" && action.discovery_place && isMain) {
    const dp = action.discovery_place;
    const dpName = (dp.name || action.place || "").trim();
    if (dpName) {
      const places = being.discovered_places || [];
      const alreadyKnown = places.some(
        (p) => p.name?.toLowerCase() === dpName.toLowerCase()
      );
      if (!alreadyKnown) {
        places.push({
          name: dpName,
          description: dp.description,
          latitude: dp.latitude ?? action.latitude,
          longitude: dp.longitude ?? action.longitude,
        });
        being.discovered_places = places;
      }
    }
  }

  if (actionType === "discover_person" && action.discovery_person) {
    const dperson = action.discovery_person;
    const personFirstName = (dperson.first_name || "").trim();
    if (personFirstName) {
      const people = being.discovered_people || [];
      people.push({
        first_name: personFirstName,
        last_name: dperson.last_name,
        description: dperson.description,
        occupation: dperson.occupation,
      });
      being.discovered_people = people;

      if (isMain) {
        const existing = await Being.findOne({
          sandbox: sandbox._id,
          first_name: personFirstName,
          last_name: dperson.last_name || undefined,
          is_deleted: { $ne: true },
        });
        if (!existing) {
          try {
            await Being.create({
              user: character.user,
              sandbox: sandbox._id,
              species: "human",
              self_awareness: "aware",
              is_main: false,
              main_character: character._id,
              first_name: personFirstName,
              last_name: dperson.last_name,
              occupation: dperson.occupation,
              description: dperson.description,
              home_longitude: action.longitude ?? character.current_longitude,
              home_latitude: action.latitude ?? character.current_latitude,
              home_city: action.city || character.current_city,
              home_country: action.country || character.current_country,
              current_longitude: action.longitude ?? character.current_longitude,
              current_latitude: action.latitude ?? character.current_latitude,
              current_city: action.city,
              current_country: action.country,
              relationship_to_main_character: "acquaintance",
            });
          } catch {}
        }
      }
    }
  }

  if (actionType === "buy" && action.purchase) {
    const p = action.purchase;
    const wealth = being.wealth_index ?? 0;
    if (wealth >= p.price) {
      await ObjectModel.create({
        sandbox: sandbox._id,
        name: p.name,
        type: p.object_type,
        description: p.description,
        owner: being._id,
        ownerType: isMain ? "character" : "npc",
        purchase_price: p.price,
      });
      being.wealth_index = wealth - p.price;
    }
  }

  if (actionType === "event") {
    const participantIds = [being._id, ...(action.event_participants || [])];
    const participantNames = [
      `${being.first_name} ${being.last_name}`,
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
      title: `${being.first_name} ${being.last_name} - ${action.action}`,
      description: action.reason,
      longitude: action.longitude,
      latitude: action.latitude,
      location_name: action.place,
      participants: participantIds,
      participant_names: participantNames,
    });
  }

  if (actionType === "adopt_pet" && action.pet) {
    const pet = action.pet;
    if (isMain) {
      try {
        await Being.create({
          user: character.user,
          sandbox: sandbox._id,
          species: pet.species || "animal",
          self_awareness: "unaware",
          is_main: false,
          main_character: character._id,
          first_name: pet.name || pet.species,
          home_longitude: being.current_longitude,
          home_latitude: being.current_latitude,
          home_city: being.current_city,
          home_country: being.current_country,
          current_longitude: being.current_longitude,
          current_latitude: being.current_latitude,
        });
      } catch {}
    }
    being.life_md = (being.life_md || "") + `\n${dateStr}: Adopted ${pet.name || pet.species} (${pet.species}).`;
  }

  if (actionType === "marry" && action.family_membership?.spouse_name) {
    const spouseName = action.family_membership.spouse_name;
    being.relationship_status = "married";
    being.life_md = (being.life_md || "") + `\n${dateStr}: Married ${spouseName} in ${action.city || "Unknown"}, ${action.country || "Unknown"}.`;
    if (action.name_change?.last_name) {
      const oldLast = being.last_name || "";
      being.last_name = action.name_change.last_name;
      being.life_md = (being.life_md || "") + `\n${dateStr}: Changed last name from ${oldLast} to ${action.name_change.last_name} after marriage with ${spouseName}.`;
    }

    if (isMain) {
      const existing = await Being.findOne({
        sandbox: sandbox._id,
        first_name: spouseName.split(" ")[0],
        is_deleted: { $ne: true },
      });
      if (!existing) {
        try {
          await Being.create({
            user: character.user,
            sandbox: sandbox._id,
            species: "human",
            self_awareness: "aware",
            is_main: false,
            main_character: character._id,
            first_name: spouseName.split(" ")[0] || spouseName,
            last_name: spouseName.split(" ").slice(1).join(" ") || being.last_name,
            relationship_to_main_character: "spouse",
            relationship_status: "married",
            home_longitude: being.home_longitude,
            home_latitude: being.home_latitude,
            home_city: being.home_city,
            home_country: being.home_country,
            current_longitude: being.current_longitude,
            current_latitude: being.current_latitude,
          });
        } catch {}
      }
    }
  }

  if (actionType === "child_birth" && action.family_membership?.child_name) {
    const childName = action.family_membership.child_name;
    being.life_md = (being.life_md || "") + `\n${dateStr}: Welcomed child ${childName}.`;

    if (isMain) {
      try {
        await Being.create({
          user: character.user,
          sandbox: sandbox._id,
          species: "human",
          self_awareness: "aware",
          is_main: false,
          main_character: character._id,
          first_name: childName.split(" ")[0] || childName,
          last_name: being.last_name,
          relationship_to_main_character: "child",
          birth_year: sandbox.current_year,
          birth_month: sandbox.current_month,
          birth_day: sandbox.current_day,
          home_longitude: being.home_longitude,
          home_latitude: being.home_latitude,
          home_city: being.home_city,
          home_country: being.home_country,
          current_longitude: being.current_longitude,
          current_latitude: being.current_latitude,
        });
      } catch {}
    }
  }

  if (actionType === "change_occupation" && action.occupation_change?.occupation) {
    const oldOcc = being.occupation || "Unknown";
    being.occupation = action.occupation_change.occupation;
    being.life_md = (being.life_md || "") + `\n${dateStr}: Transitioned occupation from ${oldOcc} to ${action.occupation_change.occupation}.`;
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

  const dateStr = formatSimDate(sandbox.current_year, sandbox.current_month, sandbox.current_day);

  let charAction: IPlannedAction | undefined;
  if (character.player_action_queue?.length) {
    charAction = character.player_action_queue.shift();
  } else if (sandbox.free_will_enabled && character.ai_action_queue?.length) {
    charAction = character.ai_action_queue.shift() as IPlannedAction | undefined;
  }

  if (charAction && !charAction.is_idle) {
    await processBeingAction(character, charAction, character, sandbox, npcs, dateStr);
    character.current_action = charAction.action;
    character.current_longitude = charAction.longitude ?? character.current_longitude;
    character.current_latitude = charAction.latitude ?? character.current_latitude;
    character.current_place = charAction.place;
    character.current_city = charAction.city;
    character.current_country = charAction.country;
    character.current_action_updated_at = new Date();
    const actionType = charAction.action_type || "move";
    if (!["marry", "child_birth", "adopt_pet", "change_occupation"].includes(actionType)) {
      const place = charAction.place ? ` at ${charAction.place}` : "";
      character.life_md = (character.life_md || "") + `\n${dateStr}: ${charAction.action}${place}`;
    }
  } else if (!charAction) {
    character.current_action = undefined;
  }

  const npcUpdates: NPCUpdate[] = [];
  for (const npc of npcs) {
    if (npc.ai_action_queue?.length) {
      const action = npc.ai_action_queue.shift() as IPlannedAction | undefined;
      if (action) {
        await processBeingAction(npc, action, character, sandbox, npcs, dateStr);
        npc.current_action = action.action;
        npc.current_longitude = action.longitude ?? npc.current_longitude;
        npc.current_latitude = action.latitude ?? npc.current_latitude;
        npc.current_place = action.place;
        npc.current_city = action.city;
        npc.current_country = action.country;
        const actionType = action.action_type || "move";
        if (!["marry", "child_birth", "adopt_pet", "change_occupation"].includes(actionType)) {
          const place = action.place ? ` at ${action.place}` : "";
          npc.life_md = (npc.life_md || "") + `\n${dateStr}: ${action.action}${place}`;
        }
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
