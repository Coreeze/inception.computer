import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const householdSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    name: { type: String, required: true },
    main_character: { type: ObjectId, ref: "Beings", required: true },
    location: { type: ObjectId, ref: "Location" },
    address: { type: ObjectId, ref: "Places" },
    members: [
      {
        being: { type: ObjectId, ref: "Beings", required: true },
        role: {
          type: String,
          enum: ["head", "partner", "child", "dependent", "roommate"],
          required: true,
        },
        joined_at: { type: Date, required: true },
        left_at: { type: Date, default: null },
      },
    ],
    shared_finances: {
      combined_income: { type: Number, default: 0 },
      shared_expenses: { type: Number, default: 0 },
      savings_pool: { type: Number, default: 0 },
    },
    housing: {
      type: {
        type: String,
        enum: ["homeless", "shelter", "room", "apartment", "house", "mansion", "estate"],
        default: "apartment",
      },
      ownership: {
        type: String,
        enum: ["homeless", "renting", "mortgaged", "owned"],
        default: "renting",
      },
      bedrooms: { type: Number, default: 1 },
      monthly_cost: { type: Number, default: 0 },
      condition: {
        type: String,
        enum: ["decrepit", "worn", "average", "nice", "luxury"],
        default: "average",
      },
    },
    harmony: { type: Number, min: 0, max: 100, default: 75 },
    chore_distribution: {
      type: String,
      enum: ["equal", "unequal", "one_sided"],
      default: "equal",
    },
    is_active: { type: Boolean, default: true },
    dissolved_at: Date,
    dissolved_reason: { type: String, enum: ["empty", "merged", "split"] },
  },
  { timestamps: true }
);

householdSchema.index({ user: 1, is_active: 1 });
householdSchema.index({ "members.being": 1 });

export interface IHouseholdDocument extends mongoose.Document {
  name: string;
  user: ObjectId;
  main_character: ObjectId;
  location?: ObjectId;
  address?: ObjectId;
  members: {
    being: ObjectId;
    role: string;
    joined_at: Date;
    left_at?: Date;
  }[];
  shared_finances: {
    combined_income: number;
    shared_expenses: number;
    savings_pool: number;
  };
  housing: {
    type: string;
    ownership: string;
    bedrooms: number;
    monthly_cost: number;
    condition: string;
  };
  harmony: number;
  chore_distribution: string;
  is_active: boolean;
  dissolved_at?: Date;
  dissolved_reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Household = mongoose.model<IHouseholdDocument>("Household", householdSchema);
