import type { SupabaseClient } from "@supabase/supabase-js";
import { getKit } from "@/core/brand/kit";
import { contentRules } from "@/core/content/prefs";
import { BLACK, contrast, luminance, MIN_TEXT_CONTRAST, WHITE } from "@/lib/color";
import { loadFont, type FontFile } from "@/providers/fonts/google-fonts";
import { publicUrl } from "@/providers/storage/paths";

// The brand as exact values for our renderer: colour pairs that pass WCAG AA, the brand fonts
// loaded as files, and the right logo version for light and dark backgrounds.

export interface ColorPair {
  bg: string;
  text: string;
}

export interface CreativeTheme {
  businessName: string;
  /** Main brand colour with its readable text colour (buttons, panels) */
  primary: ColorPair;
  /** Second colour for badges and details */
  accent: ColorPair;
  /** Light canvas: the brand background and its text */
  light: ColorPair;
  /** Dark canvas: the darkest brand colour and its text */
  dark: ColorPair;
  fonts: { heading: string; body: string };
  /** Loaded font files (Satori needs the data; the video renderer the storage keys) */
  fontFiles: FontFile[];
  logo: { onLight: string | null; onDark: string | null };
  /** False when the client chose "no logo on my posts": ads show no brand mark, closing frames only the name */
  showLogo: boolean;
}

const FALLBACK_FONT = "Inter";
const FALLBACK_PRIMARY = "#15171c";

/** The most readable of white, black and the brand text colour on `bg`. */
export function readableOn(bg: string, options: string[] = [WHITE, BLACK]): string {
  return options.map((t) => ({ t, r: contrast(bg, t) })).sort((a, b) => b.r - a.r)[0].t;
}

function pair(bg: string, textOptions: string[]): ColorPair {
  return { bg, text: readableOn(bg, textOptions) };
}

async function fontsFor(heading: string | null, body: string | null): Promise<{ files: FontFile[]; heading: string; body: string }> {
  const want: [string, number][] = [
    [heading || FALLBACK_FONT, 800],
    [heading || FALLBACK_FONT, 700],
    [body || FALLBACK_FONT, 400],
    [body || FALLBACK_FONT, 600],
  ];
  const loaded = (await Promise.all(want.map(([f, w]) => loadFont(f, w)))).filter((f): f is FontFile => !!f);
  // A brand font Google doesn't have falls back to Inter
  const missing = !loaded.some((f) => f.family === (heading || FALLBACK_FONT)) || !loaded.some((f) => f.family === (body || FALLBACK_FONT));
  if (missing) {
    const extra = (await Promise.all([loadFont(FALLBACK_FONT, 800), loadFont(FALLBACK_FONT, 400), loadFont(FALLBACK_FONT, 600)])).filter(
      (f): f is FontFile => !!f
    );
    loaded.push(...extra);
  }
  const has = (family: string) => loaded.some((f) => f.family === family);
  return {
    files: loaded,
    heading: heading && has(heading) ? heading : FALLBACK_FONT,
    body: body && has(body) ? body : FALLBACK_FONT,
  };
}

/** `showLogo` overrides the client's onboarding choice (a manual ad's own "use logo" box). */
export async function loadTheme(db: SupabaseClient, options: { showLogo?: boolean } = {}): Promise<CreativeTheme> {
  const [kit, { data: profile }] = await Promise.all([getKit(db), db.from("business_profile").select("name, logo_key, content_prefs").single()]);
  const showLogo = options.showLogo ?? contentRules(profile).showLogo;
  const c = kit.colors;
  const textOptions = [WHITE, BLACK, c.text, c.bg];

  const primaryColor = c.primary ?? c.text ?? FALLBACK_PRIMARY;
  const accentColor = c.accent ?? c.secondary ?? primaryColor;
  // Darkest brand colour that still carries white text well
  const darkColor =
    [c.text, c.primary, c.secondary]
      .filter((v): v is string => !!v)
      .filter((v) => contrast(v, WHITE) >= MIN_TEXT_CONTRAST)
      .sort((a, b) => luminance(a) - luminance(b))[0] ?? FALLBACK_PRIMARY;
  const lightColor = luminance(c.bg) > 0.6 ? c.bg : WHITE;

  const fonts = await fontsFor(kit.fonts.heading, kit.fonts.body);
  const url = (key?: string | null) => (key ? publicUrl(key) : null);
  const fallbackLogo = kit.logo_variants.full ?? profile?.logo_key ?? null;

  return {
    businessName: profile?.name || "",
    primary: pair(primaryColor, textOptions),
    accent: pair(accentColor, textOptions),
    light: pair(lightColor, textOptions),
    dark: { bg: darkColor, text: WHITE },
    fonts: { heading: fonts.heading, body: fonts.body },
    fontFiles: fonts.files,
    logo: showLogo ? { onLight: url(kit.logo_variants.light ?? fallbackLogo), onDark: url(kit.logo_variants.dark ?? null) } : { onLight: null, onDark: null },
    showLogo,
  };
}

/** Every colour pair a design uses, for the contrast check in QA Gate 2. */
export function themePairs(theme: CreativeTheme): (ColorPair & { name: string })[] {
  return [
    { name: "primary", ...theme.primary },
    { name: "accent", ...theme.accent },
    { name: "light", ...theme.light },
    { name: "dark", ...theme.dark },
  ];
}
