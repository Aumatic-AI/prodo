import OpenAI from "openai";
import { env } from "@/config/env";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

const TEXT_MODEL = "gpt-6.1-sol";

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const completion = await getClient().chat.completions.create({
    model: TEXT_MODEL,
    messages,
  });
  return completion.choices[0]?.message?.content || "";
}

export async function generateTextWithImage(prompt: string, imageUrl: string, systemPrompt?: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ],
  });

  const completion = await getClient().chat.completions.create({
    model: TEXT_MODEL,
    messages,
  });
  return completion.choices[0]?.message?.content || "";
}

export function parseJsonResponse(text: string): any {
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}
