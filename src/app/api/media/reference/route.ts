import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentBusiness } from "@/core/business";
import { upload, storageKeyFor, urlFor } from "@/providers/storage/supabase-storage";
import { LIMITS } from "@/config/limits";

export const POST = apiHandler(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "File is required" } },
      { status: 400 }
    );
  }

  if (file.size > LIMITS.referenceImageMaxBytes) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Reference image must be under 5MB" } },
      { status: 400 }
    );
  }

  const { businessId } = await currentBusiness();
  const key = storageKeyFor(businessId, "reference", "ref");
  const buf = Buffer.from(await file.arrayBuffer());
  // Server upload into the business's own folder
  await upload(createAdminClient(), key, buf, file.type || "image/png");

  return NextResponse.json({ key, url: urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, key) });
});
