import {
  HeartbeatSubscriber,
  HeartbeatContext,
} from "../heartbeat/heartbeatSubscribers";
import { generateAllNPCPlans } from "../../services/npc/planner";

export const npcQueueRefill: HeartbeatSubscriber = {
  name: "npc_queue_refill",
  async onHeartbeat(ctx: HeartbeatContext) {
    const shouldRefill =
      ctx.heartbeatCount === 1 || ctx.heartbeatCount % 7 === 0;
    if (!shouldRefill) return;
    try {
      const updated = await generateAllNPCPlans({ sandbox: ctx.sandbox });
      if (updated.length > 0) {
        ctx.npcs = updated;
      }
    } catch (err) {
      console.error("NPC queue refill failed:", err);
    }
  },
};
