import mongoose from "mongoose";
import { ObjectId } from "mongodb";

import "./worldStyles";

const DEFAULT_ARTWORK_STYLE = "68d2400c61cd0dea7526beff";

const sandboxSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    artwork_style: { type: String, ref: "WorldStyles", default: DEFAULT_ARTWORK_STYLE },

    start_year: { type: Number, required: true, default: 2026 },
    start_month: { type: Number, required: true, min: 1, max: 12, default: 1 },
    start_day: { type: Number, required: true, min: 1, max: 31, default: 1 },

    current_year: { type: Number, required: true, default: 2026 },
    current_month: { type: Number, required: true, min: 1, max: 12, default: 1 },
    current_day: { type: Number, required: true, min: 1, max: 31, default: 1 },

    currency: { type: String },
    day_duration_ms: { type: Number, required: true, default: 2000 },
    heartbeat_count: { type: Number, default: 0 },
    last_heartbeat_at: { type: Date },
    days_since_last_signal: { type: Number, default: 0 },

    being_types: { type: [String], default: ["human", "animal"] },
    entity_types: { type: [String], default: [] },
    location_types: { type: [String], default: [] },
    object_types: { type: [String], default: [] },
    item_types: { type: [String], default: [] },

    free_will_enabled: { type: Boolean, default: false },

    last_activity_at: { type: Date },
    md: { type: String, default: "" },
  },
  { timestamps: true }
);

sandboxSchema.pre("save", function (next) {
  if (!this.artwork_style) this.artwork_style = DEFAULT_ARTWORK_STYLE;
  next();
});

sandboxSchema.index({ user: 1 });

export interface ISandbox {
  user: ObjectId;
  artwork_style: string;
  currency?: string;
  start_year: number;
  start_month: number;
  start_day: number;
  current_year: number;
  current_month: number;
  current_day: number;
  day_duration_ms: number;
  heartbeat_count: number;
  last_heartbeat_at?: Date;
  days_since_last_signal: number;
  free_will_enabled: boolean;
  last_activity_at?: Date;
  md?: string;
  being_types: string[];
  entity_types: string[];
  location_types: string[];
  object_types: string[];
  item_types: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISandboxDocument extends mongoose.Document, ISandbox {}

export const Sandbox = mongoose.model<ISandboxDocument>("Sandbox", sandboxSchema);
