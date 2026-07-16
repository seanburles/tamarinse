# Tamarinse™ — Master Project Prompt (Cursor / Fable 5)

Paste this as the opening prompt in a fresh Cursor chat, with `BUILD_GUIDE.md` and the theme repo open in context. Treat this file as the standing project brief — re-paste or reference it whenever starting a new Cursor session so style/content rules stay consistent.

---

## Project Summary

Tamarinse™ is a premium daily supplement built around tamarind seed extract, positioned as environmental/microplastics defense. Physician-formulated, USDA Organic, clinically studied ingredients, made in USA. 60 capsules / 30-day supply.

We are rebuilding the Shopify storefront as a luxury wellness brand + direct-response conversion funnel — think Apple, Seed, and Aesop, not a typical supplement site. The homepage is 85% static content, 15% animated/interactive moments. Every section should educate and build credibility before it sells.

Base theme: **Horizon** (Shopify reference theme, wellness preset). See `BUILD_GUIDE.md` for full technical architecture, folder structure, and build order — follow that build order, not the visual page order.

---

## Content Organization (Homepage, in visual order)

1. **Hero** (rev. 2026-07-16) — static, confident opener: bold headline beside the slowly rotating 3D bottle (WebGL spec below), one subtle entrance animation on load, **no scroll-pinning or scroll-scrubbing**. Headline: "Daily Defense Against Microplastics™." Subhead: physician formulated / USDA organic / clinically studied / made in USA. Primary CTA "Shop Tamarinse™" (accent fill), secondary "How It Works."
2. **Label reveal** — superseded by the static hero (rev. 2026-07-16): the bottle opens label-forward and drifts; no scroll-locked reveal.
3. **Exposure Assessment** (rev. 2026-07-16) — stepped quiz: one question per screen, slim progress bar ("3 of 5"), icon-led answer cards in a responsive grid (selected = bold accent border + tinted fill), soft slide transitions, one full-width accent "Continue" CTA per screen. Weighted scoring into Low/Moderate/High/Very High. Self-contained widget, no WebGL dependency.
4. **The Problem** — full-screen immersive photography, one statistic per screen, minimal copy.
5. **Meet Tamarinse** — large static bottle render, subtle hover animation, physician-formulated positioning statement.
6. **Interactive Capsule** — signature scroll-driven sequence: capsule separates → delayed-release explanation → six ingredients reveal one at a time → capsule closes.
7. **How Tamarinse Works** — horizontal scroll timeline, 5 steps (Exposure → Activates → Binds → Supports → Naturally Eliminates*), illustration-led, minimal text per step.
8. **Ingredient Science** — six ingredient cards (Tamarind Seed Extract, Okra Polysaccharides, Fenugreek Extract, Activated Coconut Charcoal, Organic Chlorella, Milk Thistle Extract), each with what-it-is / why-we-chose-it / research orgs list. Model as a Shopify **metaobject** (see BUILD_GUIDE.md section 4), referenced via `metaobject_list` dynamic sources — this is a hard requirement so the client can edit ingredient copy from the Shopify admin without a code deploy, and it also solves "don't hand-code the same six cards three times."
9. **Quality Standards** — minimalist icon row: USDA Organic, Physician Formulated, Clinically Studied, Made in USA, Third-Party Tested.
10. **Medical Advisory Board** — reuse existing bios/credentials, premium trust layout.
11. **Why Tamarinse** — three animated pillars: Daily Defense / Clean Ingredients / Smarter Delivery.
12. **Everyday Exposure** — lifestyle photography grid, one message: exposure happens every day.
13. **Reviews** — luxury layout, testimonials + physician reviews + video stories. *Client-approved direction: artificial placeholder reviews until real ones arrive, shipped as editable customizer defaults (never hardcoded in the template) so real reviews are a content swap. Compliance was flagged and resolved as the client's call — see BUILD_GUIDE section 8.*
14. **FAQ** — reuse existing content.
15. **Sticky Buy Bar** — appears ~25% scroll depth, persists: bottle thumbnail, price, subscribe & save, add to cart.
16. **Closing** — large typography, "Microplastics aren't going away. Your daily defense starts with Tamarinse™," final CTA.

**Product page**: mirror this same information order for v1, restyled to match the new aesthetic — not a redesign of the info architecture yet.

---

## Style Guidelines

**Positioning**: closer to Apple / Seed / Aesop than a traditional supplement brand. Clean, scientific, luxurious, intentional. Every section educates and builds credibility before it asks for the sale.

**Design tokens** (starting point — refine once brand assets/photography are in hand):
- Palette (client direction 2026-07-16, rev. 2 — confident/clean/minimal, Seed/Ritual/AG1 energy, not clinical and not soft-wellness): warm cream base (`#FAF6EE`, never stark white), warm sand panels (`#F3EEE2`), warm near-black ink text (`#191712`), and ONE bold saturated accent — deep green (`#0D7A3F`) — reserved strictly for CTAs, selected states, and key highlights. Capsule tan (`#9A8A68`) is a sparing secondary (review stars). Earlier palettes (near-black luxury; pale sage) are superseded; tokens live in `assets/tamarinse-tokens.css`.
- Type: Fraunces (variable serif, optical sizing) for headlines — editorial, not techy — and Hanken Grotesk for body copy, both loaded from Google Fonts. Weight is the depth axis: display ~540, section titles ~580, card titles ~560, eyebrows/CTAs 600, body 400. Generous line-height, generous whitespace — the copy should never feel dense.
- Motion: restrained and purposeful. Every animation should be tied to scroll position or a clear user action — no decorative looping motion, no autoplay attention-grabbers. 20-30 second bottle rotation is the pace-setter for how "slow and deliberate" the rest of the motion language should feel.
- Photography: large-format, immersive, one subject per screen in "The Problem" and "Everyday Exposure" sections — no collage/grid treatments there.
- Icons: minimalist line icons only, consistent stroke weight, no filled/glyph-style icons mixed in.

**Copy voice**: declarative, confident, unhurried. Short sentences. Avoid supplement-industry clichés ("supercharge," "detox blast"). Every health-related claim should read as measured ("designed to," "supports," "clinically studied") rather than absolute — keep the existing hedge language pattern from the current copy deck; don't tighten it into stronger claims for punchiness.

---

## Mobile-First Requirements

Horizon's own architecture is mobile-first — don't fight it with desktop-first custom CSS in your own sections. Build every new section's base styles for the mobile viewport, then enhance upward with `min-width` media queries, not the reverse. Given the likely traffic mix for a DTC wellness brand, most visitors will hit this page on a phone first.

- **Touch targets**: every interactive element (quiz answers, CTA buttons, sticky buy bar controls, timeline nav) is minimum 44x44px, regardless of how it looks on desktop.
- **Horizontal scrolling timeline**: must support native touch swipe, not just scroll-jacked JS. Use CSS scroll-snap for step alignment, and leave a visible partial peek of the next step at the viewport edge so it doesn't read as "end of content."
- **Sticky buy bar**: respect `env(safe-area-inset-bottom)` on iOS so it never overlaps the home indicator/gesture bar, and keep the Add to Cart control within comfortable one-handed thumb reach.
- **Fluid typography**: use `clamp()` for headline/subhead sizing so type scales smoothly across phone/tablet/desktop instead of jumping at breakpoints.
- **Art-directed imagery**: full-bleed photography sections (The Problem, Everyday Exposure) need dedicated portrait crops served via `<picture>`/`srcset` for mobile — not a landscape image scaled down, which loses the subject.
- **Exposure assessment**: one question per screen on mobile matches natural swipe/tap flow; confirm this is a deliberate responsive layout choice in the build (not just a squeezed desktop grid).

### WebGL bottle — mobile-specific handling

- Device-tier before rendering, not just after: check `navigator.hardwareConcurrency` / `navigator.deviceMemory` (or a quick WebGL capability probe) and route lower-tier mobile devices straight to the static fallback image proactively — a phone sustaining a 20-30 second continuous rotation loop is a real battery/thermal cost, not just a reduced-motion accessibility concern.
- Cap device pixel ratio at 1.5-2 on mobile specifically (tighter than the general desktop cap) — full DPR on a high-density phone screen buys negligible visible quality for real render cost.
- Test the scroll-linked rotation specifically for scroll-jank on real phones — mobile scroll performance degrades faster than desktop under heavy paint work, and a stuttering hero is worse than a static one.

---

## WebGL / Three.js Hero Bottle — Technical Spec

- Isolated custom element (`<tamarinse-bottle-scene>`), registered once, mounted only when the hero section is near/in viewport (IntersectionObserver-gated), fully disposed (geometry/material/texture/renderer) on `disconnectedCallback` — this must not leak memory as users scroll past and back.
- Three.js scene: single GLB bottle model (Draco-compressed, target <1-2MB), studio-style lighting (soft key + rim light), transparent/gradient background so it composites over the hero section's own background.
- Idle state: continuous Y-axis rotation, one full rotation per 20-30 seconds, `requestAnimationFrame`-driven with delta-time so rotation speed is frame-rate independent.
- No scroll-linked state (rev. 2026-07-16): the bottle opens label-forward and idles from there; scroll-scrubbing was removed with the static hero.
- Performance: cap pixel ratio at 2, pause the render loop entirely (don't just hide the canvas) when the canvas is out of viewport, and provide a static PNG fallback bottle image for reduced-motion preference / low-end device detection.
- Respect `prefers-reduced-motion`: skip the continuous idle rotation and jump straight to the static label-forward pose.

---

## Cursor / Fable 5 Kickoff Instructions

When starting the build in Cursor:
1. Load `BUILD_GUIDE.md` and this file into context first.
2. Follow the **build order in BUILD_GUIDE.md section 3**, not the visual page order above — tokens and the WebGL component get validated in isolation before touching real sections.
3. Every new interactive section (capsule, timeline, quiz, bottle) should be its own custom element with its own disposal logic — do not attach global scroll listeners from inside Horizon's section templates directly.
4. Flag any Horizon custom-element lifecycle friction immediately rather than working around it with hacks — note it in BUILD_GUIDE.md's open decisions so we can evaluate the Dawn fallback early rather than late.
5. Data-model the six ingredients and their research org lists once, as a Shopify metaobject, shared across the Interactive Capsule, Ingredient Science, and product page sections.
6. **Everything on the homepage must be editable in the Shopify theme customizer** — no hardcoded copy or content arrays in Liquid/JS. Use section/block schema settings (`text`, `richtext`, `image_picker`, block-based repeaters) for page-specific copy, and metaobjects + dynamic sources for reusable structured content (ingredients, and any other content type that repeats across sections/templates). Treat `CONTENT.md` as the *default setting values* to ship with, not as literal strings to hardcode.
