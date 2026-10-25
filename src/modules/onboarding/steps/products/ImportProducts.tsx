"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Store } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type { ProductDraft } from "@/core/onboarding/schemas";
import { Alert } from "../../components/blocks";
import { useOnboardingApi, useSlice } from "../../store/OnboardingStoreProvider";
import { newProduct } from "../../lib/factories";
import { parseProductsCsv } from "../../lib/csv";
import { cn } from "@/lib/utils";
import { button, control } from "@/components/kit/styles";

interface Imported {
  name: string;
  price: number | null;
  url: string;
}

/** Adds products from a Shopify store or a CSV file. Duplicates by name are skipped. */
export function ImportProducts({ currency }: { currency: string }) {
  const store = useOnboardingApi();
  const { update } = useSlice("products");
  const fileRef = useRef<HTMLInputElement>(null);
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  function addAll(items: Imported[]) {
    const current = store.getState().draft.products.products;
    const known = new Set(current.map((p) => p.name.trim().toLowerCase()));
    // Drop an untouched empty first product so imports don't leave a blank card
    const kept = current.filter((p) => p.name.trim() || p.photos.length);
    const added: ProductDraft[] = items
      .filter((i) => !known.has(i.name.toLowerCase()))
      .map((i) => newProduct(currency, { name: i.name, price: i.price, url: i.url }));
    update("products", { products: [...kept, ...added] });
    setMessage({ tone: "info", text: added.length ? `Added ${added.length} products. Add real photos to your hero products.` : "No new products found." });
  }

  async function importShopify() {
    setBusy(true);
    setMessage(null);
    try {
      const { products } = await apiFetch<{ products: Imported[] }>("/api/onboarding/import/shopify", {
        method: "POST",
        body: JSON.stringify({ storeUrl }),
      });
      addAll(products);
      setShopifyOpen(false);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      addAll(parseProductsCsv(await file.text()));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't read this CSV" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setShopifyOpen((o) => !o)}>
          <Store size={15} />
          Import from Shopify
        </button>
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet size={15} />
          Upload CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            importCsv(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {shopifyOpen && (
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            className={cn(control, "w-auto flex-[1_1_240px]")}
            aria-label="Shopify store address"
            placeholder="yourstore.com"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && storeUrl && importShopify()}
          />
          <button type="button" className={button({ size: "sm" })} disabled={!storeUrl || busy} onClick={importShopify}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            Import products
          </button>
        </div>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
