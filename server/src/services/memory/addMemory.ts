import { ObjectId } from "mongodb";
import { Being } from "../../database/models/being";

/**
 * Append memory text to a Being's life_md.
 * No separate Memory model — narrative lives in life_md.
 */
export async function addMemory({
  ownerID,
  memoryMd,
  simYear,
  simMonth,
  simDay,
}: {
  ownerID: string | ObjectId;
  memoryMd: string;
  simYear?: number;
  simMonth?: number;
  simDay?: number;
}): Promise<void> {
  if (!memoryMd || memoryMd.trim() === "") return;

  const being = await Being.findById(ownerID);
  if (!being) return;

  const dateStr =
    simYear != null && simMonth != null && simDay != null
      ? `${simMonth}/${simDay}/${simYear}`
      : "";
  const line = dateStr ? `\n- **${dateStr}** — ${memoryMd.trim()}` : `\n- ${memoryMd.trim()}`;

  being.life_md = (being.life_md || "") + line;
  await being.save();
}
