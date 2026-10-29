"use client";

import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { CREDENTIAL_KIND_OPTIONS, PRICE_MODEL_OPTIONS, SERVICE_AREA_OPTIONS, TEAM_PHOTO_KIND_OPTIONS } from "../../config";
import { BulletList, ExternalLink, Group, Item, ReviewCard, Row, Rows, Thumbs } from "./ReviewCard";
import { labelOf, money } from "./format";

export function ServicesReview() {
  const s = useOnboarding((st) => st.draft.services);

  return (
    <ReviewCard title="Your services" step="business">
      <Group title="Services" count={s.services.length}>
        {s.services.map((service, i) => (
          <Item key={service.id} index={i} title={service.name}>
            <Rows>
              <Row label="Price">
                {[labelOf(PRICE_MODEL_OPTIONS, service.priceModel), service.priceModel !== "quote" && money(service.price, service.currency)].filter(Boolean).join(" · ")}
              </Row>
              <Row label="What's included">{service.included && <span className="whitespace-pre-line">{service.included}</span>}</Row>
              <Row label="Turnaround">{service.turnaround}</Row>
              <Row label="How it works">
                <BulletList items={service.steps} />
              </Row>
              <Row label="Service page">
                <ExternalLink href={service.url} />
              </Row>
            </Rows>
          </Item>
        ))}
      </Group>

      <Group title="Where you work">
        <Rows>
          <Row label="Service area">{labelOf(SERVICE_AREA_OPTIONS, s.area)}</Row>
          <Row label="Areas covered">{s.areas}</Row>
        </Rows>
      </Group>

      <Group title="Case studies" count={s.caseStudies.length}>
        {s.caseStudies.map((study, i) => (
          <Item key={study.id} index={i} title={study.client}>
            <p className="m-0 whitespace-pre-line text-sm">{study.result}</p>
            <Thumbs items={study.photos} />
          </Item>
        ))}
      </Group>

      <Group title="Trust">
        <Rows>
          <Row label="Years in business">{s.yearsInBusiness ?? ""}</Row>
          <Row label="Credentials">
            <BulletList items={s.credentials.map((c) => `${labelOf(CREDENTIAL_KIND_OPTIONS, c.kind)}: ${c.content}`)} />
          </Row>
          <Row label="Team and place photos">
            <Thumbs items={s.teamPhotos.map((photo) => ({ key: photo.key, tag: labelOf(TEAM_PHOTO_KIND_OPTIONS, photo.kind) }))} />
          </Row>
        </Rows>
      </Group>

      <Group title="Lead magnet">
        <Rows>
          <Row label="Free guide link">
            <ExternalLink href={s.leadMagnetUrl} />
          </Row>
        </Rows>
      </Group>

      <Group title="Questions and objections" count={s.faqs.filter(Boolean).length}>
        <BulletList items={s.faqs} />
      </Group>
    </ReviewCard>
  );
}
