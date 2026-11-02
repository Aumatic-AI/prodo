# Prodo add-on: Creative Excellence & Image Composition

> **For Claude Code (Prodo repo).** Add this as a new section of `prodo-creative-knowledge.md` (suggested: **§8A**, after §8 Visual craft) and wire it into the agent prompts listed in A.0. It raises the bar from "correct" to "remarkable": every piece has a reason, a meaning and a deliberate composition. Everything in §1 (truth, law, platform policy) still wins over this section. Text, prices and logos are still rendered by code (Satori/FFmpeg), never by the image model; this section tells the image model where to *leave room* for them.

---

## 8A. Creative excellence and image composition

### A.0 Which agents get this
| Agent | Must include | Why |
|---|---|---|
| Creative Director | A.1–A.4, A.6, A.8 | Concept, insight, reasoning and the composition plan for every asset |
| Producer | A.5–A.7 | Turns the composition plan into image and keyframe prompts plus Satori layouts |
| QA Critic | A.9 | Scores creative excellence and composition at Gate 1 and Gate 2 |

### A.1 Who the agents are
The Creative Director and Producer work as **two people in one room**:
- **An award-winning art director and commercial director:** one big idea, one unforgettable image, deliberate composition, nothing in frame without a reason.
- **The social media lead of a much-loved brand:** knows what stops a thumb, what gets saved and shared, and what reads as native instead of as an ad.

Both must say yes. **Correct but forgettable is a failure.**

### A.2 Every asset carries a reason and a meaning
Before any prompt is written, the Creative Director records:
1. **Insight:** the one-line human truth the asset is built on ("Busy parents don't want more recipes, they want fewer decisions.")
2. **Single-minded message:** the one thing the viewer must take away (ties to the desire and angle).
3. **Visual idea:** the one image that expresses the message *without words* (if the headline were deleted, would the picture still say it?).
4. **Why this works:** 2–3 sentences linking insight → visual idea → desire → awareness level. This goes into `rationale`.

If the visual idea only works with the headline, it isn't a visual idea yet. Rethink it.

### A.3 Great vs ordinary
| Ordinary (reject) | Great (aim for) |
|---|---|
| Product centred on a plain background with a headline on top | The product **inside a moment** that shows the benefit (the outcome, the use, the relief) |
| Literal illustration of the headline | A visual that adds a second layer: contrast, surprise, a visual metaphor or a before/after implied in one frame |
| Several equal elements competing | **One focal point**, a clear hierarchy, generous negative space |
| Stock-feeling people smiling at the camera | Specific people with a real expression, doing something, mid-moment |
| Even, flat lighting | Light with direction and intent that guides the eye to the focal point |
| Decoration for its own sake | Every element earns its place; remove anything that doesn't serve the message |

### A.4 The creative process (silent, inside the Creative Director prompt)
1. Write the **insight**.
2. Sketch **3 visual concepts** for the same message, each using a different device: a visual metaphor, contrast or split, a result-first or after shot, a human moment, an unexpected scale or angle, a pattern break.
3. Score each 1–5 on:
   - stopping power at thumbnail size
   - clarity in 3 seconds
   - emotional pull
   - shareability or save value
   - brand fit
   - truthfulness (§1)
   - producibility (the image model can render it; text stays with code)
4. Pick the **boldest concept that scores ≥ 4 on clarity, truthfulness and producibility**. Bold never beats true or clear.
5. Write the **composition plan** (A.5–A.7).
6. **Art director's polish:** remove one element, strengthen the focal point, check the eye path, check the negative space for text.
7. **Social lead's check:**
   - Does it stop the scroll in under a second?
   - Is it native to the platform?
   - Would someone save it or send it?

### A.5 Composition: the golden ratio and proportion
Use proportion deliberately. The golden ratio (φ ≈ 1.618) is a **guide for placing the focal point and dividing space**, not a rule to obey blindly. The rule of thirds is the simpler fallback. Choose one grid per asset and record it.

**Phi grid.** Divide the frame at **38.2% and 61.8%** on both axes. The four intersections are the **power points**. Place the main focal point (a face, the eyes, the product's key feature) on one power point. Put the secondary element on the diagonally opposite one, or let it lead the eye toward the first.

**Golden spiral.** For dynamic or lifestyle shots, let the main subject sit at the spiral's tight end, with supporting elements (a hand, a line, a gaze, a pour) curving along the spiral toward it.

**Golden rectangle split.** Divide the frame into a 61.8% image zone and a 38.2% text zone (left/right or top/bottom). This is the default for static ads with a headline: the image model fills the 61.8% zone with the subject and keeps the 38.2% zone calm and low-detail for Satori text.

**Power-point coordinates (pixels):**
| Format | Size | Vertical phi lines (x) | Horizontal phi lines (y) |
|---|---|---|---|
| Feed 4:5 | 1080×1350 | 413, 667 | 516, 834 |
| Story/Reel 9:16 | 1080×1920 | 413, 667 | 733, 1187 |
| Square 1:1 | 1080×1080 | 413, 667 | 413, 667 |

On 9:16, both horizontal phi lines (733 and 1187) sit inside the safe zone (out of the top ~14% and bottom ~35%, §9.4). Put the focal point and the headline anchor on these lines, never in the bottom 35%.

**Other proportion rules:**
- **Visual weight:** the focal point is the largest, sharpest, highest-contrast area. Secondary elements are smaller, softer or darker.
- **Negative space:** at least 30–40% of the frame is calm space. It gives the focal point power and gives code-rendered text a home.
- **Scale contrast:** one dominant element at about 1.618× (or more) the size of the next. Never two equal-sized heroes.
- **Eye path:** gaze direction, leading lines, hands and light should all point toward the focal point, then toward the text zone, then toward the CTA.
- **Horizon and lines:** on a third or phi line, never dead centre (unless symmetry is the deliberate idea).
- **Odd numbers:** groups of 1, 3 or 5 objects read more naturally than 2 or 4.
- **Breathing room:** the subject faces into the open space, never into the edge of the frame.

### A.6 Ad layout structures (choose one per static/carousel; tag `layout`)
| layout | Structure | Best for | Text zone for Satori |
|---|---|---|---|
| `golden_split` | 61.8% image / 38.2% text (vertical or horizontal) | Most single-message statics, offer cards | The 38.2% zone |
| `hero_center` | One subject centred, symmetrical, lots of space around it | Product heroes, premium brands | Top phi band and bottom band (inside safe zones) |
| `z_pattern` | Eye goes top-left → top-right → diagonal → bottom-right | Headline + image + CTA ads | Headline top-left, CTA bottom-right |
| `f_pattern` | Heavy left column, scanning lines | Text-heavier educational statics, LinkedIn | Left column |
| `rule_of_odds` | Three items with the hero in the middle, larger | Product ranges, "3 reasons" posts | Above or below the trio |
| `split_contrast` | Two halves: before/after or old way/new way, the same framing and light | before_after, side_by_side, face_off | Label strip on each half |
| `frame_within_frame` | The subject framed by a doorway, window, hands or shelf | Lifestyle and story moments | The calm area outside the inner frame |
| `diagonal_dynamic` | Subject and lines along a diagonal | Energy, motion, sport, food pours | The opposite corner from the subject |
| `full_bleed_minimal` | One image edge to edge, tiny text | Mood or brand-building posts, cinematic | Small anchor on a phi line |
| `notes_native` | Native-looking (notes app, screenshot style) | `notes_screenshot` static framework | Code renders the whole thing |

**Mapping from Prodo static frameworks (§5.5):**
- `offer_card` → `golden_split` or `z_pattern`
- `golden_review` → `hero_center` (the quote is the hero)
- `editorial_callout` → `full_bleed_minimal`
- `side_by_side` / `myth_vs_fact` → `split_contrast`
- `listicle_carousel` → slide 1 `golden_split` (hook), middle slides one consistent template, last slide `hero_center` with the CTA

### A.7 Turning the plan into prompts (Producer)
For every image or keyframe, write the prompt in this order:

```
CONCEPT:      [the visual idea in one line, from A.2]
FOCAL POINT:  [what it is, which power point (e.g. "upper-right phi intersection"), and its size in frame]
LAYOUT:       [layout key + which zone stays calm for code-rendered text, e.g. "left 38% of the frame is calm, softly lit wall, no detail"]
SECONDARY:    [supporting elements and how they lead the eye to the focal point]
EYE PATH:     [gaze, hands, lines, light direction → focal point → text zone]
SUBJECT:      [person/product details, matching references exactly]
ENVIRONMENT:  [specific, lived-in place; odd-numbered props; nothing without a reason]
LIGHT:        [key light direction that lands on the focal point; contrast lower in the text zone]
LENS:         [focal length and depth of field; background softer than the focal point]
STYLE:        [per recipe/brand, §8.6]
CONSTRAINTS:  [no text, no logos, no letters, the text zone stays empty, safe zones respected, natural physics (§8.1)]
```

- **Describe positions in plain spatial words** the model understands ("subject in the right third, eyes at about one-third from the top, open space on the left"). Image models don't measure percentages precisely, so say both the words and the intent.
- **Satori text layout uses the same grid:** the headline baseline on a phi line, the CTA at a lower power point inside the safe zone, sizes in a 1 : 1.618 : 2.618 scale (body : subhead : headline).
- **Carousels:** keep the same grid and focal-point position across slides, so the swipe feels like one piece.
- **Video keyframes** follow the same composition. The camera move (§8.4) should travel *toward* a power point or reveal the focal point on a phi line by the end of the clip.

### A.8 Output fields to add (Creative Director → Producer)
```json
"creative": {
  "insight": "string",
  "single_message": "string",
  "visual_idea": "string",
  "concepts_considered": ["string", "string"],
  "device": "visual_metaphor | contrast | result_first | human_moment | unexpected_scale | pattern_break",
  "why_it_works": "string (2–3 sentences)"
},
"composition": {
  "grid": "phi_grid | golden_spiral | golden_split | rule_of_thirds | symmetry",
  "layout": "golden_split | hero_center | z_pattern | f_pattern | rule_of_odds | split_contrast | frame_within_frame | diagonal_dynamic | full_bleed_minimal | notes_native",
  "focal_point": { "what": "string", "position": "upper_left | upper_right | lower_left | lower_right | center", "size_share": "string" },
  "text_zone": { "position": "left | right | top | bottom | none", "share": "0.382 | other" },
  "eye_path": "string",
  "negative_space_share": "number (0.3–0.5 typical)"
}
```
Add these enums to §13. Code validates them (zod) and passes `text_zone` to the Satori layout, so the image and the text always agree.

### A.9 QA additions
**Gate 1 (brief), add a dimension:**
| Dimension | Weight | What a 10 looks like |
|---|---|---|
| Creative excellence and composition | 15% (take 5% each from Persuasion craft, Producibility and Brand) | A clear insight; the visual idea works without words; one focal point on a power point; a deliberate layout; 30%+ calm space; a text zone that matches the Satori layout; no clichés |

**Gate 2 (asset), add to the §8.3 checklist:**
- [ ] One clear focal point, at or near the planned power point
- [ ] The text zone is calm and empty in the generated image (no detail where Satori text will go)
- [ ] The eye path leads to the focal point, then the text, then the CTA
- [ ] No two equally weighted heroes; at least ~30% negative space
- [ ] The subject faces into open space; the horizon is not dead centre (unless symmetry was planned)
- [ ] Readable at thumbnail size (the focal point is still clear at ~20% scale)

**Auto-fail additions:**
- the visual idea depends entirely on the headline
- the generated image puts high detail or faces inside the planned text zone
- a cliché from A.10 is used as the main idea

### A.10 Clichés to avoid
- Product floating on a gradient with a lens flare
- People smiling straight at the camera holding the product up
- A handshake or a "team high-five"
- A laptop on a desk with a coffee as the hero
- Headlines like "Introducing…", "Imagine…", "Elevate your…", "Unlock…", "Game-changer"
- A centred product with text stacked above and below, filling every gap
- Generic "diverse group laughing" with no story

### A.11 Worked example (illustrative only; never reuse the details)
**Brief:** a meal-kit brand; desire: comfort; awareness: problem aware; format: 4:5 static.
- **Ordinary:** a meal-kit box centred on a kitchen counter, with "Healthy Meals Delivered" on top.
- **Great:**
  - *Insight:* the hardest part of dinner is deciding, not cooking.
  - *Visual idea:* a fridge door covered in crossed-out sticky notes ("pasta again?", "takeout?"), with one hand placing a single calm card on top.
  - *Layout:* `golden_split`, image on the right 61.8%. The hand and card sit on the upper-right phi point. The left 38.2% is a softly lit plain wall for Satori text.
  - *Eye path:* the notes curve along the golden spiral toward the card, the gaze goes left to the headline, and the CTA sits at the lower-left power point.
  - *Headline (code-rendered):* "Tonight's already decided."
