import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "Users",
      required: true,
    },
    type: {
      type: String,
      enum: ["topup", "spend", "subscription"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    model: {
      type: String,
    },
    description: {
      type: String,
    },
    stripe_transaction_id: {
      type: String,
    },
    stripe_customer_id: {
      type: String,
    },
    stripe_payment_method_id: {
      type: String,
    },
    stripe_payment_intent_id: {
      type: String,
    },
    stripe_subscription_id: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model("transaction", transactionSchema);
