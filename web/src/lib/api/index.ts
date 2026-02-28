const API_BASE =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080";

export class CharacterDeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterDeadError";
  }
}

export function isCharacterDeadError(e: unknown): e is CharacterDeadError {
  return e instanceof CharacterDeadError;
}

export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error || `API error ${res.status}`;
    if (res.status === 403 && String(message).toLowerCase().includes("dead")) {
      throw new CharacterDeadError(message);
    }
    throw new Error(message);
  }
  return res.json();
}

export function getPlayerID(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("inception_player_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("inception_player_id", id);
  }
  return id;
}

export function getCharacterID(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("inception_character_id");
}

export function setCharacterID(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem("inception_character_id", id);
  else localStorage.removeItem("inception_character_id");
}
