import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const MODELS = {
  fast: "mistralai/mistral-small-3.1-24b-instruct",
  smart: "mistralai/mistral-medium-3.1",
  reasoning: "mistralai/mistral-large-2411",
} as const;

type ModelTier = keyof typeof MODELS;

interface CompletionOptions {
  model?: ModelTier;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function complete({
  model = "fast",
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxTokens = 2048,
  jsonMode = false,
}: CompletionOptions): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const response = await openrouter.chat.completions.create({
    model: MODELS[model],
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode && { response_format: { type: "json_object" } }),
  });

  return response.choices[0]?.message?.content || "";
}

export async function completeJSON<T = Record<string, any>>({
  model = "fast",
  systemPrompt,
  userPrompt,
  temperature = 0.4,
  maxTokens = 2048,
}: Omit<CompletionOptions, "jsonMode">): Promise<T> {
  const raw = await complete({
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
    jsonMode: true,
  });

  try {
    return JSON.parse(raw) as T;
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(`Failed to parse JSON from LLM response: ${raw.slice(0, 200)}`);
  }
}

export { openrouter };
