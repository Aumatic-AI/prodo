import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { publisherFor, defaultProvider } from "@/providers/publishing/registry";

export const GET = apiHandler(async () => {
  const publisher = publisherFor(defaultProvider());
  const accounts = await publisher.listAccounts();
  return NextResponse.json(accounts);
});
