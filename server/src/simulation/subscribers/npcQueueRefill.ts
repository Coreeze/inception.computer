import {
  HeartbeatSubscriber,
  HeartbeatContext,
} from "../heartbeat/heartbeatSubscribers";
import { generateAllNPCPlans } from "../../services/npc/planner";

export const npcQueueRefill: HeartbeatSubscriber = {
  name: "npc_queue_refill",
  async onHeartbeat(ctx: HeartbeatContext) {
    const mainQueueLength = ctx.character.ai_action_queue?.length || 0;
    const shouldRefillMain = !!ctx.sandbox.free_will_enabled && mainQueueLength <= 7;
    const shouldRefillAnyNpc = ctx.npcs.some((npc) => (npc.ai_action_queue?.length || 0) <= 7);
    if (!shouldRefillMain && !shouldRefillAnyNpc) return;
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
