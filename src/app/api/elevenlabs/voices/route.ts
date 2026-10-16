import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";

interface Voice {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  language: string;
  description: string;
  preview_url: string;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "ElevenLabs API key not configured" } },
      { status: 500 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const params = new URLSearchParams();
  if (sp.get("search")) params.set("search", sp.get("search")!);
  if (sp.get("gender")) params.set("gender", sp.get("gender")!);
  if (sp.get("language")) params.set("language", sp.get("language")!);
  if (sp.get("accent")) params.set("accent", sp.get("accent")!);
  params.set("page_size", sp.get("page_size") || "12");
  params.set("page", sp.get("page") || "0");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/shared-voices?${params}`,
    {
      headers: { "xi-api-key": apiKey },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: { code: "ELEVENLABS_ERROR", message: "Failed to fetch voices" } },
      { status: res.status }
    );
  }

  const data = await res.json();

  const voices: Voice[] = (data.voices || []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    gender: v.gender || "",
    accent: v.accent || "",
    language: v.language || "",
    description: v.description || "",
    preview_url: v.preview_url || "",
  }));

  return NextResponse.json({
    voices,
    hasMore: data.has_more ?? voices.length >= Number(params.get("page_size")),
  });
});
