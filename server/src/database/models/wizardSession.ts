import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const proposalSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["create_place", "create_npc", "create_entity", "update_db", "create_quest"],
      required: true,
    },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { _id: false }
);

const toolCallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    args: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["player", "wizard", "system"], required: true },
    content: { type: String, default: "" },
    proposals: { type: [proposalSchema], default: [] },
    tool_calls: { type: [toolCallSchema], default: [] },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const actionExecutedSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const wizardSessionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    character: { type: ObjectId, ref: "Beings", required: true },
    sandbox: { type: ObjectId, ref: "Sandbox", required: true },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
    initial_intent: { type: String, required: true },
    turns: { type: [turnSchema], default: [] },
    actions_executed: { type: [actionExecutedSchema], default: [] },
  },
  { timestamps: true }
);

wizardSessionSchema.index({ character: 1, status: 1, createdAt: -1 });
wizardSessionSchema.index({ user: 1, createdAt: -1 });

export interface IWizardSessionDocument extends mongoose.Document {
  user: ObjectId;
  character: ObjectId;
  sandbox: ObjectId;
  status: "active" | "completed" | "abandoned";
  initial_intent: string;
  turns: Array<{
    role: "player" | "wizard" | "system";
    content: string;
    proposals: Array<{
      id: string;
      type: string;
      data: any;
      description: string;
      status: "pending" | "approved" | "rejected";
    }>;
    tool_calls: Array<{ name: string; args: any; result: any }>;
    timestamp: Date;
  }>;
  actions_executed: Array<{
    type: string;
    description: string;
    result: any;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const WizardSession = mongoose.model<IWizardSessionDocument>("WizardSession", wizardSessionSchema);
