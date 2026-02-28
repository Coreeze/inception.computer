import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    type: {
      type: String,
      enum: [
        "newNPC",
        "newPlace",
        "newMemory",
        "relationship_change",
        "occupation_change",
        "romantic_interest_change",
      ],
      required: true,
    },
    text: { type: String, required: true },
    read: { type: Boolean, default: false, required: true },
    npcs: { type: [ObjectId] },
    places: { type: [ObjectId] },
    year: { type: Number },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("notification", notificationSchema);
