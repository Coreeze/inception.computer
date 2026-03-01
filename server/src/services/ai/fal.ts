const FAL_IMAGE_ENDPOINT = "https://fal.run/fal-ai/flux-2/flash";

interface FalImageItem {
  url?: string;
}

interface FalImageResponse {
  images?: FalImageItem[];
  data?: {
    images?: FalImageItem[];
  };
}

export const IMAGE_STYLE_PREFIX = "sims 4 style, realistic, photo no text, no logos:";

interface GenerateFluxImageOptions {
  imageSize?: string;
}

function extractFirstImageURL(payload: FalImageResponse): string | null {
  const directURL = payload.images?.[0]?.url;
  if (directURL) return directURL;
  const nestedURL = payload.data?.images?.[0]?.url;
  if (nestedURL) return nestedURL;
  return null;
}

export async function generateFlux2FastImage(prompt: string, options?: GenerateFluxImageOptions): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY is not configured");
  }

  const composedPrompt = `${IMAGE_STYLE_PREFIX} ${prompt}`.trim();
  const response = await fetch(FAL_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: composedPrompt,
      num_images: 1,
      image_size: options?.imageSize || "portrait_16_9",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FAL request failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as FalImageResponse;
  const imageURL = extractFirstImageURL(payload);
  if (!imageURL) {
    throw new Error("FAL did not return an image URL");
  }
  return imageURL;
}
