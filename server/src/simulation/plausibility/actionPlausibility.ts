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
  const normalized: IPlannedAction = {
    ...action,
    action: (action.action || "").trim(),
    reason: (action.reason || "").trim(),
    place: (action.place || "").trim() || undefined,
    city: (action.city || "").trim() || undefined,
    country: (action.country || "").trim() || undefined,
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

  if (actionType === "discover_place") {
    const placeName = (normalized.discovery_place?.name || normalized.place || "").trim();
    if (!placeName) return { allow: false, reason: "discover_place_missing_name" };
    normalized.discovery_place = {
      ...(normalized.discovery_place || { name: placeName }),
      name: placeName,
      latitude: typeof normalized.discovery_place?.latitude === "number" ? clamp(normalized.discovery_place.latitude, -90, 90) : normalized.latitude,
      longitude: typeof normalized.discovery_place?.longitude === "number" ? clamp(normalized.discovery_place.longitude, -180, 180) : normalized.longitude,
    };
    normalized.place = normalized.place || placeName;
    return { allow: true, action: normalized, reason: "normalized" };
  }

  if (actionType === "discover_person") {
    const firstName = (normalized.discovery_person?.first_name || "").trim();
    if (!firstName) return { allow: false, reason: "discover_person_missing_first_name" };
    normalized.discovery_person = {
      ...normalized.discovery_person,
      first_name: firstName,
      last_name: normalized.discovery_person?.last_name?.trim() || undefined,
      occupation: normalized.discovery_person?.occupation?.trim() || undefined,
      description: normalized.discovery_person?.description?.trim() || undefined,
    };
    return { allow: true, action: normalized, reason: "normalized" };
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
