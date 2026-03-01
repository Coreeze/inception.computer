import { apiFetch, getPlayerID } from "./index";

export async function loadCharacterWorld(characterID: string) {
  return apiFetch(`/sandbox/character/${characterID}`);
}

export async function loadEvents(characterID: string) {
  return apiFetch(`/sandbox/events/${characterID}`);
}

export async function loadChat(characterID: string, npcID: string) {
  return apiFetch(`/sandbox/chat/${characterID}/${npcID}`);
}

export async function sendChatMessage(characterID: string, npcID: string, content: string) {
  return apiFetch("/sandbox-runtime/chat", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      npcID,
      kind: "text",
      content,
    }),
  });
}

export async function sendChatImage(characterID: string, npcID: string, imagePrompt: string, imageURL: string) {
  return apiFetch("/sandbox-runtime/chat", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      npcID,
      kind: "image",
      imagePrompt,
      imageURL,
    }),
  });
}

export async function generateChatImagePreview(characterID: string, npcID: string, imagePrompt: string) {
  return apiFetch("/sandbox-runtime/chat/image-preview", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      npcID,
      imagePrompt,
    }),
  });
}

export async function generateBeingImage(characterID: string, beingID: string) {
  return apiFetch<{ imageUrl: string }>("/sandbox-runtime/being/image", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      beingID,
    }),
  });
}

export async function generatePlaceImage(characterID: string, placeID: string) {
  return apiFetch<{ imageUrl: string }>("/sandbox-runtime/place/image", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      placeID,
    }),
  });
}

export async function loadMemories(characterID: string) {
  return apiFetch(`/sandbox/memories/${characterID}`);
}

export async function loadNotifications(characterID: string) {
  return apiFetch(`/sandbox/notifications/${characterID}`);
}

export async function loadHistory(sandboxID: string) {
  return apiFetch(`/sandbox/history/${sandboxID}`);
}

export async function travelCharacter(characterID: string, longitude: number, latitude: number) {
  return apiFetch("/sandbox-runtime/travel", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      longitude,
      latitude,
    }),
  });
}

export async function generateWhatsHere(
  characterID: string,
  longitude: number,
  latitude: number,
  quickSummary: string,
  mapboxSummary?: string
) {
  return apiFetch<{ description: string }>("/sandbox-runtime/whats-here", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      longitude,
      latitude,
      quickSummary,
      mapboxSummary,
    }),
  });
}
