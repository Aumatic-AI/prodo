import type { TemplateId } from "@/core/creative/brief";

// What each image ad layout is for (the Creative Director picks from these) and how its photo
// should be framed (the Producer adds that to the picture prompt, so the photo suits the layout).

export const TEMPLATE_NOTES: Record<TemplateId, string> = {
  spotlight: "full photo, words over a soft shade on the photo's calm side (top or bottom): strong lifestyle and in-use photos",
  editorial: "magazine cover: full photo, a large elegant title with a fine rule and a small kicker; premium fashion, beauty and lifestyle",
  poster: "gallery print: the photo inset with a wide border, words set calmly below; products and premium details",
  split: "photo on one side, words in a clean panel on the other: clear products, explanations and comparisons",
  frame: "brand-coloured canvas with the photo as a rounded card: editorial, considered",
  bold: "full photo with the headline in a solid block: loud, scroll-stopping claims and offers",
  offer: "the price or the live deal set very large next to the product: offers and promotions only",
  quote: "a customer's words set large as a quote, the photo small beside them: reviews only",
};

/** How the photo is framed for each layout: added to the picture prompt by code. */
export const LAYOUT_PHOTO: Record<TemplateId, string> = {
  spotlight: "Compose so that either the top or the bottom quarter of the frame is simple (sky, wall, floor or soft blur), with the subject clear of it.",
  editorial: "Magazine-cover framing: the subject in the middle and lower part of the frame, with a simple, uncluttered top fifth.",
  poster: "Fill the frame with the subject; the photo is shown inside a border, so no empty space is needed.",
  split: "Fill the frame with the subject; the photo sits beside a panel, so no empty space is needed.",
  frame: "Fill the frame with the subject; the photo is shown as a card, so no empty space is needed.",
  bold: "A strong, simple composition with the subject in the upper two thirds and a simple lower third.",
  offer: "The product clear, centred and well lit on a simple background.",
  quote: "A calm, simple photo of the product or its setting, not busy.",
};
