import { IBeing } from "../../database/models/being";
import { ISandboxDocument } from "../../database/models/sandbox";
import { beingDecay } from "../subscribers/beingDecay";
import { npcQueueRefill } from "../subscribers/npcQueueRefill";

export interface MilestoneEvent {
  type: "life_mission_completed";
  data: Record<string, any>;
}

export interface HeartbeatContext {
  character: IBeing;
  sandbox: ISandboxDocument;
  npcs: IBeing[];
  heartbeatCount: number;
  milestoneEvents: MilestoneEvent[];
}

export interface HeartbeatSubscriber {
  name: string;
  onHeartbeat: (context: HeartbeatContext) => Promise<void> | void;
}

const subscribers: HeartbeatSubscriber[] = [beingDecay, npcQueueRefill];

export async function broadcastHeartbeat(context: HeartbeatContext): Promise<void> {
  for (const sub of subscribers) {
    await sub.onHeartbeat(context);
  }
}
