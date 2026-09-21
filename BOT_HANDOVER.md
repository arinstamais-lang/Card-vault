# Ari's Card Vault — Bot Handover

Live site: https://aris-card-vault.aristama27.chatgpt.site/

## Product goal

Build a mobile-first collector app that lets users scan trading cards, confirm the exact card, keep a private collection, view interactive front/back images, and track evidence-based market values. UFC cards are the first category; precious metals and other tangible assets may be added later.

## Preserve first

- Existing card and silver images in `public/cards` and `public/metals`
- Current collection data and front/back pairings
- Authentication and per-user data separation
- Light/dark presentation and mobile layout
- Current live site while changes are developed and tested

## Current implementation areas

- Main experience: `app/card-vault.tsx`
- Card scanning API: `app/api/scan-card/route.ts`
- Asset records API: `app/api/assets/route.ts`
- Card image API: `app/api/card-image/route.ts`
- Financial data API: `app/api/financials/route.ts`
- Authentication helpers: `app/auth.ts` (GitHub OAuth) and `app/vault-auth.ts`
- Privacy page: `app/privacy/page.tsx`

## Immediate priority

1. Audit what genuinely works versus simulated UI.
2. Preserve every existing card, image and record.
3. Test sign-in, separate user collections, scanner front/back capture, manual correction and saving.
4. Make scanner results drafts that require user confirmation.
5. Separate sold-price evidence from active asking prices.
6. Keep affiliate tracking disabled until an approved eBay campaign ID is configured.

## Scanner fields

Athlete, sport, manufacturer, year, set, card number, parallel, serial number, print run, autograph, memorabilia, rookie status, grader, grade, condition, confidence, front image and back image.

Never invent uncertain fields. Flag them for review.

## Development rules

- Inspect before changing.
- Do not rebuild working features.
- Batch related changes.
- Do not expose API keys or private customer data.
- Use deterministic code for accounts, permissions, calculations, filters and storage.
- Use AI only for image reading, uncertain matching and useful valuation research.
- Avoid duplicate agents, searches, builds, tests and deployments.
- Test the changed flows once as a batch, then deploy one stable version.
- Security and data protection take priority over saving usage.

## Important limitation

This ZIP is a source snapshot. It does not contain deployment credentials or hosted secrets. Do not claim the live ChatGPT Site has been changed unless the relevant hosting access is connected and a deployment is verified.
