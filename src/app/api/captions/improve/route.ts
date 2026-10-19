import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { improveCaption } from "@/core/captions";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { platform, caption, instruction } = body;

  if (!platform || typeof caption !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "platform and caption are required" } },
      { status: 400 }
    );
  }

  const improved = await improveCaption({ caption, platform, instruction });
  return NextResponse.json({ caption: improved });
});
