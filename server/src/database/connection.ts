import mongoose from "mongoose";

export const connectToDB = async () => {
  console.log("⚠️  Connecting to MongoDB...");
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.log("❌ Failed to connect to MongoDB");
    console.log(error);
  }
};
