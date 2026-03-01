import mongoose from "mongoose";
import { generateFlux2FastImage } from "./fal";

const inFlightPortraits = new Set<string>();

export function buildBeingImagePrompt(being: any): string {
  const details = [
    `${(being.first_name || "").trim()} ${(being.last_name || "").trim()}`.trim(),
    being.gender || "",
    being.occupation || "",
    being.description || "",
    being.body_type || "",
    being.skin_tone || "",
    being.hair_color || "",
    being.hair_type || "",
    being.eye_color || "",
    being.eye_emotions || "",
    typeof being.glasses === "boolean" ? (being.glasses ? "wearing glasses" : "no glasses") : "",
    being.current_city && being.current_country ? `living in ${being.current_city}, ${being.current_country}` : "",
  ]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const fallback = "a character portrait, close-up headshot with a natural expression";
  return details.length > 0 ? `portrait, close-up headshot, ${details.join(", ")}` : fallback;
}

export async function generateBeingPortrait(beingId: string): Promise<string | null> {
  if (inFlightPortraits.has(beingId)) return null;
  inFlightPortraits.add(beingId);

  try {
    const Being = mongoose.model("Beings");
    const being = await Being.findById(beingId);
    if (!being || (being as any).image_url) return (being as any)?.image_url || null;

    const prompt = buildBeingImagePrompt(being);
    const imageUrl = await generateFlux2FastImage(prompt, { imageSize: "portrait_16_9" });

    await Being.findByIdAndUpdate(beingId, { image_url: imageUrl });
    return imageUrl;
  } catch (err) {
    console.error(`Portrait generation failed for being ${beingId}:`, err);
    return null;
  } finally {
    inFlightPortraits.delete(beingId);
  }
}

export function generateBeingPortraitBackground(beingId: string): void {
  generateBeingPortrait(beingId).catch(() => {});
}
