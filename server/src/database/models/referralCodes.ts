import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const referralCodeSchema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    max_uses: {
      type: Number,
      required: true,
    },
    uses: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export const ReferralCode = mongoose.model("ReferralCode", referralCodeSchema);
