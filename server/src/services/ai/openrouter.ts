import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://resource-ties-purposes-receives.trycloudflare.com/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const MODELS = {
  fast: "mistralai/Ministral-3-14B-Instruct-2512",
  smart: "mistralai/Ministral-3-14B-Instruct-2512",
  reasoning: "mistralai/Ministral-3-14B-Instruct-2512",
} as const;

type ModelTier = keyof typeof MODELS;

interface CompletionOptions {
  model?: ModelTier;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
}

function extractJSONString(raw: string): string {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : cleaned;
}

export async function completeJSON<T = Record<string, any>>({
  model = "fast",
  systemPrompt,
  userPrompt,
  maxTokens = 2048,
}: CompletionOptions): Promise<T> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const response = await openrouter.chat.completions.create({
    model: MODELS[model],
    messages,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "";
  try {
    return JSON.parse(extractJSONString(raw)) as T;
  } catch (firstError: any) {
    // Retry once with a cheap JSON-repair pass to avoid expensive caller fallbacks.
    const repairResponse = await openrouter.chat.completions.create({
      model: MODELS.fast,
      messages: [
        {
          role: "system",
          content:
            "You repair invalid JSON. Return only valid RFC8259 JSON. Do not add or remove semantic fields.",
        },
        {
          role: "user",
          content: `Repair this JSON and return only corrected JSON:\n\n${raw}`,
        },
      ],
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const repairedRaw = repairResponse.choices[0]?.message?.content || "";
    try {
      return JSON.parse(extractJSONString(repairedRaw)) as T;
    } catch {
      throw new Error(
        `Failed to parse JSON from LLM response after repair: ${firstError?.message || "unknown parse error"}`
      );
    }
  }
}

export { openrouter };
