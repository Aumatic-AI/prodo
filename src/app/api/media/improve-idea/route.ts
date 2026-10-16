import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const POST = apiHandler(async (req: NextRequest) => {
  const { idea, format } = await req.json();

  if (!idea || typeof idea !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Idea is required" } },
      { status: 400 }
    );
  }

  const formatLabel = format === "video" ? "video" : format === "text" ? "social media text post" : "image";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content: `You are a creative social media content strategist. The user will give you a rough idea for a ${formatLabel}. Give 3 different improved variations of it, each more vivid, specific, and engaging than the original while keeping the core concept. Make the 3 variations meaningfully different from each other, not just reworded. Return ONLY valid JSON: { "ideas": ["variation 1", "variation 2", "variation 3"] }`,
      },
      { role: "user", content: idea },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  let ideas: string[] = [];
  try {
    const jsonStr = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.ideas)) ideas = parsed.ideas.filter((i: unknown) => typeof i === "string");
  } catch {
    // ignore, fall through to fallback below
  }

  if (ideas.length === 0) ideas = [idea];

  return NextResponse.json({ ideas });
});
