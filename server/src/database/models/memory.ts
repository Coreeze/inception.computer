import mongoose from "mongoose";
import { ObjectId } from "mongodb";

/**
 * MEMORY
 *
 * Inception's memory system:
 * - memory_md: rich narrative markdown (LLM-consumable context)
 * - importance: 1-5 integer scoring
 * - type: classification for retrieval
 * - decay_factor: time-based decay (starts at 1.0)
 * - retrieval_count: tracks how often this memory surfaces
 *
 * Retrieval score = importance × decay_factor × recency_weight
 * Memories with importance 1-2 get compressed periodically.
 * Memories with importance 4-5 persist indefinitely.
 */

const memorySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    owner: { type: ObjectId, ref: "Beings", required: true },

    memory_md: { type: String, required: true },
    importance: { type: Number, required: true, min: 1, max: 5, default: 3 },

    type: {
      type: String,
      enum: ["observation", "reflection", "conversation", "event", "emotion"],
      required: true,
      default: "observation",
    },

    involved_beings: { type: [ObjectId], ref: "Beings", default: [] },
    involved_places: { type: [ObjectId], ref: "Places", default: [] },

    sim_year: { type: Number },
    sim_month: { type: Number },
    sim_day: { type: Number },

    decay_factor: { type: Number, default: 1.0, min: 0, max: 1 },
    retrieval_count: { type: Number, default: 0 },

    tags: { type: [String], default: [] },

    is_compressed: { type: Boolean, default: false },
    compressed_from: { type: [ObjectId], ref: "Memory", default: [] },
  },
  { timestamps: true }
);

memorySchema.index({ owner: 1, importance: -1 });
memorySchema.index({ main_character: 1, owner: 1, createdAt: -1 });
memorySchema.index({ owner: 1, type: 1 });

export interface IMemory extends mongoose.Document {
  user: mongoose.Types.ObjectId | string;
  main_character: mongoose.Types.ObjectId | string;
  owner: mongoose.Types.ObjectId | string;
  memory_md: string;
  importance: number;
  type: "observation" | "reflection" | "conversation" | "event" | "emotion";
  involved_beings: (mongoose.Types.ObjectId | string)[];
  involved_places: (mongoose.Types.ObjectId | string)[];
  sim_year?: number;
  sim_month?: number;
  sim_day?: number;
  decay_factor: number;
  retrieval_count: number;
  tags: string[];
  is_compressed: boolean;
  compressed_from: (mongoose.Types.ObjectId | string)[];
  createdAt: Date;
  updatedAt: Date;
}

export const Memory = mongoose.model<IMemory>("Memory", memorySchema);
