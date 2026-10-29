"use client";

import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { DATE_KIND_OPTIONS } from "../../config";
import { Badge, BulletList, ExternalLink, Group, Item, ReviewCard, Row, Rows, Thumbs } from "./ReviewCard";
import { day, labelOf, money } from "./format";

export function ProductsReview() {
  const p = useOnboarding((s) => s.draft.products);
  const productName = (id: string | null) => p.products.find((x) => x.id === id)?.name ?? "";

  return (
    <ReviewCard title="Your products" step="business">
      <Group title="Products" count={p.products.length}>
        {p.products.map((product, i) => (
          <Item key={product.id} index={i} title={product.name} badge={product.isHero && <Badge>Hero</Badge>}>
            <Rows>
              <Row label="Price">{money(product.price, product.currency)}</Row>
              <Row label="Product page">
                <ExternalLink href={product.url} />
              </Row>
              <Row label="Photos">
                <Thumbs items={product.photos} />
              </Row>
              <Row label="Benefits">
                <BulletList items={product.benefits} />
              </Row>
              <Row label="Who it's for">{product.audience}</Row>
              <Row label="Objections">
                <BulletList items={product.objections} />
              </Row>
            </Rows>
          </Item>
        ))}
      </Group>

      <Group title="Offers" count={p.offers.length}>
        {p.offers.map((offer, i) => (
          <Item key={offer.id} index={i} title={offer.title}>
            <Rows>
              <Row label="Details">{offer.details}</Row>
              <Row label="Product">{productName(offer.offeringId) || "All products"}</Row>
              <Row label="Ends">{day(offer.endsAt) || "No end date: used without 'ends soon' copy"}</Row>
            </Rows>
          </Item>
        ))}
      </Group>

      <Group title="Customer reviews" count={p.reviews.length}>
        {p.reviews.map((review, i) => (
          <Item key={review.id} index={i} title={review.author || "Customer"}>
            <p className="m-0 whitespace-pre-line text-sm">&ldquo;{review.content}&rdquo;</p>
            <Rows>
              <Row label="Product">{productName(review.offeringId)}</Row>
              <Row label="Source">
                <ExternalLink href={review.sourceUrl} />
              </Row>
            </Rows>
          </Item>
        ))}
      </Group>

      <Group title="Important dates" count={p.dates.length}>
        {p.dates.map((date, i) => (
          <Item key={date.id} index={i} title={date.name} badge={<Badge>{labelOf(DATE_KIND_OPTIONS, date.kind)}</Badge>}>
            <span className="text-sm text-ob-muted">{day(date.date)}</span>
          </Item>
        ))}
      </Group>
    </ReviewCard>
  );
}
