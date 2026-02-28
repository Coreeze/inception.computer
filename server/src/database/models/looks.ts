import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const looksSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    character: { type: ObjectId, ref: "Beings", required: true },
    name: { type: String, required: true },
    default_image_url: { type: String, required: true },
    artwork_style: { type: String, required: true },
    reference_body: { type: String },
    prompt: { type: String },
    gallery: { type: [String] },
    assets: { type: [ObjectId], ref: "LookAssets" },
  },
  { timestamps: true }
);

export const Looks = mongoose.model("Looks", looksSchema);
