import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const edgeSchema = new mongoose.Schema(
  {
    sandbox: { type: ObjectId, ref: "Sandbox", required: true },
    type: { type: String, required: true },
    from: { type: ObjectId, refPath: "fromType", required: true },
    fromType: {
      type: String,
      enum: ["Being", "Entity", "Place", "Object"],
      required: true,
    },
    to: { type: ObjectId, refPath: "toType", required: true },
    toType: {
      type: String,
      enum: ["Being", "Entity", "Place", "Object"],
      required: true,
    },
    md: { type: String, default: "" },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

edgeSchema.index({ sandbox: 1, type: 1, is_active: 1 });
edgeSchema.index({ from: 1, fromType: 1 });
edgeSchema.index({ to: 1, toType: 1 });

export const Edge = mongoose.model("Edge", edgeSchema);
