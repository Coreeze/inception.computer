import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const lookAssetsSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        "jacket", "sweater", "shirt", "tshirt", "pants", "shorts",
        "dress", "accessory", "shoes", "bag", "hat", "glasses", "makeup", "hair",
      ],
    },
    artwork_style: { type: String, required: true },
    prompt: { type: String, required: true },
    image_url: { type: String, required: true },
    used_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const LookAssets = mongoose.model("LookAssets", lookAssetsSchema);
