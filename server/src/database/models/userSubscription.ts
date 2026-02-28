import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const userSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "Users",
      required: true,
      unique: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    subscriptionTier: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    subscriptionStart: {
      type: Date,
    },
    subscriptionEnd: {
      type: Date,
    },
    stripeSubscriptionId: {
      type: String,
    },
    memoryVaultCapacity: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

export const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);
