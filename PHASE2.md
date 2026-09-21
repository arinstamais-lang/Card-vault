# Ari's Card Vault — Phase 2

Date: 2026-09-21  
Base: `main` after Phase 1 PR #1  
Rule: **PATCH**, do not rebuild scanner or ChatGPT sign-in.

## Done

| Item | What shipped |
| --- | --- |
| **Private export** | Signed-in `GET /api/export` returns a zip (`manifest.json`, `assets.json`, `financials.json`, owned R2 scan files). Purchase prices are in this private download only. No sold comps are invented. |
| **Account / collection delete** | Header **Delete** asks the user to type `DELETE MY VAULT`. `DELETE /api/account` requires that phrase, then deletes D1 rows for `identity.ownerIds` and owned `scans/` R2 objects. Seed catalog files are not deleted. Single saved items can be removed with `DELETE /api/assets`. |
| **Edit-asset API** | `PATCH /api/assets` updates notes (`description`), name/serial/source/manual value, wishlist, showcase, and optional purchase price/date. Loads the row first and rejects another owner's id (`403`). Financial writes also require owning `asset-{id}` or being the legacy owner for seed keys. |
| **Financial key squat** | `asset_financials` primary key is now `(owner_id, asset_key)` (migration `0004`). A cost row for one owner no longer blocks another owner on the same key. PUT/PATCH refuse unknown keys and keys the caller does not own. |
| **Seed photo gap** | Worker gates `/cards/*` and `/metals/*` image paths: unsigned → `401`. If `VAULT_LEGACY_OWNER_ID` is set, only that user is served (`404` for everyone else). Responses use `cache-control: private`. Scanned photos stay on `/api/card-image` with a DB ownership check. |
| **Authz tests** | Unsigned collection APIs return `401`. Policy tests cover foreign-owner read/write denial, seed-key squat, and zip/export helpers. `npm test` loads the worker through `tests/register-cloudflare.mjs` so Node can import `cloudflare:workers`. |
| **UI** | Export + delete in the signed-in header (hidden in showcase mode). Edit dialog on saved (D1) items. ChatGPT sign-in, on-device OCR, and confirmation save are unchanged. |
| **Privacy copy** | Export/delete and catalog-photo rules described on `/privacy`. |

## Still open / out of scope

| Item | Status |
| --- | --- |
| **ChatGPT Sites deploy** | This GitHub snapshot cannot publish the live site. Do not claim https://aris-card-vault.aristama27.chatgpt.site/ changed until Sites deploy is connected. Migration `0004` must be applied on hosted D1. |
| **Host-level static CDN** | Seed photos are gated in `worker/index.ts`. If a host ever served `public/` before the Worker, `/cards` and `/metals` could still be world-readable. Moving binaries out of `public/` would need a new private asset pipeline. |
| **Legacy catalog after delete** | If `VAULT_LEGACY_OWNER_ID` matches the user, the hardcoded UFC + James Bond catalog still renders after D1 wipe. Those photos are app-shipped, not private scans. Hiding them would need a separate user preference. |
| **Wishlist/showcase on seed keys** | Flags are D1 columns. Built-in catalog cards only support purchase cost, not wishlist/showcase rows. |
| **Live eBay sold scraping** | Still not rebuilt. |
| **Affiliate campaign IDs** | Still off unless env is set. |
| **Native apps** | Out of scope. |
| **Rate limits / 200-row cap** | Unchanged. |
| **Starter `examples/d1` notes API** | Still unmounted, still no auth. Do not mount it. |
| **OCR language pack listing** | `/tesseract/lang/eng.traineddata` 404; `.gz` pack is what Tesseract.js uses. |

## Authz contract (APIs)

Unsigned requests (no ChatGPT user id + email headers) return **401**:

- `GET/POST/PATCH/DELETE /api/assets`
- `GET/PUT /api/financials`
- `GET /api/export`
- `DELETE /api/account`
- `GET /api/card-image`
- `GET /cards/…` and `GET /metals/…` (seed photos)

Signed-in but not the owner:

- PATCH/DELETE another owner's asset id → **403**
- PUT financials for `asset-{id}` the caller does not own → **403**
- PUT financials for a seed catalog key unless `isLegacyOwner` → **403**
- GET lists remain filtered by `owner_id IN identity.ownerIds`

ChatGPT sign-in, on-device OCR, and the scanner confirmation step were not rewritten.
