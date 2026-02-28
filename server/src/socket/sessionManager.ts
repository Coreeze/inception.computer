type RuntimeAction = "play" | "pause";
export type RuntimeState = "playing" | "paused";

interface RuntimeSession {
  socketId: string;
  characterID?: string;
  isPlaying: boolean;
}

const activeSessionByPlayer = new Map<string, RuntimeSession>();

export function registerPlayerSocket(
  playerID: string,
  socketId: string
): { replacedSocketId: string | null } {
  const existing = activeSessionByPlayer.get(playerID);
  activeSessionByPlayer.set(playerID, {
    socketId,
    characterID: existing?.characterID,
    isPlaying: existing?.isPlaying || false,
  });
  return {
    replacedSocketId:
      existing?.socketId && existing.socketId !== socketId
        ? existing.socketId
        : null,
  };
}

export function unregisterPlayerSocket(
  playerID: string,
  socketId: string
): { shouldPause: boolean; characterID?: string } {
  const existing = activeSessionByPlayer.get(playerID);
  if (!existing || existing.socketId !== socketId) {
    return { shouldPause: false };
  }
  activeSessionByPlayer.delete(playerID);
  return { shouldPause: existing.isPlaying, characterID: existing.characterID };
}

export function getPlayerSession(
  playerID: string
): RuntimeSession | undefined {
  return activeSessionByPlayer.get(playerID);
}

export function getRuntimeStateForPlayer(playerID: string): RuntimeState {
  const session = activeSessionByPlayer.get(playerID);
  return session?.isPlaying ? "playing" : "paused";
}

export function applyRuntimeAction(
  playerID: string,
  characterID: string,
  action: RuntimeAction
): { ok: true; characterToStop?: string } | { ok: false; error: string } {
  const existing = activeSessionByPlayer.get(playerID);
  if (!existing) {
    return { ok: false, error: "No active socket session" };
  }

  const characterToStop =
    action === "play" &&
    existing.characterID &&
    existing.characterID !== characterID
      ? existing.characterID
      : undefined;

  activeSessionByPlayer.set(playerID, {
    socketId: existing.socketId,
    characterID,
    isPlaying: action === "play",
  });

  return { ok: true, characterToStop };
}
