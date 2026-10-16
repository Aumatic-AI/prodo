import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, saveProfile } from "@/core/profile";
import { upload, storageKeyFor } from "@/providers/storage/supabase-storage";
import { LIMITS } from "@/config/limits";

export const GET = apiHandler(async () => {
  const db = await createClient();
  const profile = await getProfile(db);
  return NextResponse.json(profile);
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const formData = await req.formData();

  const fields: Record<string, any> = {};
  const name = formData.get("name");
  const website = formData.get("website");
  const about = formData.get("about");

  if (typeof name === "string") fields.name = name;
  if (typeof website === "string") fields.website = website || null;
  if (typeof about === "string") {
    if (about.length > LIMITS.aboutMaxChars) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `About must be under ${LIMITS.aboutMaxChars} characters` } },
        { status: 400 }
      );
    }
    fields.about = about;
  }

  const products = formData.get("products");
  if (typeof products === "string") {
    try { fields.products = JSON.parse(products); } catch { /* ignore */ }
  }

  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    if (logo.size > LIMITS.logoMaxBytes) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Logo must be under 2MB" } },
        { status: 400 }
      );
    }
    const key = storageKeyFor("logo", "profile");
    const buf = Buffer.from(await logo.arrayBuffer());
    const admin = createAdminClient();
    await upload(admin, key, buf, logo.type);
    fields.logo_key = key;
  }

  const profile = await saveProfile(db, fields);
  return NextResponse.json(profile);
});
