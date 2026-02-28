import { ObjectId } from "mongodb";

type ChoiceResponse = {
  situation?: string;
  option_a?: Record<string, unknown>;
  option_b?: Record<string, unknown>;
};

const store = new Map<string, ChoiceResponse>();

function toKey(heartbeatId: string | ObjectId): string {
  return typeof heartbeatId === "string" ? heartbeatId : heartbeatId.toString();
}

export function setChoice(heartbeatId: string | ObjectId, response: ChoiceResponse): void {
  store.set(toKey(heartbeatId), response);
}

export function getChoice(heartbeatId: string | ObjectId): ChoiceResponse | undefined {
  return store.get(toKey(heartbeatId));
}

export function deleteChoice(heartbeatId: string | ObjectId): void {
  store.delete(toKey(heartbeatId));
}
