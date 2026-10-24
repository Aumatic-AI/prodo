"use client";

import { countryName } from "@/config/countries";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { BUSINESS_TYPE_OPTIONS, GOAL_OPTIONS, LANGUAGE_OPTIONS, SOCIAL_LABELS } from "../../config";
import { Chips, ExternalLink, ReviewCard, Row, Rows, Thumbs } from "./ReviewCard";
import { labelOf } from "./format";

export function BasicsReview() {
  const b = useOnboarding((s) => s.draft.basics);
  const socials = Object.entries(b.socials).filter(([, url]) => url);

  return (
    <ReviewCard title="Basics" step="basics">
      <Rows>
        <Row label="Business name">{b.name}</Row>
        <Row label="Logo">{b.logoKey && <Thumbs items={[{ key: b.logoKey }]} />}</Row>
        <Row label="About the business">{b.description && <span className="whitespace-pre-line font-normal">{b.description}</span>}</Row>
        <Row label="Website">
          <ExternalLink href={b.website} />
        </Row>
        <Row label="Social profiles">
          {socials.length > 0 && (
            <span className="flex flex-col gap-1">
              {socials.map(([platform, url]) => (
                <span key={platform}>
                  <span className="text-ob-muted">{SOCIAL_LABELS[platform] ?? platform}: </span>
                  <ExternalLink href={url} />
                </span>
              ))}
            </span>
          )}
        </Row>
        <Row label="What you sell">{labelOf(BUSINESS_TYPE_OPTIONS, b.businessType)}</Row>
        <Row label="Countries (by priority)">
          <Chips numbered items={b.countries.map(countryName)} />
        </Row>
        <Row label="Cities">{b.cities}</Row>
        <Row label="Language">{labelOf(LANGUAGE_OPTIONS, b.language) || b.language}</Row>
        <Row label="Timezone">{b.timezone.replace(/_/g, " ")}</Row>
        <Row label="Main goal">{labelOf(GOAL_OPTIONS, b.primaryGoal)}</Row>
      </Rows>
    </ReviewCard>
  );
}
