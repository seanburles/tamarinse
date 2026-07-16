# Tamarinse™ — Approved Copy (Verbatim)

Source of truth for on-page text. If a section needs copy not listed here, flag it — don't generate a placeholder that looks final.

---

## Hero

**Headline:** Daily Defense Against Microplastics™

**Subheadline:** Physician Formulated • USDA Organic • Clinically Studied Ingredients. Made in the USA

**Primary CTA:** Shop Tamarinse™
**Secondary CTA:** How It Works

## Meet Tamarinse (positioning line, also usable as PDP intro)

Tamarinse is the first premium supplement built around tamarind seed extract for daily environmental defense. Our formula combines five plant-based ingredients designed to support your body's natural detoxification pathways and digestive elimination. 60 capsules per bottle. 30-day supply.

## Exposure Assessment — Question Set

**Intro copy:** "How exposed are you to microplastics in your daily life? Select all that apply:"

1. Drink bottled water regularly?
2. Heat food in plastic containers?
3. Store leftovers in plastic containers?
4. Frequently order takeout or food delivery?
5. Drink coffee with plastic lids?
6. Use non-stick cookware?
7. Use plastic cutting boards?
8. Drink from protein shaker bottles or plastic water bottles daily?
9. Brew tea using tea bags?
10. Eat seafood two or more times per week?
11. Frequently eat processed or packaged foods?
12. Microwave food in its original plastic packaging?
13. Use plastic food storage bags or plastic wrap regularly?
14. Wear synthetic athletic clothing (polyester, nylon, or spandex) several times a week?
15. Handle thermal paper receipts several times per week?

**Result tiers:** Low / Moderate / High / Very High
**Result display copy:** "Your estimated exposure is [tier]."

*(Client brief: a "High" result is the intended outcome for typical respondents — tune question weights so common exposure patterns land there. Brief also says "10–12 simple questions" but supplies 15; questions are editable blocks, so ship all 15 and let the client trim.)*

## How Tamarinse™ Works — Timeline Steps

**Exposure**
Every day, you're exposed to microplastics and other unwanted compounds through food, water, beverages, packaging, and the environment.

**Activates**
The delayed-release capsule is designed to bypass stomach acid before releasing the Tamarinse™ blend where it's intended to work.

**Binds**
The proprietary blend forms a natural fiber matrix that helps bind targeted compounds within the digestive tract.

**Supports**
Clinically studied plant-based ingredients work together to support healthy digestive function and the body's natural elimination processes.

**Naturally Eliminates**
Bound compounds are carried through the digestive system and eliminated naturally rather than remaining available for absorption.*

*(asterisk footnote — standard supplement disclaimer, confirm exact wording with client/legal before launch)*

## Interactive Capsule — Layer Copy

**Layer One:** Delayed-Release Capsule — Designed to bypass stomach acid before releasing its ingredients where they're intended to work.

**Layer Two (ingredient reveal order):**
1. Tamarind Seed Extract
2. Okra Polysaccharides
3. Fenugreek Extract
4. Activated Coconut Charcoal
5. Organic Chlorella
6. Milk Thistle Extract

## Ingredient Science — Section Intro

**Built on Published Research**
Every ingredient in Tamarinse™ was selected for a specific purpose. Each ingredient is supported by published research from respected universities, medical organizations, and peer-reviewed scientific journals.

*(Per-ingredient what-it-is / why-we-chose-it / research org copy lives in `data/ingredients.json`, not duplicated here — see that file.)*

**Section close copy:**
"Every Ingredient. Every Purpose. Unlike formulas that rely on a single 'hero ingredient,' Tamarinse™ combines multiple plant-derived compounds supported by research from leading scientific institutions and peer-reviewed journals. Every ingredient is included for a reason. Every claim is backed by published research."

**Featured research orgs banner** (client brief's "featured companies Banner"): renders with the section close, listing the eight orgs in `data/ingredients.json` → `featuredResearchOrgs`. Text/logo treatment, not third-party logos we don't have rights to — confirm any logo usage with client.

## Quality Standards (icon row labels)

- USDA Organic
- Physician Formulated
- Clinically Studied Ingredients
- Manufactured in the USA
- Third-Party Tested (when available)

## Why Tamarinse™ — Three Pillars

**Daily Defense** — Designed for everyday environmental exposure.
**Clean Ingredients** — Plant-based, physician formulated, and clinically studied.
**Smarter Delivery** — Delayed-release technology helps deliver ingredients where they're intended to work.

## The Problem — Imagery Shot List (from client brief)

One subject per screen, full-bleed: plastic food containers, bottled water, drinking water, air, household plastics, children, everyday consumer products. (Statistics still pending sourcing — see below.)

## Everyday Exposure — Section Message

Exposure happens every day.

**Imagery shot list (from client brief):** parents making lunch, office workers, coffee shops, airports, gym bags, plastic water bottles, takeout meals, grocery shopping.

## Closing Section

Microplastics aren't going away. Your daily defense starts with Tamarinse™.

**CTA:** Shop Tamarinse™

---

## Content Reused From Tamarinse.com (2026-07-16)

Pulled verbatim from the live site (client's own published copy — brief says reuse existing content):

- **FAQ** — all six published Q&As (What is Tamarinse / How do I take it / Safe daily / Why tamarind / Why glass / Shipping). Note: the first answer repeats the "five plant-based ingredients" line, same known discrepancy flagged below.
- **Advisory board** — the site's "Recommended By Experts" trio: Dr. Hubbard (Florida, USA), Dr. Anita Gupta (California, USA), Dr. Jones (Maryland, USA), with their portraits bundled as theme assets (`tamarinse-advisor-*.png`). The site shows name + state only — no written bios/credentials exist there, so the bio fields stay empty until the client supplies them.
- **Reviews** — the three quotes from the site's "What Our Customers Say" plus its 4.8/5 "4,000+ customer reviews" badge. These are attributed on the site only by initials (J / S / L). Flag: the review count/rating predates this storefront — confirm the client can substantiate it before launch.

## Not Yet Approved Copy (flag before writing)

- **"Five plant-based ingredients" vs. six ingredients**: the Meet Tamarinse positioning line above says the formula "combines five plant-based ingredients," but the capsule reveal, ingredient science section, and `data/ingredients.json` all list six (Tamarind Seed Extract, Okra Polysaccharides, Fenugreek Extract, Activated Coconut Charcoal, Organic Chlorella, Milk Thistle Extract). Possibly intentional ("built around tamarind" + five others), but confirm with client which count is correct before this line ships — using the copy verbatim as-is until then.
- The Problem section: statistics to display are not yet specified in the brief and the current site publishes none — still need real, cited sources before these go live (avoid inventing figures).
- "2026 Earth Prize winner" claim: verify documentation exists before publishing.
