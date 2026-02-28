import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    latestAppVersion: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const Version = mongoose.model("Version", versionSchema);
