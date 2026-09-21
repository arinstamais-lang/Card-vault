# Ari's Card Vault — Phase 1 source audit

Audited: 2026-09-21  
Live site: https://aris-card-vault.aristama27.chatgpt.site/  
Scope: ChatGPT Sites export on `main`. **PATCH, do not rebuild.**

## REAL vs DEMO vs BROKEN

### REAL

| Area | What is actually implemented |
| --- | --- |
| **Auth** | Sign in with ChatGPT via dispatch-owned `/signin-with-chatgpt` → `auth.openai.com`. Identity comes from `oai-authenticated-user-id` + `oai-authenticated-user-email`. Home is `force-dynamic`. Logged-out visitors only see landing + `/privacy`. |
| **Private collection API** | `GET`/`POST /api/assets` require a signed-in user and filter/write by `owner_id`. New rows always use the current ChatGPT user id. |
| **Scanned photo storage** | `POST /api/scan-card` writes front/back files to R2 (`BUCKET`) under `scans/…` with `ownerId` metadata, then stores `/api/card-image?key=…` URLs on the asset. |
| **Private image read** | `GET /api/card-image` requires sign-in, rejects path traversal, and only serves a key if a matching owned asset row exists. |
| **Purchase costs** | `GET`/`PUT /api/financials` require sign-in and filter by owner. Used for personal cost / return, not market comps. |
| **On-device OCR** | Scanner loads Tesseract in the browser (`/tesseract/*` + `eng.traineddata.gz`) and parses text in `lib/card-detection.ts`. Save is a **confirmation step**: user reviews/edits fields, then POSTs photos + confirmed text. |
| **DB schema** | D1 (`DB`) with Drizzle: `assets` and `asset_financials`, including `owner_id` (migration `0003`). Bindings declared in `.openai/hosting.json`. |
| **eBay search** | `/go/ebay` 302s to eBay Australia search. Affiliate query params are **gated** on `EBAY_CAMPAIGN_ID` + `EBAY_MARKETPLACE_ID` and stay off if unset. |
| **Metal spot prices** | Signed-in UI fetches `api.gold-api.com` in the browser for XAU/XAG AUD. Failure shows “feed reconnecting”; it does not invent a number. |
| **Seed owner photos** | 12 UFC cards (`public/cards/*.webp`) + James Bond 1 oz silver (`public/metals/*.webp`) are **in this git tree** and currently served on the live site. Also preserved: unused `carlos-prates-cav-cps-46-99-*.png` (not in the in-app catalog). Nothing in app code deletes these files. |

### DEMO / seed / marketing (not a live evidence engine)

| Area | Notes |
| --- | --- |
| **Landing “Smart card scanner” / “Private by default”** | Marketing copy on the public page. The real scanner and collection only appear **after** ChatGPT sign-in on `/`. |
| **Built-in UFC + silver catalog** | Hardcoded in `app/card-vault.tsx` (`ufcCards` + James Bond object). Shown only when `VAULT_LEGACY_OWNER_ID` matches the signed-in user. Other users get an empty vault plus their own D1 rows. |
| **Card “sold” / listing / guide prices** | Static fields (`valueAud`, `marketUsd`, `marketLabel`, `confidenceNote`, `sourceUrl`). Labels distinguish sale vs listing vs guide, but there is **no live sold-comp API**. Do not treat these as evidence-based valuations. |
| **James Bond collector value** | `Math.max(120, liveMelt)` — a baked-in floor, not a researched resale feed. Melt itself is live spot when the feed works. |
| **“Send to Codex for research” copy** | UI hint only. No research job, webhook, or sold-price pipeline. |
| **Affiliate commission copy** | Search links are real. Tracking IDs are not wired unless env vars are set. Privacy page now says tracking is currently off. |
| **Scanner field coverage vs brief** | Brief wants manufacturer, autograph, memorabilia, rookie, grader, grade, condition as distinct fields. The app stores a generic `assets` row (name, description, serial, images). Extra text is concatenated into description/parallel. |
| **Showcase mode** | Local UI toggle that hides purchase cost/return. Not a sharing or public-collection feature. |

### BROKEN / gaps (documented; not rebuilt)

| Area | Status |
| --- | --- |
| **`/scan` `/collection` `/cards` `/app` `/vault`** | 404. Intentional: collection + scanner are on `/` after login. Do not add fake routes. |
| **In-app export / delete** | None. No `DELETE /api/assets`. Privacy page is the request path (contact owner). |
| **Edit saved assets** | No PATCH. Only new assets and purchase-cost upserts. |
| **OCR language pack listing** | Live `/tesseract/lang/eng.traineddata` is 404; Tesseract.js uses `eng.traineddata.gz`, which **is** in git and on live. |
| **Static owner photos are world-readable** | `/cards/*.webp` and `/metals/*.webp` are public static files (HTTP 200, no auth). Scanned R2 photos are not. Moving seed photos behind auth would be a later change, not a Phase 1 rewrite. |
| **Financials primary key** | `asset_key` is global. A signed-in user can insert a cost row for a key nobody owns yet, which can block the real owner’s later PUT. Seed UFC keys are not D1 `assets` rows, so a naïve “must own asset id” check would break legacy cost tracking. Left unchanged. |
| **No rate limits in app code** | Relies on the host. |
| **D1 row cap** | Assets GET is limited to 200. |
| **Starter leftovers** | `examples/d1/app/api/notes` has no auth and is **not** mounted under `app/`. |
| **Live ChatGPT Site** | This GitHub snapshot cannot publish the hosted site by itself. Do not claim the live URL changed until Sites deploy is connected. |

## Private ownership (how it is enforced)

1. **Gate:** `getVaultIdentity()` (`app/vault-auth.ts`) returns null without ChatGPT id+email. Every collection API returns **401** if unsigned.
2. **Read isolation:** `assets` and `asset_financials` queries use `inArray(ownerId, identity.ownerIds)`.
3. **Write isolation:** inserts set `ownerId: identity.user.id`. Financial PUT rejects an existing row whose owner is not in `ownerIds` (403).
4. **Legacy owner:** if runtime `VAULT_LEGACY_OWNER_ID` equals the current user id, `ownerIds` is `[user.id, "legacy-owner"]` so pre-migration D1 rows remain visible to Ari only. Other accounts never receive the built-in UFC array (`hasLegacyVault` is false).
5. **R2 scans:** served only through `/api/card-image` after a DB ownership check.
6. **Gaps:** public `/cards` and `/metals` URLs; financials key squatting (above); no object-level ACL beyond the DB row.

Unsigned `GET /api/assets` on the live site returns **401** (verified). The public homepage does not render cards.

## Card images and deletion

**Paths**

- Owner UFC photos: `public/cards/<slug>-front.webp` and `-back.webp` (12 cards, 24 webp files). Referenced by the `ufcCards` array in `app/card-vault.tsx`.
- Extra owner files not shown in the catalog: `public/cards/carlos-prates-cav-cps-46-99-front.png` and `-back.png`. Left in place.
- Silver: `public/metals/james-bond-60-years-1oz-front.webp` and `-back.webp`.
- User scans: R2 keys `scans/<uuid>-front|back.<ext>` → `/api/card-image?key=…`.
- Live `/cards/…webp` bytes match this git tree (spot-checked). Binary folders are easy to miss in source listings; they were already on `main`.

**What can delete photos**

- `POST /api/scan-card` deletes **only** the R2 keys it just wrote, and only if validation/DB insert fails. Message: “Your photos were not kept.”
- There is **no** delete-collection endpoint, no bulk wipe, and no code that unlinks `public/cards` or `public/metals`.
- A future deploy that dropped those public files **would** remove them from the static host. This PR does not remove or rewrite any image files.

## Smallest patches in this PR (no rebuild)

1. Privacy page: honest export/delete status; affiliate tracking currently off; no fake sold-price feed.
2. OCR: if sport is not actually read from the card, leave it blank instead of inventing “Trading card”.
3. Scanner footer: stop forcing a single row on narrow screens so the existing dialog footer can stack.
4. This audit file. Seed photos were already in git; none were replaced.

Not done (by design): new routes, affiliate campaign IDs, live sold comps, account-deletion product, moving seed photos into R2, rebuilding the scanner field model.

## Public-surface check (no ChatGPT session)

- `/` landing + SIWC button → OAuth authorize (302).
- `/privacy` 200.
- `/api/assets` 401.
- `/scan` and `/collection` 404.
- `/cards/…-front.webp` 200 (public static; see gap above).
