import mongoose from "mongoose";

const supportChatSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "aiCris"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
  },
  { timestamps: true }
);

export const SupportChat = mongoose.model("supportChat", supportChatSchema);
