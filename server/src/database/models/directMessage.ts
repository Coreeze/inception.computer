import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema(
  {
    conversationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    recipientID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    reaction: {
      type: String,
      enum: ["like", "dislike", "love", "laugh", "sad", "angry", "wow"],
      default: null,
    },
  },
  { timestamps: true }
);

directMessageSchema.index({ senderID: 1, recipientID: 1 });
directMessageSchema.index({ recipientID: 1, read: 1 });

export const DirectMessage = mongoose.model(
  "directMessage",
  directMessageSchema
);
