import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    player_id: { type: String, unique: true, sparse: true },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    is_anonymous: { type: Boolean, default: false },
    credits: { type: Number, default: 200, required: true },
    plan: {
      type: String,
      enum: ["free", "plus_weekly", "plus_monthly"],
      default: "free",
      required: true,
    },
    user_tier: { type: String, default: "founding" },
    verified: { type: Boolean, default: false },
    x_url: { type: String },
    instagram_url: { type: String },
    tiktok_url: { type: String },
    youtube_url: { type: String },
    website_url: { type: String },
    discord_url: { type: String },
    bio: { type: String },
    username: { type: String, trim: true },
    image_url: { type: String },
    twitter_handle: { type: String },
    installed_pwa: { type: Boolean },
    accepted_terms: { type: Boolean },
    stripe_id: { type: String, trim: true },
  },
  { timestamps: true }
);

userSchema.pre("save", function (next) {
  if (!this.username) {
    const words = [
      "Sun", "Flower", "Sim", "Moon", "Sunflower", "Sky", "Cloud", "Grass",
      "Tree", "Water", "Fire", "Earth", "Air", "Dark", "Light", "Magic",
      "Power", "Energy", "Mystic", "Enchant", "Wanderer", "Sorcerer", "Dancer",
    ];
    const words2 = [
      "Fish", "Bird", "Dog", "Cat", "Horse", "Rabbit", "Snake", "Frog",
      "Tiger", "Elephant", "Lion", "Giraffe", "Zebra", "Monkey", "Panda",
      "Koala", "Raccoon", "Fox", "Bear", "Wolf", "Gorilla",
    ];
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const randomWord2 = words2[Math.floor(Math.random() * words2.length)];
    const randomNumbers = Math.floor(Math.random() * 100000000).toString();
    this.username = `${randomWord}${randomWord2}_${randomNumbers}`;
  }
  next();
});

export const User = mongoose.model("Users", userSchema);
