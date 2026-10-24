import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { importProducts } from "@/providers/commerce/shopify";

const bodySchema = z.object({ storeUrl: z.string().trim().min(3, "Enter your store address") });

// Products from a Shopify store, returned for the client to review before saving
export const POST = apiHandler(async (req: NextRequest) => {
  const { storeUrl } = bodySchema.parse(await req.json());
  return NextResponse.json({ products: await importProducts(storeUrl) });
});
