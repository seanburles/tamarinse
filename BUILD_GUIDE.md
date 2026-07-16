# Tamarinse™ — Shopify Build Guide

Internal reference doc. Lives at the root of the theme repo. Update as decisions get made — this is the single source of truth for "why did we do it this way," not just a checklist.

---

## 1. Theme Foundation

**Base theme: Horizon** (Shopify's 2025/2026 reference theme, wellness industry preset).

Why Horizon over Dawn for this project:
- Ships with a wellness-category preset — closer starting aesthetic to the Aesop/Seed/Apple direction than Dawn's generic layout.
- Web Component architecture + deeper block nesting (8 levels vs Dawn's 2), which suits a long, section-heavy scroll page.
- Better mobile Core Web Vitals out of the box — matters here because the page is animation-dense.

Risk to manage: Horizon's custom-element lifecycle can fight hand-rolled JS if you inject it carelessly. Rule for this project: **all custom interactive work (WebGL bottle, capsule scroll sequence, exposure assessment, horizontal timeline) lives in its own custom element**, registered once, mounted/unmounted cleanly on `connectedCallback` / `disconnectedCallback`. Never reach into Horizon's internal DOM from outside your own component.

Fallback: if Horizon's internals become more friction than they're worth in week one, drop to **Dawn**. Same custom-element isolation strategy applies either way, so the fallback costs you a day, not a rebuild.

```bash
shopify theme init --clone-url https://github.com/Shopify/horizon
cd tamarinse-theme
shopify theme dev --store <dev-store>.myshopify.com
```

---

## 2. Repo / Folder Structure

```
tamarinse-theme/
  assets/
    webgl/
      bottle-scene.js        # Three.js scene, isolated module
      bottle-loader.js        # GLTF/GLB loading + draco decoder
      capsule-timeline.js      # scroll-triggered capsule open/ingredient reveal
      scroll-controller.js    # shared scroll-progress utility (IntersectionObserver based)
    models/
      tamarinse-bottle.glb
      capsule.glb
    css/
      tamarinse-tokens.css     # design tokens (see STYLE section in master prompt)
  sections/
    hero-bottle.liquid
    exposure-assessment.liquid
    the-problem.liquid
    meet-tamarinse.liquid
    interactive-capsule.liquid
    how-it-works-timeline.liquid
    ingredient-science.liquid
    quality-standards.liquid
    medical-advisory.liquid
    why-tamarinse.liquid
    everyday-exposure.liquid
    reviews.liquid
    faq.liquid
    sticky-buy-bar.liquid
    closing-cta.liquid
  snippets/
    ingredient-card.liquid
    research-org-list.liquid
    reviews-badge.liquid
  templates/
    index.json
    product.json            # mirrored/restyled product page, same info order as v1
  BUILD_GUIDE.md             (this file)
  MASTER_PROMPT.md           (content + style + Cursor kickoff prompt)
```

Keep every homepage section as its own file, even the small ones — this page will be edited constantly (copy tweaks, stat swaps, ingredient updates) and you want a merchant-editable structure, not one giant hero-to-footer template.

---

## 3. Build Order (do NOT build top-to-bottom)

Build in this order regardless of the page's visual order — it front-loads the highest-risk technical work first:

1. **Design tokens + global CSS** (`tamarinse-tokens.css`) — colors, type scale, spacing scale. Everything else references these.
2. **WebGL bottle component** in isolation, on a blank test template. Get rotation, scroll-linked label-facing behavior, and performance (mobile mid-range test) solid before it ever touches the real homepage.
3. **Scroll-controller utility** — one shared IntersectionObserver/scroll-progress module that the bottle, capsule sequence, and horizontal timeline all consume. Don't let three sections each roll their own scroll-math.
4. **Hero section** — wire the bottle component in.
5. **Interactive capsule sequence** — highest design-risk section after the hero; get it validated with real content early.
6. **Exposure assessment quiz** — this is a self-contained interactive widget (state machine: questions → score → result). Build it as its own component; it doesn't need the WebGL/scroll stack at all.
7. **Static content sections** (Problem, Meet Tamarinse, Timeline, Ingredient Science, Quality Standards, Medical Advisory, Why Tamarinse, Everyday Exposure, Reviews, FAQ) — these are the 85% static portion. Batch these once the animated 15% is proven out.
8. **Sticky buy bar** — scroll-depth triggered (25%), persists across remaining scroll.
9. **Closing CTA.**
10. **Product page** — mirror homepage's visual language, same information order as the current Tamarinse.com product page for v1 (per brief: don't redesign the info architecture yet, just the aesthetics).

---

## 4. Content/Data Model Notes — Everything Merchant-Editable

Hard requirement for this project: the client needs to update copy, ingredients, quiz questions, and stats from the Shopify theme editor without a developer touching code. That rules out hardcoding any of this in Liquid or JS. Two mechanisms cover it:

**Metaobjects — for reusable, repeating content records.** Use these for anything that's a "thing with a shape" referenced in more than one place:
- **Ingredient** metaobject definition (fields: `name` single line text, `what_it_is` multi-line text, `why_we_chose_it` multi-line text, `research_orgs` list of single-line text). Create six entries under Content > Metaobjects in admin. `data/ingredients.json` in this repo is dev-time seed data for populating those entries quickly (e.g. via a one-time script or manual entry) — it is NOT the runtime source of truth once the metaobjects exist. Reference the metaobject from section schema using `"type": "metaobject_list"` with `"metaobject_type": "ingredient"`, so the Interactive Capsule, Ingredient Science, and product page sections all pull the same six editable records instead of three hardcoded copies.
- Give the metaobject **Storefront** access (required for dynamic sources/theme editor connection) — Content > Metaobjects > Ingredient > Access.
- **Known risk to validate early**: repeater/list behavior for metaobject-backed blocks has had rough edges specifically on Horizon (its block architecture differs from Dawn's). Build one ingredient card end-to-end against a real metaobject entry in week one, before assuming the pattern scales cleanly to all six.

**Section/block schema settings — for page-specific copy.** Everything else (hero headline/subhead, quiz questions, timeline step copy, pillar copy, quality standard labels, closing section copy) should be `text`/`richtext`/`image_picker` settings on the relevant section's schema, ideally block-based where content repeats (e.g. each quiz question as its own block with `text` + `number` weight setting, each timeline step as its own block). This makes the entire homepage editable section-by-section in the customizer, matching `CONTENT.md`'s structure — that file's copy becomes each section's *default* setting value, not a code constant.

- **Exposure assessment**: model each question as a block (`question` text setting + `weight` number setting) so the client can add/remove/reword questions without a deploy. Scoring logic in JS reads block data from the rendered DOM/schema output rather than a hardcoded array — keep the weighted-sum logic itself as pure, testable JS, just don't hardcode the question list into that JS.
- **Reviews badge**: build the UI to accept rating + count + source label as section settings (with room to swap in a real review-platform app feed — Judge.me, Okendo, Loox — later without a rebuild). Flag to the client that seeded/soft-launch real reviews are safer than fabricated ones.
- **Stats in "The Problem" section**: block-based (one block per statistic + source citation field) rather than hardcoded, since these need real sourcing before launch per `CONTENT.md`'s open items and are the kind of content most likely to get updated as sourcing is confirmed.

---

## 5. Performance Guardrails (Horizon-specific)

**Design and build mobile-first.** Horizon's default breakpoint behavior is mobile-first; every custom section should follow the same pattern — base styles target the phone viewport, desktop is a `min-width` enhancement layered on top, never the other way around. See `MASTER_PROMPT.md`'s "Mobile-First Requirements" section for the specific touch-target, horizontal-scroll, sticky-bar, and imagery rules — treat those as build requirements, not a post-launch pass.

- No external carousel/animation libraries beyond Three.js + GSAP (both justified: WebGL needs Three.js, and scroll-choreography across capsule/timeline/bottle benefits from GSAP's ScrollTrigger rather than reinventing it three times).
- Lazy-init the WebGL canvas — don't construct the Three.js scene until the hero section is within/near viewport.
- GLB models: Draco-compressed, target under 1–2MB for the bottle.
- Test on a mid-range Android on throttled 3G before calling any animated section "done." Horizon's default perf is good on high-end devices; that's not your real audience baseline.
- Device-tier the WebGL bottle for mobile specifically — route lower-end phones to the static fallback proactively rather than only gating on `prefers-reduced-motion`; cap pixel ratio at 1.5-2 on mobile (tighter than desktop's cap of 2).

---

## 6. Safe Deploy Workflow — Never Touch the Live Theme

The store already has a live theme (`elixir-1-5-sleep-supplement`) that must never receive edits from this project. All work happens on the **Tamarinse Dev Horizon** theme only.

**Get the exact theme ID first** (don't rely on matching by name):
```bash
shopify theme list --store hnmtjh-0i.myshopify.com
```

**Pin it in `shopify.theme.toml` at the repo root** (committed to git so this is enforced for everyone, not just remembered):
```toml
[environments.dev]
store = "hnmtjh-0i.myshopify.com"
theme = "REPLACE_WITH_TAMARINSE_DEV_HORIZON_THEME_ID"
```

**Every CLI command runs against that environment, never bare:**
```bash
shopify theme dev --environment dev
shopify theme push --environment dev
shopify theme pull --environment dev
```

**Built-in guardrail:** Shopify CLI already refuses to touch the live/published theme unless you explicitly pass `--allow-live` (or `-a`) to `theme dev`/`theme push`. Treat that flag as permanently banned on this project — it's the only way a command could reach the live theme by accident.

**Also banned without explicit sign-off:** `shopify theme publish` targeting anything other than the dev theme — that's the command that actually flips which theme is live, separate from pushing code to it.

**Before anyone runs a command for the first time:** confirm `shopify theme list` shows the environment's pinned ID still says `Tamarinse Dev Horizon` and `[unpublished]` — theme IDs don't change, but it costs ten seconds to check and it's the last line of defense before a typo'd flag.

---

## 7. Open Decisions to Confirm With Client

- Real vs. seeded reviews strategy (flagged above).
- Whether "Earth Prize 2026 winner" and specific research org claims have backing documentation on file — these are the kind of specific factual claims that should be verifiable before launch, separate from the general "supports/designed to" supplement hedge language already in the copy.
- Medical advisory board: reusing existing bios/credentials as-is, or refreshing photography/copy for the new site.
