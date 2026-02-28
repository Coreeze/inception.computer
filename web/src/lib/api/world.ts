import { apiFetch } from "./index";

export async function loadCharacterWorld(characterID: string) {
  return apiFetch(`/sandbox/character/${characterID}`);
}

export async function loadEvents(characterID: string) {
  return apiFetch(`/sandbox/events/${characterID}`);
}

export async function loadChat(characterID: string, npcID: string) {
  return apiFetch(`/sandbox/chat/${characterID}/${npcID}`);
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
