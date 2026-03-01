import { apiFetch, getPlayerID } from "./index";

export async function initializeSandbox(params: {
  first_name: string;
  last_name: string;
  soul_md?: string;
  life_md?: string;
  life_mission_name?: string;
  home_city?: string;
  home_country?: string;
  home_longitude?: number;
  home_latitude?: number;
}) {
  return apiFetch("/sandbox-runtime/initialize", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      ...params,
    }),
  });
}

export async function postHeartbeat(characterID: string, action: "play" | "pause") {
  return apiFetch("/sandbox-runtime/heartbeat", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      action,
    }),
  });
}

export async function resolveChoice(characterID: string, choice: "option_a" | "option_b" | "ignore" | { freeform: string }) {
  return apiFetch("/sandbox-runtime/resolve-choice", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      choice,
    }),
  });
}

export async function setFreeWill(characterID: string, enabled: boolean) {
  return apiFetch("/sandbox-runtime/free-will", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      enabled,
    }),
  });
}

export async function doStuffSuggest(characterID: string) {
  return apiFetch("/sandbox-runtime/do-stuff/suggest", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
    }),
  });
}

export async function doStuffSelect(characterID: string, selectedAction: any) {
  return apiFetch("/sandbox-runtime/do-stuff/select", {
    method: "POST",
    body: JSON.stringify({
      playerID: getPlayerID(),
      characterID,
      selectedAction,
    }),
  });
}
