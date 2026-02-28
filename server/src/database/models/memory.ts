import mongoose from "mongoose";
import { ObjectId } from "mongodb";

export interface IMemory {
  user: ObjectId;
  main_character: ObjectId;
  owner: ObjectId;
  content: string;
  involved_characters: ObjectId[];
  involved_places: ObjectId[];
  in_world_date: string;
  reactions: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemoryDocument extends mongoose.Document, IMemory {}

const memorySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    owner: { type: ObjectId, ref: "Beings", required: true },
    content: { type: String, required: true },
    feeling: { type: String },
    emotional_weight: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    year: { type: Number },
    reinforcement_count: { type: Number, default: 1 },
    involved_characters: { type: [ObjectId], ref: "Beings" },
    involved_places: { type: [ObjectId], ref: "Places" },
    in_world_date: { type: String },
    reactions: { type: String, enum: ["love", "laugh", "sad", "wow", "angry"] },
  },
  { timestamps: true }
);

memorySchema.index({ main_character: 1, owner: 1, createdAt: -1 });

export const Memory = mongoose.model<IMemoryDocument>("Memory", memorySchema);
