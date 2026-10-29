"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { ProductDraft } from "@/core/onboarding/schemas";
import { Alert } from "../../components/blocks";
import { useOnboardingApi, useSlice } from "../../store/OnboardingStoreProvider";
import { newProduct } from "../../lib/factories";
import { parseProductsCsv } from "../../lib/csv";
import { button } from "@/components/kit/styles";
import { LIMITS } from "@/config/limits";

/** Adds products from a CSV file (name, price, link). Duplicates by name are skipped. */
export function ImportProducts({ currency }: { currency: string }) {
  const store = useOnboardingApi();
  const { update } = useSlice("products");
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const items = parseProductsCsv(await file.text());
      const current = store.getState().draft.products.products;
      const known = new Set(current.map((p) => p.name.trim().toLowerCase()));
      // Drop an untouched empty first product so imports don't leave a blank card
      const kept = current.filter((p) => p.name.trim() || p.photos.length);
      const fresh = items.filter((i) => !known.has(i.name.toLowerCase()));
      const added: ProductDraft[] = fresh
        .slice(0, Math.max(LIMITS.offeringsMax - kept.length, 0))
        .map((i) => newProduct(currency, { name: i.name, price: i.price, url: i.url }));
      update("products", { products: [...kept, ...added] });
      const skipped = fresh.length - added.length;
      setMessage({
        tone: "info",
        text: added.length
          ? `Added ${added.length} products.${skipped ? ` ${skipped} more didn't fit: you can have up to ${LIMITS.offeringsMax}.` : ""} Add real photos to your hero products.`
          : skipped
            ? `You already have ${LIMITS.offeringsMax} products, the most you can add.`
            : "No new products found.",
      });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Couldn't read this CSV" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={`${button({ variant: "ghost", size: "sm" })} self-start`} onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet size={15} />
        Or add many from a CSV file
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
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
