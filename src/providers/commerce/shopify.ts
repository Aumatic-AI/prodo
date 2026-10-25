import { AppError } from "@/core/errors";
import { request } from "@/providers/http";

const SERVICE = "Your Shopify store";

export interface ImportedProduct {
  name: string;
  price: number | null;
  url: string;
  imageUrls: string[];
}

function storeOrigin(input: string): string {
  try {
    const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
    return url.origin;
  } catch {
    throw new AppError("Enter your store address, e.g. yourstore.com", "INVALID_INPUT", false);
  }
}

/** Reads a store's public product list (no API key needed). */
export async function importProducts(storeUrl: string, limit = 100): Promise<ImportedProduct[]> {
  const origin = storeOrigin(storeUrl);
  const res = await request(SERVICE, `${origin}/products.json?limit=${Math.min(limit, 250)}`);
  if (!res.ok) {
    throw new AppError("Couldn't read products from this store. Check the address, or add products by hand.", "INVALID_INPUT", false);
  }
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data?.products)) {
    throw new AppError("This doesn't look like a Shopify store. Add products by hand or upload a CSV.", "INVALID_INPUT", false);
  }

  return data.products.map((p: any) => {
    const price = Number(p.variants?.[0]?.price);
    return {
      name: String(p.title ?? "").trim(),
      price: Number.isFinite(price) ? price : null,
      url: `${origin}/products/${p.handle}`,
      imageUrls: (p.images ?? []).map((i: any) => i.src).filter(Boolean).slice(0, 5),
    };
  }).filter((p: ImportedProduct) => p.name);
}
