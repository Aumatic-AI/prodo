"use client";

import { useEffect } from "react";
import { AddButton, OptionalBadge, Section } from "../../components/blocks";
import { StepLayout } from "../../components/shell/StepLayout";
import { useOnboarding, useSlice } from "../../store/OnboardingStoreProvider";
import { PRODUCTS_META, WHY_WE_ASK, currencyFor } from "../../config";
import { newProduct } from "../../lib/factories";
import { ProductCard } from "./ProductCard";
import { ImportProducts } from "./ImportProducts";
import { OffersSection } from "./OffersSection";
import { ReviewsSection } from "./ReviewsSection";
import { DatesSection } from "./DatesSection";

export function ProductsStep() {
  const { value, addItem } = useSlice("products");
  const countries = useOnboarding((s) => s.draft.basics.countries);
  const currency = currencyFor(countries);

  // A product is required, so start with one empty card
  useEffect(() => {
    if (!value.products.length) addItem("products", "products", newProduct(currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepLayout step="business" title={PRODUCTS_META.title} lead={PRODUCTS_META.lead} why={WHY_WE_ASK.products}>
      <Section
        title="Your products"
        description="Add the ones you want to promote. We'll also find others on your website for you to confirm later."
        path="products"
      >
        <ImportProducts currency={currency} />
        <div className="flex flex-col gap-3">
          {value.products.map((p, i) => (
            <ProductCard key={p.id} index={i} product={p} canRemove={value.products.length > 1} />
          ))}
        </div>
        <AddButton onClick={() => addItem("products", "products", newProduct(currency))}>Add product</AddButton>
      </Section>

      <Section title="Current offers" badge={<OptionalBadge />} description="Countdown and 'ends soon' copy is only used before the end date.">
        <OffersSection />
      </Section>

      <Section title="Reviews and testimonials" badge={<OptionalBadge />} description="Used for social-proof ads. We only quote real reviews, word for word.">
        <ReviewsSection />
      </Section>

      <Section title="Seasonality and launches" badge={<OptionalBadge />} description="We plan content around these dates.">
        <DatesSection />
      </Section>
    </StepLayout>
  );
}
