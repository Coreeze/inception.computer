import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const entitySchema = new mongoose.Schema(
  {
    sandbox: { type: ObjectId, ref: "Sandbox" },
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String },
    properties: { type: Object },
    parent: { type: ObjectId, ref: "Entity", default: null },
    owner: { type: ObjectId, refPath: "ownerType", default: null },
    ownerType: { type: String, enum: ["character", "entity"], default: null },
    purchaseable: { type: Boolean, default: false },
    purchase_price: { type: Number, default: 0 },
    longitude: { type: Number, min: -180, max: 180 },
    latitude: { type: Number, min: -90, max: 90 },
    md: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Entity = mongoose.model("Entity", entitySchema);
