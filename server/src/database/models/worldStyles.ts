import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const worldStylesSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    name: { type: String, required: true },
    id: { type: String, required: true },
    examples: { type: [String], required: true },
    character_prompt: { type: String, required: true },
    character_prompt_from_image: { type: String },
    background_image: { type: String },
    object_prompt: { type: String },
    environment_prompt: { type: String },
    place_prompt: { type: String },
  },
  { timestamps: true }
);

export interface IWorldStyles extends mongoose.Document {
  user: ObjectId;
  name: string;
  id: string;
  examples: string[];
  character_prompt: string;
  character_prompt_from_image?: string;
  background_image: string;
  object_prompt: string;
  environment_prompt: string;
  place_prompt: string;
}

export const WorldStyles = mongoose.model<IWorldStyles>("WorldStyles", worldStylesSchema);
