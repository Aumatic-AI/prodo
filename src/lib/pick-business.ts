import type { NextResponse } from "next/server";
import { PICKED_BUSINESS_COOKIE, PICKED_BUSINESS_MAX_AGE } from "@/lib/active-business";

/** Opens this business on this device from the next page load on (httpOnly: page scripts can't read or change it). */
export function pickBusiness(res: NextResponse, businessId: string | null): NextResponse {
  if (!businessId) {
    res.cookies.set(PICKED_BUSINESS_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  res.cookies.set(PICKED_BUSINESS_COOKIE, businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PICKED_BUSINESS_MAX_AGE,
  });
  return res;
}
