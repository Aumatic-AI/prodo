import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, saveProfile } from "@/core/profile";
import { upload, storageKeyFor } from "@/providers/storage/supabase-storage";
import { LIMITS } from "@/config/limits";
import { GOALS } from "@/core/onboarding/options";

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
  const description = formData.get("description");
  const language = formData.get("language");
  const timezone = formData.get("timezone");
  const goal = formData.get("primary_goal");

  if (typeof name === "string") fields.name = name;
  if (typeof website === "string") fields.website = website || null;
  if (typeof language === "string" && language) fields.language = language.slice(0, 40);
  if (typeof timezone === "string") fields.timezone = timezone.slice(0, 60) || null;
  if (typeof goal === "string") {
    if (goal && !(GOALS as readonly string[]).includes(goal)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Pick a goal from the list" } }, { status: 400 });
    }
    fields.primary_goal = goal || null;
  }
  if (typeof description === "string") {
    if (description.length > LIMITS.descriptionMaxChars) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: `Description must be under ${LIMITS.descriptionMaxChars} characters` } },
        { status: 400 }
      );
    }
    fields.description = description;
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
