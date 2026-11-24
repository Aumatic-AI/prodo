import { cache } from "react";
import { notFound } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";

// Who may use the admin panel: logins in public.admins (0032), checked with is_admin() on every admin page
// load and every admin API call (the middleware checks it too). Anyone else gets "not found", so the panel's
// pages and routes don't even show they exist. Admin data is read with the service role only after this check.

export interface AdminUser {
  id: string;
  email: string;
}

/** The logged-in admin, or null for anyone else. Cached for the request. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.rpc("is_admin");
  if (error || data !== true) return null;
  return { id: user.id, email: user.email ?? "" };
});

/** For admin pages and layouts: not an admin → the not-found page. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

type AdminRoute = (req: NextRequest, ctx: any, admin: AdminUser) => Promise<NextResponse>;

const NOT_FOUND = () => NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });

/** For admin API routes: the usual error handling, and 404 for anyone who isn't an admin. */
export function adminHandler(route: AdminRoute) {
  return apiHandler(async (req, ctx) => {
    const admin = await getAdmin();
    if (!admin) return NOT_FOUND();
    return route(req, ctx, admin);
  });
}
