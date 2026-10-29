"use client";

import { useEffect } from "react";
import { AddButton, FromSiteBadge, OptionalBadge, Section } from "../../components/blocks";
import { ScanWait, useScanWait } from "../../components/ScanWait";
import { StepLayout } from "../../components/shell/StepLayout";
import { Alert } from "@/components/kit/Alert";
import { button } from "@/components/kit/styles";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { PRODUCTS_META } from "../../config";
import { newProduct } from "../../lib/factories";
import { ProductCard } from "./ProductCard";
import { ImportProducts } from "./ImportProducts";
import { OffersSection } from "./OffersSection";
import { ReviewsSection } from "./ReviewsSection";
import { DatesSection } from "./DatesSection";
import { LIMITS } from "@/config/limits";

export function ProductsStep() {
  const { value, addItem, update } = useSlice("products");
  const currency = useOnboarding((s) => s.draft.basics.currency);
  const scan = useOnboarding((s) => s.draft.scan);
  const { waiting, skip } = useScanWait();
  const found = value.products.filter((p) => p.found).length;
  const soldOut = (scan?.soldOut ?? []).filter((name) => !value.products.some((p) => p.name.trim().toLowerCase() === name.toLowerCase()));
  const scanned = scan?.state === "done";
  const room = LIMITS.offeringsMax - value.products.length;

  // A product is required, so start with one empty card (unless the website read is about to fill the list)
  useEffect(() => {
    if (!waiting && !value.products.length) addItem("products", "products", newProduct(currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  function addSoldOut() {
    // Drop an untouched empty card so the added products don't sit under a blank one
    const kept = value.products.filter((p) => p.name.trim() || p.photos.length);
    const space = LIMITS.offeringsMax - kept.length;
    update("products", { products: [...kept, ...soldOut.slice(0, Math.max(space, 0)).map((name) => newProduct(currency, { name }))] });
  }

  return (
    <StepLayout step="business" title={PRODUCTS_META.title} lead={PRODUCTS_META.lead} primaryAction={waiting ? <span /> : undefined}>
      {waiting ? (
        <ScanWait onSkip={skip} />
      ) : (
        <>
          <Section
            title="Your products"
            description={`Up to ${LIMITS.offeringsMax}. Turn on Hero for your best sellers: they get the most posts.`}
            badge={found ? <FromSiteBadge /> : undefined}
            path="products"
          >
            {found > 0 && (
              <Alert tone="success">
                <strong>Added your {found} main products from your website.</strong> Check them and turn on Hero for your best sellers. Add any others you want to promote below.
              </Alert>
            )}
            <div className="flex flex-col gap-3">
              {value.products.map((p, i) => (
                <ProductCard key={p.id} index={i} product={p} canRemove={value.products.length > 1} />
              ))}
            </div>
            {soldOut.length > 0 && (
              <div className="flex flex-col gap-2 rounded-ob-md border border-ob-line bg-ob-bg p-4 text-sm text-ob-muted">
                <span>
                  <strong className="text-ob-ink">Not added because they&apos;re sold out:</strong> {soldOut.join(", ")}
                </span>
                <button type="button" className={`${button({ variant: "ghost", size: "sm" })} self-start`} onClick={addSoldOut} disabled={room <= 0}>
                  Add them anyway
                </button>
              </div>
            )}
            {room > 0 ? (
              <>
                <AddButton onClick={() => addItem("products", "products", newProduct(currency))}>Add product</AddButton>
                <ImportProducts currency={currency} />
              </>
            ) : (
              <p className="m-0 text-[13px] text-ob-muted">You&apos;ve added the most products ({LIMITS.offeringsMax}). Remove one to add another.</p>
            )}
          </Section>

          <Section title="Current offers" badge={<OptionalBadge />} description="Offers found on your website are added here. Countdown and 'ends soon' copy is only used before the end date.">
            <OffersSection />
          </Section>

          <Section title="Reviews and testimonials" badge={<OptionalBadge />} description="Used for social-proof ads. We only quote real reviews, word for word.">
            {scanned && !value.reviews.length && (
              <p className="m-0 text-sm text-ob-muted">We checked your website and product pages: no written reviews were found. Add some below if you have them.</p>
            )}
            <ReviewsSection />
          </Section>

          <Section title="Sales and launches" badge={<OptionalBadge />} description="We plan content around these dates.">
            <DatesSection />
          </Section>
        </>
      )}
    </StepLayout>
  );
}
