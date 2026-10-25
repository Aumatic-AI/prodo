import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listNotifications } from "@/core/notifications/notify";

export const GET = apiHandler(async () => NextResponse.json(await listNotifications(await createClient())));
