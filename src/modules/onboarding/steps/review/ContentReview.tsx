"use client";

import { POSTING_PLATFORMS, VIDEO_ONLY_PLATFORMS, soundNeeds, type ImageStyle, type VideoStyle } from "@/core/onboarding/options";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { GOAL_OPTIONS, MUSIC_OPTIONS, POSTING_LABELS } from "../../config";
import { LOGO_OPTIONS, MIX_OPTIONS, PEOPLE_OPTIONS, RELATION_OPTIONS, imageStyleWords, videoStyleWords } from "../content/labels";
import { Badge, Chips, ExternalLink, Group, ReviewCard, Row, Rows, Thumbs } from "./ReviewCard";
import { labelOf } from "./format";

export function ContentReview() {
  const c = useOnboarding((s) => s.draft.content);
  const service = useOnboarding((s) => s.draft.basics.businessType === "service");
  const videos = c.mix !== "images";
  const counted = POSTING_PLATFORMS.filter((p) => !(!videos && (VIDEO_ONLY_PLATFORMS as readonly string[]).includes(p)));
  const plan = counted.filter((p) => (c.postsPerWeek[p] ?? 0) > 0);
  const total = plan.reduce((sum, p) => sum + (c.postsPerWeek[p] ?? 0), 0);
  const sound = soundNeeds(c.videoStyles as VideoStyle[]);
  const photos = c.ownMedia.filter((m) => !m.video);
  const clips = c.ownMedia.filter((m) => m.video);

  return (
    <ReviewCard title="Your content" step="content">
      <Group title="Goals and formats">
        <Rows>
          <Row label="Goals (in order)">
            <Chips numbered items={c.goals.map((g) => labelOf(GOAL_OPTIONS, g))} />
          </Row>
          <Row label="Images or videos">{labelOf(MIX_OPTIONS, c.mix)}</Row>
        </Rows>
      </Group>

      <Group title="Posting plan">
        <Rows>
          {plan.map((p) => (
            <Row key={p} label={POSTING_LABELS[p]}>
              {c.postsPerWeek[p]} a week
            </Row>
          ))}
          <Row label="Total">{total ? `${total} posts a week` : "No posts planned"}</Row>
        </Rows>
      </Group>

      <Group title="Kinds of posts">
        <Rows>
          <Row label="Images and carousels">
            {c.imageStyles.length ? (
              <Chips numbered items={(c.imageStyles as ImageStyle[]).map((s) => imageStyleWords(s, service).title)} />
            ) : (
              "A wide mix, chosen by Prodo"
            )}
          </Row>
          {videos && (
            <Row label="Videos">
              {c.videoStyles.length ? (
                <Chips numbered items={(c.videoStyles as VideoStyle[]).map((s) => videoStyleWords(s, service).title)} />
              ) : (
                "A wide mix, chosen by Prodo"
              )}
            </Row>
          )}
        </Rows>
      </Group>

      <Group title="Look and sound">
        <Rows>
          <Row label="People in posts">{labelOf(PEOPLE_OPTIONS, c.people)}</Row>
          {c.people === "real" && (
            <Row label="Photos of these people">
              <Thumbs items={c.peoplePhotos} />
            </Row>
          )}
          {videos && sound.voice && <Row label="Voice-over">{c.voiceName ?? "No voice picked"}</Row>}
          {videos && sound.music && <Row label="Music mood">{labelOf(MUSIC_OPTIONS, c.musicMood)}</Row>}
          <Row label="Logo">{labelOf(LOGO_OPTIONS, c.logo)}</Row>
        </Rows>
      </Group>

      <Group title="Your own photos and videos" count={c.ownMedia.length}>
        <span className="flex flex-col gap-2">
          <Thumbs items={photos} />
          <Thumbs video items={clips} />
        </span>
      </Group>

      <Group title="Reference posts and ads" count={c.references.length + c.referenceLinks.length}>
        <span className="flex flex-col gap-2">
          <Thumbs items={c.references.filter((m) => !m.video)} />
          <Thumbs video items={c.references.filter((m) => m.video)} />
          {c.referenceLinks.map((url) => (
            <ExternalLink key={url} href={url} />
          ))}
        </span>
      </Group>

      <Group title="Brands to learn from" count={c.brands.length}>
        <Rows>
          {c.brands.map((b) => (
            <Row key={b.id} label={b.name}>
              <span className="flex flex-wrap items-center gap-2">
                <Badge>{labelOf(RELATION_OPTIONS, b.relation)}</Badge>
                {b.link && (/^https?:\/\//.test(b.link) ? <ExternalLink href={b.link} /> : <span className="text-ob-muted">{b.link}</span>)}
              </span>
            </Row>
          ))}
        </Rows>
      </Group>
    </ReviewCard>
  );
}
