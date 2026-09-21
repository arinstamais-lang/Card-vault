# Ari's Card Vault — Phase 4

Date: 2026-09-21  
Base: `main` after Phase 3 PR #3  
Rule: **PATCH**. Auth, scanner confirmation, export/delete, and valuation evidence were not rebuilt.

## Done

| Item | What shipped |
| --- | --- |
| **PWA installability** | `public/manifest.webmanifest` now has 192/512/`maskable` PNG icons, `apple-touch-icon.png`, `start_url` `/`, `display: standalone`. `app/layout.tsx` links the manifest, Apple web-app meta, and `viewport-fit=cover`. |
| **Service worker** | `public/sw.js` registers from `app/pwa-register.tsx`. Precaches icons + `offline.html`. **Does not cache** `/api/`, `/cards/`, `/metals/`, sign-in, or `/go/`. Worker sets `Service-Worker-Allowed: /` and `no-cache` on `/sw.js`. This is as far as a Sites/Vite/vinext stack can go without a native wrapper. |
| **iPhone install copy** | Landing page **Install on iPhone** details (Safari → Share → Add to Home Screen). Same steps are in this file. |
| **Mobile camera scan** | Front/back capture still uses `<input type="file" capture="environment">` (rear camera). A second control **Choose from library** has no `capture` (iOS photo picker). File inputs overlay the buttons (no `pointer-events: none`, which breaks iPhone Safari). Inputs reset after each pick. Large/HEIC photos are downscaled to JPEG when the browser can decode them. Safe-area padding, 16px fields (no iOS zoom), and a permission hint. Confirmation / save flow is unchanged. |
| **Accessibility** | Contrast pass on landing CTA and muted copy; skip links; `aria-label` / `aria-pressed` on icon-only header buttons; scanner and vault alts; decorative icons `aria-hidden`. |
| **Performance (quick wins)** | Collection thumbs `loading="lazy"` + `decoding="async"` + intrinsic size; selected card `fetchPriority="high"`; `content-visibility` on list rows; scan photos resized before OCR/upload when huge. No framework rewrite. |
| **App Store / TestFlight prep** | `APP_STORE_PREP.md` — privacy nutrition-label checklist, data collected, camera usage string drafts. **No Capacitor/Swift wrapper exists in this repo**, so there is nothing to upload to TestFlight from this PR. |
| **Tests** | Existing authz, export/delete, and asking≠sold tests remain. New PWA/mobile tests cover manifest, icons, SW fetch handler, `capture="environment"`, and install copy. |

## Install on iPhone (Safari)

1. Open **https://card-vault.ariscardvault.workers.dev** in **Safari** (not an in-app browser, not Chrome on iOS for Add to Home Screen reliability).
2. Tap **Share** (square with an arrow).
3. Scroll to **Add to Home Screen** → **Add**.
4. Open **Ari's Vault** from the Home Screen. It runs standalone.
5. First scan: allow **Camera** and/or **Photos** when Safari asks.

Android Chrome may show **Install app** after the service worker is registered. That is still a PWA, not Play Store.

## Still open / Ari must do with credentials

| Item | Status |
| --- | --- |
| **Workers deploy** | This snapshot cannot publish https://card-vault.ariscardvault.workers.dev by itself. HQ runs `wrangler deploy`. ChatGPT Sites is the old host; see `CUTOVER.md`. |
| **Apple Developer account** | Required for App Store Connect, certificates, and TestFlight. Not in this repo. |
| **TestFlight upload** | **Not done.** There is no native iOS target (no Xcode project, no Capacitor). Do not claim a build was uploaded. |
| **Native wrapper** | Out of scope unless a thin Capacitor shell is added later. If added, reuse `APP_STORE_PREP.md` usage strings and privacy answers. |
| **Live eBay sold scraping / inventing sold prices** | Still not built (Phase 3 rule). |
| **Auth / confirmation / export / valuation** | Unchanged on purpose. |

## Authz (unchanged)

Unsigned collection APIs still return **401**. Asking listings are never labelled sold. Private export/delete still require sign-in and the delete phrase.

## How to verify locally

```bash
npm test
```

Manual: open `/` signed out → install copy, manifest in DevTools Application tab, scanner still has camera + library inputs in source. iPhone camera permission can only be confirmed on a real device.
