import { IBeing, IPlannedAction } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";

type PlausibilityDecision =
  | { allow: true; action: IPlannedAction; reason?: "normalized" }
  | { allow: false; reason: string };

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeBase(action: IPlannedAction): IPlannedAction {
  const plain = typeof (action as any).toObject === "function" ? (action as any).toObject() : action;
  const normalized: IPlannedAction = {
    ...plain,
    action: (plain.action || "").trim(),
    reason: (plain.reason || "").trim(),
    place: (plain.place || "").trim() || undefined,
    city: (plain.city || "").trim() || undefined,
    country: (plain.country || "").trim() || undefined,
    longitude: plain.longitude,
    latitude: plain.latitude,
  };

  if (typeof normalized.longitude === "number") normalized.longitude = clamp(normalized.longitude, -180, 180);
  if (typeof normalized.latitude === "number") normalized.latitude = clamp(normalized.latitude, -90, 90);

  return normalized;
}

export function evaluatePlannedAction(being: IBeing, action: IPlannedAction, sandbox: ISandboxDocument): PlausibilityDecision {
  const normalized = normalizeBase(action);
  if (!normalized.action) return { allow: false, reason: "missing_action_text" };

  const actionType = normalized.action_type || "move";
  if (!KNOWN_ACTION_TYPES.has(actionType)) {
    return { allow: false, reason: "unknown_action_type" };
  }

  if (Array.isArray(normalized.places)) {
    normalized.places = normalized.places
      .map((p) => ({
        ...p,
        name: (p.name || "").trim(),
        description: p.description?.trim() || undefined,
        latitude: typeof p.latitude === "number" ? clamp(p.latitude, -90, 90) : normalized.latitude,
        longitude: typeof p.longitude === "number" ? clamp(p.longitude, -180, 180) : normalized.longitude,
      }))
      .filter((p) => p.name);
  }

  if (Array.isArray(normalized.people)) {
    normalized.people = normalized.people
      .map((p) => ({
        ...p,
        first_name: (p.first_name || "").trim(),
        last_name: p.last_name?.trim() || undefined,
        occupation: p.occupation?.trim() || undefined,
        description: p.description?.trim() || undefined,
      }))
      .filter((p) => p.first_name);
  }

  if (actionType === "buy") {
    const price = normalized.purchase?.price;
    if (!normalized.purchase || typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return { allow: false, reason: "invalid_purchase_payload" };
    }
    return { allow: true, action: normalized };
  }

  if (actionType === "marry") {
    const spouse = (normalized.family_membership?.spouse_name || "").trim();
    if (!spouse) return { allow: false, reason: "marriage_missing_spouse_name" };
    normalized.family_membership = {
      ...(normalized.family_membership || {}),
      spouse_name: spouse,
    };
    normalized.relationship_event = "marriage";
    return { allow: true, action: normalized, reason: "normalized" };
  }

  if (actionType === "child_birth") {
    const child = (normalized.family_membership?.child_name || "").trim();
    if (!child) return { allow: false, reason: "child_birth_missing_child_name" };
    if (typeof being.birth_year === "number") {
      const age = sandbox.current_year - being.birth_year;
      if (age < 14) return { allow: false, reason: "child_birth_age_implausible" };
    }
    normalized.family_membership = {
      ...(normalized.family_membership || {}),
      child_name: child,
    };
    normalized.relationship_event = "child_birth";
    return { allow: true, action: normalized, reason: "normalized" };
  }

  if (actionType === "adopt_pet") {
    const species = (normalized.pet?.species || "").trim();
    if (!species) return { allow: false, reason: "pet_missing_species" };
    normalized.pet = {
      species,
      name: normalized.pet?.name?.trim() || undefined,
      acquisition_mode: normalized.pet?.acquisition_mode || "adopt",
    };
    return { allow: true, action: normalized, reason: "normalized" };
  }

  if (actionType === "change_occupation") {
    const nextOccupation = (normalized.occupation_change?.occupation || "").trim();
    if (!nextOccupation) return { allow: false, reason: "occupation_change_missing_target" };
    if ((being.occupation || "").trim().toLowerCase() === nextOccupation.toLowerCase()) {
      return { allow: false, reason: "occupation_change_same_value" };
    }
    normalized.occupation_change = { occupation: nextOccupation };
    return { allow: true, action: normalized, reason: "normalized" };
  }

  return { allow: true, action: normalized };
}
