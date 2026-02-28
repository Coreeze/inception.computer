interface FieldDef {
  key: string;
  label: string;
  formatter?: (val: any) => string;
}

function stringify(character: any, fields: FieldDef[]): string {
  return fields
    .map((field) => {
      const value = field.key
        .split(".")
        .reduce((obj, key) => obj?.[key], character);
      if (value === undefined || value === null || value === "") return "";
      const displayValue = field.formatter ? field.formatter(value) : value;
      return `${field.label}: ${displayValue}`;
    })
    .filter(Boolean)
    .join("\n");
}

const CHARACTER_FIELDS: FieldDef[] = [
  { key: "first_name", label: "first name" },
  { key: "last_name", label: "last name" },
  { key: "gender", label: "gender" },
  { key: "occupation", label: "occupation" },
  { key: "romantic_interest", label: "romantic interest" },
  { key: "relationship_status", label: "relationship status" },
  { key: "health_index", label: "health status" },
  { key: "wealth_index", label: "wealth status" },
  { key: "vibe_index", label: "emotional status" },
  { key: "description", label: "description" },
  { key: "soul_md", label: "soul" },
  { key: "life_md", label: "life" },
];

const NPC_FIELDS: FieldDef[] = [
  { key: "gender", label: "gender" },
  { key: "occupation", label: "occupation" },
  { key: "romantic_interest", label: "romantic interest" },
  { key: "relationship_status", label: "relationship status" },
  { key: "current_city", label: "current city" },
  { key: "current_country", label: "current country" },
  { key: "texting_pattern", label: "texting pattern" },
  { key: "health_index", label: "health status" },
  { key: "wealth_index", label: "wealth status" },
  { key: "vibe_index", label: "emotional status" },
  { key: "description", label: "description" },
  { key: "relationship_to_main_character", label: "relationship to main character" },
  { key: "soul_md", label: "soul" },
  { key: "life_md", label: "life" },
];

export function stringifyCharacter(character: any): string {
  return stringify(character, CHARACTER_FIELDS);
}

export function stringifyNPC(npc: any): string {
  return stringify(npc, NPC_FIELDS);
}
