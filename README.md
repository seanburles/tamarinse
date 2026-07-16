# Tamarinse™ — Shopify Theme Project

Start here, then read in this order:

1. **`BUILD_GUIDE.md`** — theme choice, folder structure, build order, safe deploy workflow. Read before writing any code.
2. **`MASTER_PROMPT.md`** — homepage content map, style tokens, WebGL hero bottle spec.
3. **`CONTENT.md`** — verbatim approved copy. Use exactly as written; flag gaps instead of inventing copy.
4. **`data/ingredients.json`** — shared ingredient/research-org data, referenced across the capsule sequence, ingredient science section, and product page.
5. **`shopify.theme.toml`** — pins every CLI command to the Tamarinse Dev Horizon theme. Never edit this to point at the live theme.
6. **`.cursor/rules/tamarinse.mdc`** — always-loaded agent context in Cursor; encodes the non-negotiables from the docs above so they don't need re-explaining each session.
7. **`docs/Tamarinse-Website-Client-Brief.pdf`** — the original client brief. The working docs above already incorporate it; kept for reference/traceability. Where the brief and BUILD_GUIDE/CONTENT disagree (e.g. artificial reviews, question count), the working docs' flagged positions win until the client confirms otherwise.

## Quick start

```bash
# confirm the pinned theme is still the dev theme, not live
shopify theme list --environment dev

# local dev server
shopify theme dev --environment dev
```

Never pass `--allow-live` / `-a` on any `shopify theme` command in this project.
