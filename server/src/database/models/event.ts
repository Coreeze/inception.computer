import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const eventSchema = new mongoose.Schema(
  {
    character: { type: ObjectId, ref: "Beings", required: true, index: true },
    user: { type: ObjectId, ref: "Users", required: true, index: true },
    category: {
      type: String,
      enum: ["mundane", "world_news"],
      required: true,
      index: true,
    },
    sim_year: { type: Number, required: true, index: true },
    sim_month: { type: Number, required: true },
    sim_day: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String },
    location: { type: ObjectId, ref: "Places" },
    location_name: { type: String },
    longitude: { type: Number, min: -180, max: 180 },
    latitude: { type: Number, min: -90, max: 90 },
    participants: { type: [ObjectId], ref: "Beings", default: [] },
    participant_names: { type: [String], default: [] },
    md: { type: String, default: "" },
    setting: { type: String, default: "" },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    quest_index: { type: Number },
    quest_step_index: { type: Number },
    quest_title: { type: String },
  },
  { timestamps: true }
);

eventSchema.index({ character: 1, category: 1, sim_year: 1, sim_month: 1, sim_day: 1 });
eventSchema.index({ character: 1, category: 1, sim_year: -1, sim_month: -1, sim_day: -1 });

export interface IEventDocument extends mongoose.Document {
  character: ObjectId;
  user: ObjectId;
  category: "mundane" | "world_news";
  sim_year: number;
  sim_month: number;
  sim_day: number;
  title: string;
  description?: string;
  location?: ObjectId;
  location_name?: string;
  longitude?: number;
  latitude?: number;
  participants: ObjectId[];
  participant_names: string[];
  md?: string;
  setting?: string;
  status?: "active" | "ended";
  quest_index?: number;
  quest_step_index?: number;
  quest_title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Event = mongoose.model<IEventDocument>("Event", eventSchema);
