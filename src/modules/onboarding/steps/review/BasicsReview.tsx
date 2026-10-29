"use client";

import { TONE_AXES } from "@/core/onboarding/options";
import { countryName } from "@/config/countries";
import { BRAND_COLORS } from "@/components/kit/ColorTile";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { BUSINESS_TYPE_OPTIONS, CTA_OPTIONS, INDUSTRY_OPTIONS, LANGUAGE_OPTIONS, SOCIAL_LABELS, TONE_LABELS } from "../../config";
import { BulletList, Chips, ExternalLink, Group, ReviewCard, Row, Rows, Thumbs } from "./ReviewCard";
import { labelOf } from "./format";

/** Where the tone slider sits between its two words. */
function ToneBar({ left, right, value }: { left: string; right: string; value: number }) {
  return (
    <span className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-2.5 text-[13px]">
      <span className={value < 50 ? "font-bold" : "text-ob-muted"}>{left}</span>
      <span className="relative h-1.5 rounded-full bg-ob-line" aria-label={`${value} out of 100`}>
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ob-primary" style={{ left: `${value}%` }} />
      </span>
      <span className={value >= 50 ? "text-right font-bold" : "text-right text-ob-muted"}>{right}</span>
    </span>
  );
}

export function BasicsReview() {
  const b = useOnboarding((s) => s.draft.basics);
  const socials = Object.entries(b.socials).filter(([, url]) => url);
  const cta = CTA_OPTIONS.find((o) => o.value === b.cta);
  const ctaLink = cta ? b.ctaLinks[cta.value] : "";

  return (
    <ReviewCard title="Basics" step="basics">
      <Group title="Your business">
        <Rows>
          <Row label="Business name">{b.name}</Row>
          <Row label="Logo">{b.logoKey && <Thumbs items={[{ key: b.logoKey }]} />}</Row>
          <Row label="About the business">{b.description && <span className="whitespace-pre-line font-normal">{b.description}</span>}</Row>
          <Row label="What you sell">{labelOf(BUSINESS_TYPE_OPTIONS, b.businessType)}</Row>
        </Rows>
      </Group>

      <Group title="Brand look">
        <Rows>
          <Row label="Colours">
            <span className="flex flex-wrap gap-2">
              {BRAND_COLORS.filter(([key]) => b.colors[key]).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-2 rounded-full border border-ob-line bg-ob-surface py-1 pl-1 pr-3 text-[13px] font-semibold">
                  {/* The client's own brand colour */}
                  <span className="size-5 rounded-full border border-ob-line" style={{ background: b.colors[key]! }} />
                  {label}
                  <span className="font-mono text-ob-muted uppercase">{b.colors[key]}</span>
                </span>
              ))}
            </span>
          </Row>
          <Row label="Headings font">{b.fonts.heading}</Row>
          <Row label="Text font">{b.fonts.body}</Row>
        </Rows>
      </Group>

      <Group title="Online and next step">
        <Rows>
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
          <Row label="Customers go to">
            {cta && (
              <span className="flex flex-col gap-0.5">
                <span>{cta.label}</span>
                {ctaLink && (cta.phone ? <span className="text-ob-muted">{ctaLink}</span> : <ExternalLink href={ctaLink} />)}
              </span>
            )}
          </Row>
        </Rows>
      </Group>

      <Group title="Market">
        <Rows>
          <Row label="Countries (by priority)">
            <Chips numbered items={b.countries.map(countryName)} />
          </Row>
          <Row label="Cities">{b.cities}</Row>
          <Row label="Language">{labelOf(LANGUAGE_OPTIONS, b.language) || b.language}</Row>
          <Row label="Timezone">{b.timezone.replace(/_/g, " ")}</Row>
          <Row label="Industry">{labelOf(INDUSTRY_OPTIONS, b.industry)}</Row>
          <Row label="Currency">{b.currency}</Row>
        </Rows>
      </Group>

      <Group title="Tone of voice">
        <span className="flex max-w-[520px] flex-col gap-2.5">
          {TONE_AXES.map((axis) => (
            <ToneBar key={axis} left={TONE_LABELS[axis].left} right={TONE_LABELS[axis].right} value={b.tone[axis]} />
          ))}
        </span>
      </Group>

      <Group title="Rules">
        <Rows>
          <Row label="Words to never use">
            <Chips items={b.avoidWords} />
          </Row>
          <Row label="Disclaimers">
            <BulletList items={b.disclaimers} />
          </Row>
        </Rows>
      </Group>
    </ReviewCard>
  );
}
