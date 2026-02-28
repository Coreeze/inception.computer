import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const placesSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    sandbox: { type: ObjectId, ref: "Sandbox", required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    name: { type: String, required: true },
    introduced_by: { type: ObjectId, ref: "Beings" },
    introduced_via: {
      type: String,
      enum: [
        "npc_plan",
        "chat",
        "exploration",
        "event",
        "npc_location",
        "player_save",
        "player_discover",
        "landmark",
      ],
    },
    is_pinned: { type: Boolean, default: false },
    pin_order: { type: Number, default: 0 },
    is_home: { type: Boolean, default: false },
    is_work: { type: Boolean, default: false },
    type: { type: String },
    description: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    city: { type: String },
    country: { type: String },
    image_url: { type: String },
    appearance_prompt: { type: String },
    tags: { type: [String], default: [] },
    properties: { type: Object },
    md: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Places = mongoose.model("Places", placesSchema);
