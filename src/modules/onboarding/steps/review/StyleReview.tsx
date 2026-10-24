"use client";

import { TONE_AXES, POSTING_PLATFORMS } from "@/core/onboarding/options";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { AUTOPILOT_OPTIONS, MUSIC_OPTIONS, POSTING_LABELS, TONE_LABELS, WEEKDAY_OPTIONS } from "../../config";
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

export function StyleReview() {
  const s = useOnboarding((st) => st.draft.style);
  const plan = POSTING_PLATFORMS.filter((p) => (s.postsPerWeek[p] ?? 0) > 0);
  const total = plan.reduce((sum, p) => sum + (s.postsPerWeek[p] ?? 0), 0);

  return (
    <ReviewCard title="Style and rules" step="style">
      <Group title="Tone of voice">
        <span className="flex max-w-[520px] flex-col gap-2.5">
          {TONE_AXES.map((axis) => (
            <ToneBar key={axis} left={TONE_LABELS[axis].left} right={TONE_LABELS[axis].right} value={s.tone[axis]} />
          ))}
        </span>
      </Group>

      <Group title="Inspiration and competitors">
        <Rows>
          <Row label="Brands you admire">
            <Chips items={s.likedBrands} />
          </Row>
          <Row label="Competitors">
            {s.competitors.length > 0 && (
              <span className="flex flex-col gap-1">
                {s.competitors.map((c) => (
                  <span key={c.id}>
                    {c.name}
                    {c.link && (
                      <>
                        {" · "}
                        {/^https?:\/\//.test(c.link) ? <ExternalLink href={c.link} /> : <span className="text-ob-muted">{c.link}</span>}
                      </>
                    )}
                  </span>
                ))}
              </span>
            )}
          </Row>
          <Row label="Videos you like">
            <Thumbs video items={s.competitorVideos} />
          </Row>
        </Rows>
      </Group>

      <Group title="Rules">
        <Rows>
          <Row label="Words to never use">
            <Chips items={s.avoidWords} />
          </Row>
          <Row label="Disclaimers">
            <BulletList items={s.disclaimers} />
          </Row>
        </Rows>
      </Group>

      <Group title="Posting plan">
        <Rows>
          {plan.map((p) => (
            <Row key={p} label={POSTING_LABELS[p]}>
              {s.postsPerWeek[p]} a week
            </Row>
          ))}
          <Row label="Total">{total ? `${total} posts a week` : "No posts planned"}</Row>
        </Rows>
      </Group>

      <Group title="Video sound">
        <Rows>
          <Row label="Voice-over">{s.voiceName ?? "No voice picked"}</Row>
          <Row label="Music mood">{labelOf(MUSIC_OPTIONS, s.musicMood)}</Row>
        </Rows>
      </Group>

      <Group title="Autopilot">
        <Rows>
          <Row label="Mode">{labelOf(AUTOPILOT_OPTIONS, s.autopilotMode)}</Row>
          <Row label="Weekly plan">{`${labelOf(WEEKDAY_OPTIONS, String(s.planWeekday))} at ${s.planTime}`}</Row>
          <Row label="Monthly budget">{s.monthlyBudgetUsd != null ? `$${s.monthlyBudgetUsd}` : ""}</Row>
        </Rows>
      </Group>
    </ReviewCard>
  );
}
