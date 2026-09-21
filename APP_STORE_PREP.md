# App Store / TestFlight preparation (not an upload)

**Status:** documentation only. This repository is a Cloudflare Workers / vinext web app (PWA). There is **no** Capacitor, Cordova, or Xcode project, so **nothing can be uploaded to TestFlight from this PR**. Ari must create an Apple Developer account and, if a native wrapper is added later, archive and upload that binary with those credentials.

Do **not** claim TestFlight, App Review, or an App Store listing exists until those steps are actually completed.

## What this app is today

| Channel | Reality |
| --- | --- |
| Web / PWA | Install from Safari (iPhone: Share → Add to Home Screen) or Chrome (Install app). |
| App Store | Not listed. Would need a native wrapper + Apple Developer Program ($99 USD/year). |
| TestFlight | Not uploaded. Needs a signed iOS build and App Store Connect access. |

## If a thin iOS wrapper is added later

Suggested stack if Ari later wants TestFlight: Capacitor wrapping this same origin, or an SFSafariViewController / WKWebView shell that loads the hosted site. Do **not** rewrite auth, scanner confirmation, export/delete, or valuation to ship a wrapper.

### Apple account steps (Ari)

1. Enrol in [Apple Developer Program](https://developer.apple.com/programs/).
2. In App Store Connect, create the app record (bundle ID, name **Ari's Collector Vault** or **Ari's Vault**).
3. Create iOS distribution certificates and a provisioning profile.
4. Archive the wrapper in Xcode and upload with Transporter / Xcode Organizer.
5. Add internal testers in TestFlight. **Only Ari can do this.**

### Info.plist usage string drafts

Paste as-is or lightly edit. Keep them accurate: the app uses camera and photos **only** to capture trading-card front/back images the user chooses to save.

**`NSCameraUsageDescription`**

> Ari's Vault uses the camera so you can photograph the front and back of a trading card. Photos stay in your private collection after you review and save them.

**`NSPhotoLibraryUsageDescription`** (if the wrapper reads the library)

> Ari's Vault lets you choose an existing card photo from your library when you do not want to use the camera.

**`NSPhotoLibraryAddUsageDescription`** (only if the wrapper saves back to Photos — current web app does **not**)

> Not used by the current web app. Omit unless a native wrapper writes to Photos.

**`NSMicrophoneUsageDescription`**

> Omit. The scanner does not record audio.

**`NSLocationWhenInUseUsageDescription`**

> Omit. Location is not collected.

### Associated domains / ATS

- Load the hosted HTTPS origin only (`https://card-vault.ariscardvault.workers.dev` until a custom domain exists).
- Do not disable App Transport Security.
- If using Universal Links later, add `applinks:` for the Workers (or custom) hostname after DNS is stable.

## App privacy nutrition-label answers (draft)

Use App Store Connect → App Privacy. Answers below match **this web app’s current behaviour**. Re-check if a wrapper adds analytics or crash reporters.

### Data collection overview

| Data type (Apple label) | Collected? | Linked to identity? | Used for tracking? | Notes |
| --- | --- | --- | --- | --- |
| Email address | Yes (via GitHub OAuth, stored in the session cookie) | Yes | No | Used to operate the signed-in vault. GitHub password is never received. |
| Name | Optional (GitHub profile name if present) | Yes | No | Display in the header. |
| User ID | Yes (`github:<id>`) | Yes | No | Ownership key for D1/R2 records. |
| Photos or videos | Yes, user-provided card scans | Yes | No | Front/back images the user confirms. On-device OCR first. Stored privately (R2) for that account. |
| Product interaction | No first-party analytics SDK | — | No | Hosting platform logs may exist outside this repo. |
| Purchase history | Optional purchase price/date the user types | Yes | No | Private cost/return only; included in private export; hidden in showcase mode. |
| Search history | No persistent store of eBay queries | — | No | eBay searches open eBay. Affiliate params only if campaign IDs are configured. |
| Location | No | — | No | |
| Contact info (phone, address) | No | — | No | |
| Financial info (bank, card number) | No | — | No | Collection purchase notes are not payment-card data. |
| Health / sensitive | No | — | No | |
| Identifiers for advertising | No | — | No | |
| Diagnostics / crash | None in app code | — | No | Do not enable unless a wrapper adds them, then disclose. |

**Privacy nutrition-label grouping (draft):**

- **Contact Info:** Email Address — App Functionality; linked to identity; not used for tracking.
- **Identifiers:** User ID — App Functionality; linked to identity; not used for tracking.
- **User Content:** Photos or Videos — App Functionality; linked to identity; not used for tracking.
- **Other User Content:** optional notes, serials, purchase prices — App Functionality.

**Tracking:** declare **no tracking** unless a future eBay campaign / analytics SDK uses data to track across apps. Current affiliate tags are off unless `EBAY_CAMPAIGN_ID` and `EBAY_MARKETPLACE_ID` are both set; even then they apply after the user leaves for eBay.

**Third-party partners to list if asked:**

- GitHub (OAuth sign-in).
- Cloudflare (Worker, D1, R2) as declared in `wrangler.toml`.
- eBay (user-initiated search; eBay’s policy applies off-site).
- Public metal spot feed (`api.gold-api.com`) fetched in the browser when signed in.

### Data use purposes (Apple)

- **App Functionality** for account, scans, collection, export, delete.
- Do **not** select Advertising, Third-Party Advertising, or Tracking unless that is later added.

### Retention / deletion (store listing copy draft)

> Saved cards, scans and purchase notes stay in your account until you export or delete them. You can download a private copy or type DELETE MY VAULT to wipe saved vault data. App-shipped catalog photos are not your private scans. Sign-in is through GitHub; we never receive your GitHub password.

## App Review notes draft (for a future wrapper)

- Demo account: GitHub sign-in is required; provide a reviewer account or a video if Apple cannot complete OAuth.
- Camera: used only on Scan card → front and back; user confirms details before save.
- No user-generated public social feed.
- Asking prices and sold evidence are labelled separately; the app does not invent sold comps.

## Out of scope for this document

- Inventing sold prices.
- Uploading a binary without Apple credentials.
- Claiming workers.dev already received these PWA files until HQ ran `wrangler deploy` for this commit.
