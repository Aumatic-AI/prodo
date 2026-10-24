import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { publisherFor } from "@/providers/publishing/registry";

export const GET = apiHandler(async () => {
  const publisher = publisherFor();
  const accounts = await publisher.listAccounts();
  return NextResponse.json(accounts);
});
