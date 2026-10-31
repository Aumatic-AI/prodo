import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOnboarding, type ContentPrefs } from "@/core/onboarding/load";
import { VIDEO_ONLY_PLATFORMS } from "@/core/onboarding/options";
import type { ContentSettings, ContentSettingsDraft, OnboardingDraft } from "@/core/onboarding/schemas";
import { ownRow } from "@/lib/supabase/own-row";

// Settings → Content: the "Your content" answers from onboarding (mix, styles, people, voice, music,
// logo) and where customers go. Saved to the same columns onboarding writes, so the weekly agents
// (core/content/prefs.ts) pick the change up on their next run.

/** The form's values plus what the screen needs to word it */
export interface ContentSettingsView {
  values: ContentSettingsDraft;
  /** Services get their own wording for the styles */
  service: boolean;
  /** Content language, for the suggested voices */
  language: string;
}

function pick({ content: c, basics: b }: OnboardingDraft): ContentSettingsView {
  return {
    service: b.businessType === "service",
    language: b.language,
    values: {
      mix: c.mix,
      imageStyles: c.imageStyles,
      videoStyles: c.videoStyles,
      people: c.people,
      voiceId: c.voiceId,
      voiceName: c.voiceName,
      musicMood: c.musicMood,
      logo: c.logo,
      cta: b.cta,
      ctaLinks: b.ctaLinks,
    },
  };
}

export async function getContentSettings(db: SupabaseClient): Promise<ContentSettingsView> {
  return pick(await loadOnboarding(db));
}

export async function saveContentSettings(db: SupabaseClient, v: ContentSettings): Promise<ContentSettingsView> {
  const { data: profile, error: readError } = await db.from("business_profile").select("content_prefs, posting_prefs, cta_links").single();
  if (readError) throw readError;

  const prefs: ContentPrefs = {
    // Goals are edited in Business profile and kept as they are
    ...(profile.content_prefs ?? {}),
    mix: v.mix,
    image_styles: v.imageStyles,
    video_styles: v.mix === "images" ? [] : v.videoStyles,
    people: v.people,
    logo: v.logo,
  };

  // Images only: platforms that only take video get no posts
  const platforms = { ...(profile.posting_prefs?.platforms ?? {}) } as Record<string, number>;
  if (v.mix === "images") for (const p of VIDEO_ONLY_PLATFORMS) if (p in platforms) platforms[p] = 0;

  const { error } = await ownRow(
    db.from("business_profile").update({
      content_prefs: prefs,
      posting_prefs: { ...(profile.posting_prefs ?? {}), platforms },
      voice_id: v.voiceId,
      music_mood: v.musicMood,
      primary_cta: v.cta,
      cta_links: {
        ...(profile.cta_links ?? {}),
        shop: v.ctaLinks.shop || undefined,
        whatsapp: v.ctaLinks.whatsapp || undefined,
        booking: v.ctaLinks.book || undefined,
        phone: v.ctaLinks.call || undefined,
      },
    })
  );
  if (error) throw error;
  // The voice's name lives with the onboarding answers
  const { error: nameError } = await db.rpc("merge_onboarding", { patch: { voiceName: v.voiceName } });
  if (nameError) throw nameError;
  return getContentSettings(db);
}
