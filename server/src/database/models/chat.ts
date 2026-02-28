import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const chatSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    type: {
      type: String,
      enum: ["text", "image", "audio", "video", "introduction", "suggested_action", "memory", "moderation", "info"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["texting", "in_person"],
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "npc", "system", "event", "place"],
      required: true,
    },
    sender_id: { type: ObjectId },
    event_id: { type: ObjectId, ref: "Event", index: true },
    thumbs_up: { type: Boolean, default: false },
    thumbs_down: { type: Boolean, default: false },
    content: { type: String, required: true },
    image_url: { type: String },
    world_state: { type: ObjectId, ref: "WorldState" },
    year: { type: Number },
    month: { type: Number },
    day: { type: Number },
    city: { type: String },
    feeling: { type: String },
    status: { type: String, enum: ["pending", "accepted", "dismissed"] },
  },
  { timestamps: true }
);

chatSchema.index({ sender_id: 1, user: 1, createdAt: -1 });

export const Chat = mongoose.model("chat", chatSchema);
