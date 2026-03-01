import { Being } from "../../database/models/being";
import { Sandbox } from "../../database/models/sandbox";
import { getChoice } from "./choiceStore";
import { io, playerSocketMap } from "../../index";
import { processHeartbeat } from "./processHeartbeat";
import { getPlayerSession } from "../../socket/sessionManager";

interface TickLoop {
  playerID: string;
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  lastChoiceReemitAt: number;
}

const loops = new Map<string, TickLoop>();

export function startHeartbeatScheduler(playerID: string, characterID: string) {
  const existing = loops.get(characterID);
  if (existing) {
    existing.playerID = playerID;
    return;
  }
  const loop: TickLoop = {
    playerID,
    timer: null,
    inFlight: false,
    lastChoiceReemitAt: 0,
  };
  loops.set(characterID, loop);
  scheduleNextTick(characterID, 0);
}

export function stopHeartbeatScheduler(characterID: string) {
  const loop = loops.get(characterID);
  if (!loop) return;
  if (loop.timer) clearTimeout(loop.timer);
  loops.delete(characterID);
}

function scheduleNextTick(characterID: string, delayMs: number) {
  const loop = loops.get(characterID);
  if (!loop) return;
  loop.timer = setTimeout(() => {
    void runTick(characterID);
  }, delayMs);
}

async function runTick(characterID: string) {
  const loop = loops.get(characterID);
  if (!loop) return;

  const session = getPlayerSession(loop.playerID);
  if (!session || !session.isPlaying || session.characterID !== characterID) {
    stopHeartbeatScheduler(characterID);
    return;
  }

  if (loop.inFlight) {
    scheduleNextTick(characterID, 1000);
    return;
  }

  loop.inFlight = true;
  let nextDelay = 2000;

  try {
    const character = await Being.findById(characterID);
    if (!character || character.is_deleted || character.is_dead) {
      stopHeartbeatScheduler(characterID);
      return;
    }

    const sandbox = await Sandbox.findById(character.sandbox);
    if (!sandbox) {
      stopHeartbeatScheduler(characterID);
      return;
    }

    nextDelay = sandbox.day_duration_ms || 2000;

    if (character.active_heartbeat_id) {
      const pendingChoice = getChoice(character.active_heartbeat_id);

      if (pendingChoice?.option_a && pendingChoice?.option_b) {
        const now = Date.now();
        if (now - loop.lastChoiceReemitAt > 15000) {
          const socketId = playerSocketMap.get(loop.playerID);
          if (socketId && io) {
            io.to(socketId).emit("choices_ready", {
              characterId: character._id.toString(),
              heartbeatId: character.active_heartbeat_id.toString(),
              choices: pendingChoice,
              signals: [],
            });
          }
          loop.lastChoiceReemitAt = now;
        }
      } else if (!character.is_processing) {
        character.active_heartbeat_id = undefined;
        await character.save();
      }
    }

    await advanceDate(sandbox);

    const npcs = await Being.find({
      main_character: character._id,
      is_deleted: { $ne: true },
    });

    const result = await processHeartbeat(character, sandbox, npcs, loop.playerID);

    const socketId = playerSocketMap.get(loop.playerID);
    if (result.isDead) {
      if (socketId && io) {
        io.to(socketId).emit("character_died", {
          characterId: character._id.toString(),
          date: result.date,
          deathReason: result.deathReason,
        });
      }
      stopHeartbeatScheduler(characterID);
      return;
    }
    if (socketId && io) {
      io.to(socketId).emit("heartbeat_update", {
        characterId: character._id.toString(),
        date: result.date,
        stats: result.stats,
        characterAction: result.characterAction,
        npcUpdates: result.npcUpdates,
      });
    }
  } catch (error) {
    console.error("Heartbeat scheduler tick failed:", error);
  } finally {
    const latestLoop = loops.get(characterID);
    if (latestLoop) {
      latestLoop.inFlight = false;
      scheduleNextTick(characterID, nextDelay);
    }
  }
}

async function advanceDate(sandbox: any) {
  let { current_year: y, current_month: m, current_day: d } = sandbox;
  d += 1;

  const daysInMonth = new Date(y, m, 0).getDate();

  if (d > daysInMonth) {
    d = 1;
    m += 1;
  }
  if (m > 12) {
    m = 1;
    y += 1;
  }
  sandbox.current_year = y;
  sandbox.current_month = m;
  sandbox.current_day = d;
  sandbox.last_heartbeat_at = new Date();
  sandbox.heartbeat_count = (sandbox.heartbeat_count || 0) + 1;

  await sandbox.save();
}
