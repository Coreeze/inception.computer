import mongoose from "mongoose";

const llmLogSchema = new mongoose.Schema(
  {
    sandbox: { type: mongoose.Types.ObjectId, ref: "Sandbox", required: true },
    heartbeat_id: { type: mongoose.Types.ObjectId },
    call_type: {
      type: String,
      enum: [
        "choice_generation",
        "outcome_evaluation",
        "milestone_replacement",
        "init_generation",
        "npc_chat",
        "event",
        "npc_planning",
        "memory_compression",
      ],
      required: true,
    },
    llm_model: { type: String, required: true },
    prompt: { type: String, required: true },
    response: { type: Object, required: true },
    latency_ms: { type: Number },
    input_tokens: { type: Number },
    output_tokens: { type: Number },
  },
  { timestamps: true }
);

llmLogSchema.index({ sandbox: 1, call_type: 1 });
llmLogSchema.index({ heartbeat_id: 1 });

export interface ILLMLog extends mongoose.Document {
  sandbox: mongoose.Types.ObjectId;
  heartbeat_id?: mongoose.Types.ObjectId;
  call_type: string;
  llm_model: string;
  prompt: string;
  response: Record<string, any>;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const LLMLog = mongoose.model<ILLMLog>("LLMLog", llmLogSchema);
