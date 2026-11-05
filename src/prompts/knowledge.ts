import { AWARENESS_LEVELS, CAMERA_MOVES, DESIRES, FRAMEWORKS, HOOK_TYPES, LEVERS, STATIC_FRAMEWORKS, STYLE_MODIFIERS } from "@/core/creative/brief";

// The creative knowledge base (prodo-creative-knowledge.md), compressed into rules and tables for
// the agent prompts. Each agent prompt takes only the blocks its job needs (knowledge base §0.3).
// Facts never come from here: every example is a pattern, and proof, prices, numbers and names come
// only from the brand's own data.

/** §0.3 Order of precedence when rules conflict */
export const PRECEDENCE = `When rules conflict, the higher one wins: 1) truth, law and platform policy; 2) the approved brand voice and never-say list; 3) what this account's own results have taught (learnings); 4) platform best practice; 5) general craft guidance.`;

/** §1 Non-negotiables */
export const TRUTH = `NON-NEGOTIABLES (these override everything)
- No invented facts: never invent statistics, percentages, customer counts, ratings, review counts, awards, press mentions, certifications, study results, expert endorsements, names of real people, prices or deadlines. Use only values in the brand's data. If a framework step needs proof that doesn't exist, pick another framework or a softer claim.
- No fake testimonials: reviews appear only as real customer words from the stored reviews, shown as text or read as a quote. An AI-made person never presents a review as their own experience; never invent a customer story, name or face.
- No fake scarcity or urgency: "ends Sunday" or "only 20 left" only when a live offer has that end date or quantity.
- No unqualified superiority ("best", "#1", "clinically proven") unless a stored proof backs it.
- Never name, show or imitate a real person, creator or celebrity, and never name a competitor; compare with "the old way" or the category.
- Health, finance and legal claims: no cure claims, no guaranteed income, no before/after that suggests typical results without proof.
- Nothing prohibited in a scene (weapons, smoking or vaping, alcohol near minors, drugs, gambling cues, dangerous stunts, medical procedures), no sexualised content, gore or body shaming, no fake UI (play buttons, notifications, system dialogs).
- Native style is fine, but never claim it isn't an ad ("not sponsored", "not an ad"). No deliberate mistakes to bait comments, no staged debates.
- A realistic AI-made human anywhere in the ad means it carries the platform's AI label (requiresAiLabel: true). The brand's own real photos and footage don't need it.`;

/** §2 Strategic diagnosis */
export const DIAGNOSIS = `STRATEGIC DIAGNOSIS (decide before writing a word)
- Desire: you can't create desire, only capture it. Pick the persona's ONE dominant desire of six: health (feel and look good, energy), attraction (be desired), status (respected, admired), belonging (fit in, be accepted), control (power over time, money, life), comfort (ease, less stress). Never two desires in one ad.
- Awareness level and what the ad must do:
  unaware: interrupt, make them notice something is off; entertain or teach first (objective awareness).
  problem_aware: name the pain precisely, agitate, hint there is a way out (awareness or converting).
  solution_aware: show why our way works differently and better (converting).
  product_aware: remove the last objection; proof, offer, risk reversal (converting or retargeting).
  most_aware: the right offer at the right time, community, new uses (retargeting).
  Never ask a cold audience to buy ("proposing on the first date").
- Market sophistication, and what to lead with: 1 new category: the plain claim. 2 others claim it too: a bigger, more specific claim. 3 claims exhausted: a NEW MECHANISM (how it works differently). 4 mechanisms copied: a better mechanism. 5 nobody believes claims: IDENTITY (who the buyer becomes).
- Beliefs: start from a belief the audience already holds; never open by contradicting a strong one.
- Gradualization: an obvious agreement, then a second more specific one, then one that brings in our angle, then the big claim, which now feels like the logical end. Never open with the unbelievable promise.
- Intensification: put them inside the outcome with concrete sensory detail ("you wake up and your back doesn't hurt"), shown in pictures, not just said.
- Identity: who they become by buying ("a good parent", "someone with discipline"). Every ad carries a touch of it.
- Redefinition: handle the main objection by changing the comparison (a price against what the alternative really costs), using only true comparisons.
- Mechanism: claims are believed when the "how" is shown (ingredients, the process, the product working, the team and tools for services).
- Concentration: beat "the old way" (DIY, the usual method, doing nothing) on cost, time, effort or result. Only true comparisons.
- Camouflage: look native to the platform. TikTok and Reels: phone-shot, casual, creator-like. Meta feed: a photo with text that looks like a friend's post, or a carousel. Stories: quick and lo-fi. YouTube: teach.`;

/** §3 Levers */
export const LEVERS_KNOWLEDGE = `LEVERS (1–3 per ad, each one backed by real data): ${LEVERS.join(", ")}.
- social_proof needs real reviews or counts; authority real credentials, years, certifications or press; scarcity a live offer's end date or quantity; risk_reversal a guarantee or trial the brand really offers. Without the fact, don't use the lever.
- reciprocity: teach something genuinely useful first. commitment: a small first step (save, comment, quiz). liking: relatable people, humour, the founder, behind the scenes. unity: "for people like us", local pride.
- curiosity_gap: a specific, closable gap ("the one setting that…"), never vague ("you won't believe…"). Open a loop in the hook and close it near the end; a small second loop in the middle carries retention.
- loss_aversion: "stop losing" often beats "save", used honestly, never manufactured fear. anchoring: show the expensive alternative first. Specific beats vague ("4 minutes to set up") but only with real specifics.
- Pay off the promise a little better than expected; a hook that doesn't pay off teaches people to scroll past the brand.
- Make it simple, unexpected, concrete, credible, emotional and a story. Shareable content gives social currency, practical value (save-worthy) or high-arousal emotion (awe, amusement, excitement).
- Build the brand while selling: the brand's colours, product and look show early, not only at the end. People, a sense of place, a story unfolding and real voices beat floating products and walls of words.`;

/** §4 Hooks */
export const HOOKS_KNOWLEDGE = `HOOKS (the first 1–3 seconds decide whether anything else is seen)
- A hook creates curiosity, triggers emotion or promises value, and has three parts that say the same thing: the VISUAL (frame one and how it moves in the first half second), the SPOKEN first line, and the TEXT on screen (at most 7 words, visible in the first second).
- Types (hook_type): question (self-identification: "Do you still…?", awareness 1–2), bold_claim (a strong promise proven later, 3–4), contrarian ("Stop doing X. Here's why.", 2–3, without attacking a strongly held belief), number_list ("3 mistakes killing your…", odd numbers, 1–3), pov ("POV: you finally…", 1–2), mistake ("You've been doing X wrong", 1–2), result_first (open on the finished result, 2–4), before_after (contrast, 2–4), pattern_interrupt (an unexpected object, motion or angle in frame one, 1), story_open (a real story, 1–2), callout ("If you're a … who …", 2–3), social_signal ("Why are … switching to …", only if true, 2–3), teach ("The trick … use for …", 1–2), challenge (ours vs the old way, 3–4), confession ("I have to admit…", 1–3).
- Visual hook: motion in the first half second (start mid-action or with the camera already moving); a face or hands with clear emotion, or the product in an unusual state, or the result first; high contrast and one focal point that reads at thumbnail size; the first shot changes within 3 seconds. No logo-only openings, no slow fade-ins.
- Spoken and text hook: at most 12 spoken words, payoff word first, talk to "you", name the persona or pain precisely ("the 3pm crash" beats "low energy"). The ad must pay the hook off; if the body can't, the hook is invalid. No clickbait.
- Shock or controversy hooks only when the brand's tone allows it. Never "AI made this" hooks for a brand that doesn't sell AI.`;

/** §5 Frameworks */
export const FRAMEWORKS_KNOWLEDGE = `FRAMEWORKS (the desire says WHAT to say; the framework says HOW). Map each beat to a scene or slide.
- spark: signal the shift → puncture the old way → announce the alternative → receipts → invite them in. Awareness, levels 2–3. Needs real adoption numbers or reviews.
- myth_killer: expose the myth → the specifics → the pivot → the evidence → the difference → enlist. Awareness, 2–3. Only true "myths".
- countdown: set the number → each item an "oh no, that's me" → the answer → credibility → action. Awareness or converting, 1–3. Real tips.
- origin_story: the human → the enemy (a systemic problem) → the ignition moment → the wins → tomorrow's vision. Awareness or retargeting. Only the brand's real story.
- shortcut: "how to X without Y" → the suffering → the one thing → why it works → the new life → the escape. Converting, 2–3. Real features.
- raw_take: begin like content → a relatable moment → ease in the product → the honest experience → a soft close. Awareness, 1–2. First-person brand voice, never a fake customer.
- pressure_cooker: where it hurts → the ripple effects → what they tried → the new way (mechanism) → proof and a call to action. Awareness or converting, 2.
- conviction: the harsh truth → why we're credible → echo the exact doubt → eliminate it with evidence → the bigger play. Retargeting, 4. Real objections and proof.
- face_off: raise the stakes → the showdown (ours vs the old way) → name the winner → go get yours. Converting, 3–4. A true, fair comparison.
- bridge: the goal → the real block → the bridge → the proof → the transformation → action. Converting, 2–3.
- cliffhanger: the surprising (true) claim → the story → the value inside it → pay it off. Awareness, 1–2.
- witness: verify the pain (a real customer) → the discovery → the change → more real reviews → endorse. Converting or retargeting, 3–5. Several stored reviews.
- demo_drop: the problem in progress → reveal the product → it working → hold on the result → the features. Converting, 3–4. Real product.
- time_machine: the starting point → the breaking point → the change → the after (same detail) → "this could be you". Converting, 2–4.
- educator: teach something real and useful → depth → align with the product → credentials → action. Awareness, 1–2.
- Classic, for short posts and captions: aida, pas (problem, agitate, solve), bab (before, after, bridge), hook_story_offer.
- By desire and awareness: health + problem aware → pressure_cooker, shortcut. status + unaware → cliffhanger, educator. comfort + solution aware → face_off, demo_drop. belonging (any) → witness, spark. control + problem aware → myth_killer, bridge.
- By objective: awareness → spark, myth_killer, raw_take, educator, pressure_cooker, cliffhanger. converting → countdown, shortcut, witness, demo_drop, time_machine, face_off, bridge. retargeting → conviction, origin_story, witness.
- Strong pairs: spark + countdown, myth_killer + pressure_cooker, origin_story + conviction, raw_take + witness, shortcut + bridge, cliffhanger + demo_drop, educator + spark.
- Style modifier (${STYLE_MODIFIERS.join(", ")}): grit = simpler, cheaper-looking, the opposite of competitors (strongest on TikTok); native = looks like a post from a person; polished = clean commercial; cinematic = mood, place and music.
- Services can't show a product in hand: show the process, the people, real results, expertise and what's included. Local businesses name the place.`;

/** §5.5 and §8.7 Image ads and carousels */
export const STATIC_KNOWLEDGE = `IMAGE ADS AND CAROUSELS
- Shapes (staticFramework): offer_card (a live offer: one benefit headline, the deal, the product big), golden_review (a standout stored review as large text), editorial_callout (ONLY with real press or an award), notes_screenshot (native notes-app feel, honest first-person brand words, never pretending to be a customer), side_by_side (old way vs ours, or before/after), listicle_carousel (slide 1 the hook, one point per slide, the last slide the call to action), myth_vs_fact (myth slide → fact slide).
- One message, read in three seconds. Order of attention: the product or a face → headline → proof → call to action.
- Headline at most 7 words. The product big and real (from the reference photo), on a believable surface with matching light and shadow. Faces with emotion beat empty scenes.
- Native looks (notes, side-by-side, a real review card) often beat polished layouts; test both.
- Carousel: slide 1 is the hook, one idea per slide, the same design throughout, the last slide is the call to action, 5–8 slides.`;

/** §6.1, §6.3, §6.4 Story and script craft */
export const SCRIPT_KNOWLEDGE = `STORY AND SCRIPT
- Short-form shape (30 s): hook 0–3 s (open the main loop) → context and stakes 3–8 s (the belief we start from) → body beats 8–24 s (a new small payoff every 2–4 s; a re-hook near 40% in anything over 15 s: "but here's the part nobody mentions") → payoff 24–27 s (close the loop, show the result, hold it) → call to action 27–30 s.
- One message per ad: if you need "and also", it's two ads. Show, don't tell: every spoken claim has a picture that proves or shows it.
- Length: awareness 9–20 s, converting 15–35 s, story or founder 30–60 s. Shorter unless every second earns its place.
- The customer is the hero and the brand is the guide. A real-feeling character, a specific place, events unfolding, a human voice.
- Voice-over: write for the ear: contractions, short sentences, one idea per line, about 2.5 words a second (a 5 s scene ≈ 12 words). Key word early, end lines on strong words. Concrete and sensory. The persona's own words, no jargon. Never describe what the picture already shows; the voice adds meaning, the picture adds proof. Write natively in the business's language; never translate idioms literally.
- Call to action: one, matched to the objective. awareness: follow, save, share, comment a real opinion; converting: shop, book, learn more; retargeting: claim the offer, book now. Benefit-loaded ("Get your first fitting free" beats "Sign up"). Real links only; urgency only with a live offer. Soft close for native and awareness posts, direct close for retargeting.`;

/** §6.5 Captions */
export const CAPTIONS_KNOWLEDGE = `CAPTIONS (the post text) per platform
- instagram: a hook line (the first 125 characters show) → value or story in 2–4 short lines → call to action → 3–5 specific hashtags.
- tiktok: one punchy line that adds context or an honest question; 3–5 hashtags.
- facebook: conversational, can run longer; the first line carries the hook; 0–3 hashtags.
- linkedin: professional but human; an insight-led first line; short paragraphs; 3–5 hashtags at the end.
- twitter (X): one sharp line under 200 characters; 0–2 hashtags.
- youtube: a title-style hook, 1–2 lines of description, 2–3 hashtags.
- The caption never contradicts the ad and never repeats the hook word for word: it adds a layer. Comment prompts are genuine questions, never staged debates.`;

/** §7 Planning the week */
export const PLANNING_KNOWLEDGE = `PLANNING THE WEEK
- Balance brand building and selling: not every post is a hard sell. Our code set each slot's objective (awareness = reach new people, levels unaware–problem_aware; converting = turn interest into action, problem_aware–product_aware; retargeting = people who know the brand, product_aware–most_aware).
- For each slot pick the persona's ONE dominant desire (${DESIRES.join(", ")}) and the awareness level (${AWARENESS_LEVELS.join(", ")}) that fits the slot's objective.
- Variety: no back-to-back repeat of angle or offering on the same platform; spread personas across the week.
- About 70% of slots lean on what learnings show works (score above 1.0 with enough posts behind it); experiment slots test ONE new thing (a hook type, a framework or an angle) so the learning stays clean.
- Offers: converting posts toward an offer's start and middle, retargeting near its end; never a slot about an offer after it ends.
- Calendar: tie a slot to an event 1–7 days before it, only when the event fits the brand.
- A learning resting on fewer than 5 posts is an early sign: don't steer hard on it.`;

/** §8.1 and §8.2 Realism, physics and scene prompts */
export const VISUAL_KNOWLEDGE = `MAKING AI PICTURES AND CLIPS LOOK FILMED
- Gravity and weight: things fall and rest with weight, liquids pour down, fabric drapes, hair falls naturally; nothing floats without a reason.
- Every motion has a cause: name it (a breeze moves the curtain, a hand lifts the cup).
- Contact: hands really grip (fingers wrapped round the object), feet touch the ground, nothing passes through anything.
- Real time: "real time, normal speed, no slow motion" unless a slow beat is deliberate.
- One light logic: a named key light (window left, sun behind) kept across scenes; shadows fall away from it; one colour temperature.
- Anatomy: five fingers, natural skin texture, real teeth. Medium shots for hand actions, not extreme close-ups.
- Continuity: the same product, clothes, hair, props, time of day and grade across the scenes of one ad.
- Scale: the product at its real size; rooms lived-in with real materials; people doing plausible things at plausible speed.
- No text in the picture: never ask the model for words, labels, prices or logos; our code adds them.
- Nobody talks in voice-over scenes: a calm natural expression, mouth closed. A person's whole head and face stay in the frame; never crop, hide or leave out the face to avoid talking.
- The camera sits on something real (tripod, slider, dolly on rails, gimbal, handheld operator, drone); name the rig.
- Imperfection reads as real: slight handheld movement for native looks, natural focus, dust in a light beam. Never "perfect, flawless, ultra-smooth, 8K, hyper-detailed".
- One camera move and one action per clip. The picture must support the move (no "over the shoulder" without a person).
- Camera moves by meaning (camera_move): static (let it speak), dolly_in (realisation, "this matters", start on a trigger), dolly_out or crane (scale, a reveal), low_to_high (product hero), slider (product on a table, with something in the foreground), arc or orbit (all sides of an object; never a full orbit on a face), slow_zoom (tension, safe for faces), crash_zoom (punchline), whip_pan (energy, toward a target), handheld (native, documentary), follow / reverse_tracking / side_tracking (walking with someone), push_past (entering a space past a doorframe), top_down (flat-lay, process, food), drone (place), motion_control or time_layer (before/after on the same path). Values: ${CAMERA_MOVES.join(", ")}.
- Lenses: 24–35 mm for places and selfie feel, 50 mm for people, 65–85 mm for close-ups and product details, 100 mm macro for texture. Vary shot sizes; never three close-ups in a row.`;

/** §8.3 Realism checklist (QA Gate 2 uses it word for word) */
export const REALISM_CHECKLIST = `REALISM CHECKLIST
- Product looks identical to the reference: shape, colour, label, proportions
- No morphing, melting, flicker or identity drift across frames
- Hands and fingers correct; objects held convincingly
- Gravity, liquids, fabric and hair behave naturally
- Motion at real-time speed (no unintended slow motion)
- Light direction and colour consistent within and across scenes
- Camera move matches the brief and is physically plausible; no drift where a locked shot was asked for
- No in-scene gibberish text or fake logos
- No talking mouth in voiceover scenes (the face itself must be visible, not cropped out)
- Continuity across scenes (wardrobe, props, time of day, grade)
- Nothing prohibited in frame
- Realistic AI human present → requires_ai_label: true`;

/** §10.1 Gate 1 auto-fails, which the Creative Director also runs as its self-check */
export const AUTO_FAILS = [
  "a claim without a fact label behind it",
  "a fake testimonial, or an AI person presented as a customer",
  "urgency or scarcity without a live offer",
  "a never-say word or a forbidden claim",
  "prohibited content",
  "a hook promise the ad doesn't pay off",
  "two desires in one ad",
  "text, labels or logos asked of the image or video model",
  "a real person or a competitor named without permission",
] as const;

/** §12 Platforms */
export const PLATFORMS_KNOWLEDGE = `PLATFORMS
- tiktok: lo-fi, creator-style, fast, sound on, trends in format only; 9–35 s; hook in the first second; text on screen.
- instagram: Reels a little more polished than TikTok, 7–30 s; feed and carousels visual and save-worthy, educational carousels drive saves.
- facebook: conversational, broader ages, captions for sound off, people and story; 15–60 s.
- linkedin: professional, insight-led, human; founder and team stories; credibility first, no hype.
- youtube (Shorts): educational, satisfying payoffs, loopable; brand early; 15–45 s.
- twitter (X): punchy opinion and insight; text first, the picture supports it.`;

/** §11.2 Why a post did what it did */
export const DIAGNOSIS_TREE = `WHY RESULTS HAPPENED
- Low reach or views (the hook failed): check motion in the first half second, specificity, a persona callout, the text hook, how the first frame reads small.
- Good hook, people left early: the promise didn't match or the body was slow; check payoff timing, a new beat every few seconds, a re-hook, the length.
- Watched but no action: a weak call to action or offer, or the wrong awareness level (asking a cold audience to buy).
- High engagement but no sales or bookings: entertaining but off-target; the angle wasn't tied to the desire the product fulfils.
- Many shares or saves: practical value or social currency; make more of that angle and format.
- Negative comments: check claims, tone and "looks AI" complaints.`;

export const VOCABULARY = { hookTypes: HOOK_TYPES, frameworks: FRAMEWORKS, staticFrameworks: STATIC_FRAMEWORKS };
