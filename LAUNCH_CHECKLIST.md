# Pre-Launch Checklist

Everything here is an open item already flagged somewhere in BUILD_GUIDE.md / MASTER_PROMPT.md / CONTENT.md — collected in one place so nothing gets lost between now and launch.

## Content / Legal
- [ ] Reviews section populated with real or seeded reviews — not fabricated quotes/ratings
- [ ] "2026 Earth Prize winner" claim — verify documentation exists before publishing
- [ ] Statistics in "The Problem" section — sourced and cited, not placeholder numbers
- [ ] Naturally Eliminates* footnote — exact disclaimer wording confirmed with client/legal
- [ ] Medical Advisory Board bios — confirmed as reused-as-is vs. refreshed

## Content Architecture
- [ ] Ingredient metaobject definition created in admin, matching `metaobjects/ingredient-definition.md`
- [ ] All six ingredient entries populated and Storefront access enabled
- [ ] Every homepage section confirmed editable in theme customizer (no hardcoded copy remaining)
- [ ] Exposure assessment questions confirmed as editable blocks, not a hardcoded array

## Technical / Performance
- [ ] WebGL bottle tested on a mid-range Android, throttled 3G
- [ ] `prefers-reduced-motion` verified — static bottle pose, no forced rotation
- [ ] Low-end/mobile device tier confirmed to route to static bottle fallback proactively (not just via reduced-motion)
- [ ] WebGL canvas confirmed to pause render loop (not just hide) when out of viewport
- [ ] Device pixel ratio capped at 1.5-2 on mobile, 2 on desktop
- [ ] GLB models Draco-compressed, under 1-2MB
- [ ] Capsule sequence, timeline, and quiz each confirmed to dispose cleanly (no scroll-listener leaks) when scrolled past
- [ ] All interactive touch targets (quiz, CTAs, sticky bar, timeline nav) audited at ≥44x44px
- [ ] Horizontal timeline tested with real touch swipe on iOS + Android — not trackpad/mouse emulation
- [ ] Sticky buy bar respects `env(safe-area-inset-bottom)`, doesn't overlap iOS home indicator
- [ ] Full-bleed photography sections (The Problem, Everyday Exposure) confirmed using portrait-cropped mobile images, not scaled-down landscape
- [ ] Headline/subhead type scaling checked across phone/tablet/desktop for jumps or overflow

## Deploy Safety
- [ ] `shopify.theme.toml` still points at Tamarinse Dev Horizon (not live) — reconfirm right before first production push
- [ ] No `--allow-live` used anywhere in the project's history
- [ ] Product page mirrors homepage's v1 information order, restyled per brand direction

## Pre-Publish
- [ ] Full theme reviewed on real mobile device, not just browser responsive mode
- [ ] `shopify theme check` run clean (or warnings triaged) before final push
- [ ] Stakeholder sign-off on copy in `CONTENT.md`'s "Not Yet Approved" section
