import mongoose from "mongoose";

/**
 * inception.computer has no auth; players get auto-created
 * with a player_id stored in localStorage.
 */
const userSchema = new mongoose.Schema(
  {
    player_id: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    is_anonymous: { type: Boolean, default: true },
    credits: { type: Number, default: 200, required: true },
    plan: {
      type: String,
      enum: ["free", "plus_weekly", "plus_monthly"],
      default: "free",
      required: true,
    },
    user_tier: { type: String, default: "founding" },
    verified: { type: Boolean, default: false },
    username: { type: String, trim: true },
    image_url: { type: String },
    bio: { type: String },
    installed_pwa: { type: Boolean },
    accepted_terms: { type: Boolean },
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  if (!this.username) {
    const adj = ["Cosmic", "Silent", "Swift", "Bold", "Lucid", "Vivid", "Zen", "Neon"];
    const noun = ["Agent", "Mind", "Spark", "Wave", "Ghost", "Drift", "Echo", "Node"];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    const num = Math.floor(Math.random() * 100000);
    this.username = `${a}${n}_${num}`;
  }
  next();
});

export const User = mongoose.model("Users", userSchema);
