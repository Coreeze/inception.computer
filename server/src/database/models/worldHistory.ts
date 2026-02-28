import mongoose from "mongoose";

const worldHistorySchema = new mongoose.Schema(
  {
    sandbox: { type: mongoose.Types.ObjectId, ref: "Sandbox", required: true },
    heartbeat_id: { type: mongoose.Types.ObjectId },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    day: { type: Number, required: true },
    type: {
      type: String,
      enum: [
        "stat_decay",
        "stat_change",
        "money_change",
        "npc_movement",
        "main_character_movement",
        "event",
        "conversation",
        "relationship",
        "death",
        "birth",
        "place_discovery",
        "heartbeat_processed",
        "choices_presented",
        "choice_resolved",
        "mission_completed",
      ],
      required: true,
    },
    actor_type: { type: String, enum: ["main_character", "npc"] },
    actor_id: { type: mongoose.Types.ObjectId },
    target_type: { type: String, enum: ["main_character", "npc"] },
    target_id: { type: mongoose.Types.ObjectId },
    location: { type: mongoose.Types.ObjectId, ref: "Locations" },
    previous_state: { type: Object },
    new_state: { type: Object },
    change: { type: Object },
    description: { type: String },
    metadata: { type: Object },
  },
  { timestamps: true }
);

export interface IWorldHistory extends mongoose.Document {
  sandbox: mongoose.Types.ObjectId;
  heartbeat_id?: mongoose.Types.ObjectId;
  year: number;
  month: number;
  day: number;
  type: string;
  actor_type?: string;
  actor_id?: mongoose.Types.ObjectId;
  target_type?: string;
  target_id?: mongoose.Types.ObjectId;
  location?: mongoose.Types.ObjectId;
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  change?: Record<string, any>;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const WorldHistory = mongoose.model<IWorldHistory>("WorldHistory", worldHistorySchema);
