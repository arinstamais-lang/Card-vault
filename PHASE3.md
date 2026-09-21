# Ari's Card Vault — Phase 3

Date: 2026-09-21  
Base: `main` after Phase 2 PR #2  
Rule: **PATCH**. Auth, scanner confirmation, export, and delete were not rebuilt.

## Done

| Item | What shipped |
| --- | --- |
| **Precise eBay AU phrases** | Confirmed card fields (name, year, set, number, parallel, serial, grade flags) build the search query in `lib/card-fields.ts` + `lib/ebay-search.ts`. |
| **Asking ≠ sold** | Active listings use a plain AU search. Sold searches add `LH_Sold=1` + `LH_Complete=1`. UI labels are **ASKING PRICE** vs **SOLD EVIDENCE**. Asking amounts never fill the sold/estimated range. |
| **Per-card evidence** | Range (AUD, optional USD), date checked, source links, exact vs comparable, raw/graded if known, and confidence. No live market value is invented. |
| **Catalog UFC notes** | Hardcoded prices are **stored notes / not live evidence**. The old “SOLD” badge on listing-or-note data is gone. |
| **Affiliate honesty** | `/go/ebay` adds `campid` / `mkevt` / related params **only** when both `EBAY_CAMPAIGN_ID` and `EBAY_MARKETPLACE_ID` are set. Missing IDs stay a plain eBay search. |
| **Valuation history** | Optional `valuation_history` table (migration `0005`) + `GET`/`POST /api/valuations`. Same owner checks as financial keys. Included in private export as `valuations.json`. Wiped with asset/account delete. |
| **Tests** | Asking never labelled sold; catalog “sale” notes stay stored notes; missing affiliate IDs do not fake tracking; sold vs active URLs differ; unsigned `/api/valuations` is 401. |
| **Docs** | This file. Privacy page states asking ≠ sold and affiliate gating. |

## Still open / out of scope

| Item | Status |
| --- | --- |
| **Live eBay sold scraping** | Not built. Users can open sold search and record a check. The app does not invent comps. |
| **ChatGPT Sites deploy** | This snapshot cannot publish the live site. Apply D1 migration `0005` on hosted D1 after deploy access exists. |
| **Native apps / metals expansion** | Out of scope. Silver melt is still the live feed; collector premium stays a stored note. |
| **Affiliate campaign IDs** | Still off until env is set. `/go/ebay` remains honest. |

## Authz

Unsigned **401**: `GET`/`POST /api/valuations` (plus existing collection routes). Writes require owning `asset-{id}` or being the legacy owner for seed catalog keys.
