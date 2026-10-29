// Fonts a brand can pick. Our renderer (ads, carousels, video text) can only download fonts from
// Google Fonts (providers/fonts/google-fonts.ts), so the pickers offer these and nothing else.

export type FontCategory = "Sans serif" | "Serif" | "Display" | "Handwriting" | "Monospace";

const SANS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Nunito Sans", "Work Sans",
  "Rubik", "Mulish", "Noto Sans", "Source Sans 3", "PT Sans", "Ubuntu", "Fira Sans", "Karla", "Manrope", "DM Sans",
  "Plus Jakarta Sans", "Outfit", "Urbanist", "Lexend", "Figtree", "Sora", "Space Grotesk", "Barlow", "Barlow Condensed",
  "Josefin Sans", "Quicksand", "Cabin", "Hind", "Heebo", "Assistant", "Archivo", "Archivo Narrow", "Oswald",
  "Titillium Web", "Exo 2", "Kanit", "Prompt", "Mukta", "Red Hat Display", "Red Hat Text", "IBM Plex Sans", "Public Sans",
  "Be Vietnam Pro", "Epilogue", "Albert Sans", "Onest", "Instrument Sans", "Schibsted Grotesk", "Hanken Grotesk", "Jost",
  "Questrial", "Varela Round", "Comfortaa", "Maven Pro", "Asap", "Catamaran", "Overpass", "Signika", "Dosis",
  "Encode Sans", "Libre Franklin", "Chivo", "Saira", "Arimo", "Tenor Sans", "Didact Gothic", "Lexend Deca", "Readex Pro",
  "Rethink Sans",
];

const SERIF = [
  "Playfair Display", "Merriweather", "Lora", "EB Garamond", "Cormorant Garamond", "Cormorant", "Libre Baskerville",
  "Crimson Text", "Crimson Pro", "PT Serif", "Noto Serif", "Source Serif 4", "Roboto Serif", "Bitter", "Arvo", "Zilla Slab",
  "Roboto Slab", "Domine", "Spectral", "Cardo", "Old Standard TT", "Libre Caslon Text", "Bodoni Moda", "Prata", "Marcellus",
  "Cinzel", "DM Serif Display", "DM Serif Text", "Fraunces", "Young Serif", "Gelasio", "Newsreader", "Literata",
  "Frank Ruhl Libre", "Alegreya", "Vollkorn", "Gilda Display", "Italiana", "Bellefair", "Instrument Serif", "Tinos",
];

const DISPLAY = [
  "Bebas Neue", "Anton", "Archivo Black", "Alfa Slab One", "Abril Fatface", "Yeseva One", "Righteous", "Lobster", "Bungee",
  "Fredoka", "Baloo 2", "Passion One", "Russo One", "Staatliches", "Bowlby One", "Unbounded", "Syne", "Chakra Petch",
  "Orbitron", "Audiowide", "Monoton", "Shrikhand", "Teko", "Big Shoulders Display", "Dela Gothic One", "Titan One",
  "Luckiest Guy", "Bangers",
];

const HANDWRITING = [
  "Dancing Script", "Pacifico", "Great Vibes", "Satisfy", "Caveat", "Kalam", "Shadows Into Light", "Amatic SC", "Sacramento",
  "Parisienne", "Allura", "Alex Brush", "Cookie", "Kaushan Script", "Courgette", "Indie Flower", "Patrick Hand",
  "Permanent Marker", "Homemade Apple", "Yellowtail", "Pinyon Script", "Tangerine", "Gloria Hallelujah", "Marck Script",
];

const MONO = ["Space Mono", "JetBrains Mono", "IBM Plex Mono", "Roboto Mono", "Courier Prime"];

export const GOOGLE_FONTS: { family: string; category: FontCategory }[] = [
  ...SANS.map((family) => ({ family, category: "Sans serif" as const })),
  ...SERIF.map((family) => ({ family, category: "Serif" as const })),
  ...DISPLAY.map((family) => ({ family, category: "Display" as const })),
  ...HANDWRITING.map((family) => ({ family, category: "Handwriting" as const })),
  ...MONO.map((family) => ({ family, category: "Monospace" as const })),
];

const BY_NAME = new Map(GOOGLE_FONTS.map((f) => [f.family.toLowerCase(), f.family]));

/** The font as listed, when it's one we can use (any letter case), else null. */
export function listedFont(name: string | null | undefined): string | null {
  return name ? (BY_NAME.get(name.trim().toLowerCase()) ?? null) : null;
}

// Well-known paid and system fonts, and the free font that looks most like each
const LOOKALIKES: [RegExp, string][] = [
  [/helvetica|arial|neue haas|univers|graphik|sf pro|system-ui|-apple-system|segoe/i, "Inter"],
  [/futura/i, "Jost"],
  [/avenir|sofia pro|museo sans/i, "Nunito Sans"],
  [/gotham|proxima/i, "Montserrat"],
  [/brandon/i, "Josefin Sans"],
  [/circular|walsheim|euclid|aeonik/i, "DM Sans"],
  [/gilroy|gt america|tt commons|campton/i, "Plus Jakarta Sans"],
  [/gill sans|frutiger|myriad|calibri|verdana|tahoma/i, "Lato"],
  [/century gothic|nexa/i, "Questrial"],
  [/din\b|bebas|knockout|tungsten|impact/i, "Oswald"],
  [/garamond|sabon|minion/i, "EB Garamond"],
  [/canela|freight|chronicle|tiempos|ogg/i, "Cormorant Garamond"],
  [/baskerville/i, "Libre Baskerville"],
  [/caslon/i, "Libre Caslon Text"],
  [/didot|bodoni/i, "Bodoni Moda"],
  [/trajan/i, "Cinzel"],
  [/optima/i, "Marcellus"],
  [/georgia/i, "Gelasio"],
  [/times/i, "Tinos"],
  [/courier|mono/i, "Courier Prime"],
  [/script|brush|hand|signature/i, "Dancing Script"],
];

/**
 * A font we can use for this name: the name itself when it's in the list, else the closest
 * look-alike (by known name, then by kind: serif or sans). Null when there's no name.
 */
export function closestFont(name: string | null | undefined, role: "heading" | "body"): string | null {
  if (!name?.trim()) return null;
  const listed = listedFont(name);
  if (listed) return listed;
  const known = LOOKALIKES.find(([pattern]) => pattern.test(name));
  if (known) return known[1];
  const serif = /serif/i.test(name) && !/sans/i.test(name);
  if (role === "heading") return serif ? "Playfair Display" : "Montserrat";
  return serif ? "Lora" : "Inter";
}
