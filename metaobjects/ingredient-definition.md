# Metaobject Definition — Create in Admin Before Wiring Sections

Go to **Shopify admin → Content → Metaobjects → Add definition** and create this exactly, so the `metaobject_type` referenced in section schema (`"ingredient"`) matches what actually exists.

## Definition: Ingredient

| Setting | Value |
|---|---|
| **Type** (internal name, used in schema as `metaobject_type`) | `ingredient` |
| **Name** (admin-facing label) | Ingredient |

### Fields

| Field name | Key | Type | Notes |
|---|---|---|---|
| Name | `name` | Single line text | e.g. "Tamarind Seed Extract" |
| What It Is | `what_it_is` | Single line text | Short description |
| Why We Chose It | `why_we_chose_it` | Single line text | Short description |
| Research Organizations | `research_orgs` | List of single line text | One list item per org |

### Access

Set **Storefront** access to on for this definition (Content → Metaobjects → Ingredient → Access tab). Without this, dynamic sources/theme editor connections won't see it, and it won't render on the storefront.

### After the definition exists

1. Create six entries (one per ingredient), populated from `data/ingredients.json`.
2. In the theme editor, on any section that needs the ingredient list, add a schema setting of type `metaobject_list` with `"metaobject_type": "ingredient"` (see BUILD_GUIDE.md section 4 for the reasoning), then connect it via the dynamic source picker.
3. Validate one full card (Interactive Capsule or Ingredient Science, whichever you build first) end-to-end against a real entry before assuming the pattern holds across all six — see the Horizon-specific risk flagged in BUILD_GUIDE.md.

### If you need more structure later

If ingredients ever need images, dosage, or an order/priority field, add it here first (fields are cheap to add, expensive to retrofit into six live entries) — update this doc and `data/ingredients.json`'s shape together so they don't drift.
