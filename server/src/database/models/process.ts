import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const processSchema = new mongoose.Schema(
  {
    sandbox: { type: ObjectId, ref: "Sandbox", required: true },
    name: { type: String, required: true },
    interval_days: { type: Number, required: true },
    action: { type: Object, required: true },
    description: { type: String },
    mode: { type: String, default: "passive" },
    edge: { type: ObjectId, ref: "Edge" },
    last_run_at: { type: Date },
    next_run_at: { type: Date },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

processSchema.index({ sandbox: 1, is_active: 1, next_run_at: 1 });
processSchema.index({ edge: 1 });

export const Process = mongoose.model("Process", processSchema);
