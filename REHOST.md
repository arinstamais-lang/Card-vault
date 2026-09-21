# Rehost Ari’s Card Vault on Cloudflare Workers

Status: **R1 platform strip** (this PR). ChatGPT Sites stays live until a later cutover. This document does not claim a production Worker is serving users.

The app is still vinext + Cloudflare D1/R2. Auth is now a portable Google OpenID adapter behind the same `getVaultIdentity()` ownership model.

## Why

ChatGPT Sites injects `oai-authenticated-user-*` headers and owns `/signin-with-chatgpt`. That only works on `*.chatgpt.site`. A public Worker must not trust those headers (they can be spoofed). Google OAuth + an HMAC session cookie replaces SIWC.

## One-time Cloudflare setup

Account ID (already provisioned): `f82810c8a9f4145c732dfbc751ce5976`

Worker name: `card-vault`  
D1 database name: `card-vault` (binding `DB`, database_id `a85197a6-e0ba-465f-b4f6-b17d8939a5d8`)  
R2 bucket name: `card-vault` (binding `BUCKET` — required; scan photos already use R2)

D1 `card-vault` exists on this account. The Worker config already points at that id.

R2 is **not** created yet. Enable R2 once in the Cloudflare dashboard for account `f82810c8a9f4145c732dfbc751ce5976`, then create the bucket:

```bash
npx wrangler r2 bucket create card-vault
```

Leave the `BUCKET` → `card-vault` binding in `wrangler.toml`. Deploying scan/export/delete will fail until that bucket exists.

Do **not** commit API tokens. Use `CLOUDFLARE_API_TOKEN` in the shell or `wrangler login`.

## Required secrets

Create an OAuth **Web application** client in Google Cloud. Authorized redirect URI:

```text
https://<worker-host>/auth/google/callback
```

On `workers.dev` that is `https://card-vault.<subdomain>.workers.dev/auth/google/callback`. Add `http://localhost:5173/auth/google/callback` (or whatever origin `npm run dev` prints) for local use.

Put values in the Worker with Wrangler. Do not invent or commit credentials:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` must be a long random string (32+ bytes). Example generator (run locally, do not paste the output into git):

```bash
openssl rand -base64 48
```

Optional:

```bash
# Google vault user id looks like google:<sub>. Only then is the seed UFC/silver catalog attached.
npx wrangler secret put VAULT_LEGACY_OWNER_ID

# Leave unset to keep eBay links as plain AU search (no affiliate tracking).
npx wrangler secret put EBAY_CAMPAIGN_ID
npx wrangler secret put EBAY_MARKETPLACE_ID
npx wrangler secret put EBAY_TOOL_ID
```

Local Wrangler/Vite reads `.dev.vars` (gitignored). Copy `.dev.vars.example` and fill it in. Until Google creds exist, `/auth/google` returns **503** with “Google sign-in is not configured” — it does not mint a fake session.

## Deploy

```bash
npm ci          # or npm run install:ci on the Sites Linux image
npm test        # vinext build + Node tests
npx wrangler deploy
# or: npm run cf:deploy
```

`wrangler.toml` is the source of truth. `vite.config.ts` lets `@cloudflare/vite-plugin` load it. The ChatGPT Sites vite plugin only runs when `SITES_BUILD=1`.

This PR does not deploy. A successful `wrangler deploy` (after Google secrets, R2 enablement + bucket create, and drizzle 0000–0005) yields a `*.workers.dev` URL. That is R1’s success bar, not a cutover.

## D1 migrations (drizzle 0000–0005)

Fresh `card-vault` D1 has no tables. Apply the committed SQL **in order**. `0000` is the base `assets` table; **0001–0005** are the collection/financials/valuation patches the live app expects.

```bash
npm run db:migrate:remote
# local Miniflare D1:
npm run db:migrate:local
```

Equivalent explicit commands:

```bash
npx wrangler d1 execute card-vault --remote --file=drizzle/0000_lyrical_carnage.sql
npx wrangler d1 execute card-vault --remote --file=drizzle/0001_lumpy_moira_mactaggert.sql
npx wrangler d1 execute card-vault --remote --file=drizzle/0002_majestic_nighthawk.sql
npx wrangler d1 execute card-vault --remote --file=drizzle/0003_brainy_vargas.sql
npx wrangler d1 execute card-vault --remote --file=drizzle/0004_phase2_collection_controls.sql
npx wrangler d1 execute card-vault --remote --file=drizzle/0005_phase3_valuation_history.sql
```

Use `--local` instead of `--remote` for Miniflare. Do not skip `0000` on an empty database. Do not generate new migrations for this rehost.

## Auth model (unchanged ownership)

- UI: `signInPath` / `signOutPath` / `requireUser` in `app/auth.ts`
- Vault: `getVaultIdentity()` in `app/vault-auth.ts` still returns `{ user, isLegacyOwner, ownerIds }`
- Google `sub` is stored as `google:<sub>` so it cannot collide with old ChatGPT ids
- Session cookie `vault_session` is HttpOnly, SameSite=Lax, HMAC-SHA256, 30 days
- Collection APIs, scanner, export/delete still 401 without a valid session
- Honesty rules are unchanged: never invent card fields or sold prices

## Cutover notes (R3 later)

- **Sites stays live.** https://aris-card-vault.aristama27.chatgpt.site/ is not deleted by this PR.
- Point people at the Worker URL only after sign-in → empty private vault → scan → save → export works (R2).
- Optional: one-time export from Sites if Ari has data to keep. Google ids will not match ChatGPT ids; map `VAULT_LEGACY_OWNER_ID` if the seed catalog should follow Ari.
- Soft-deprecate Sites after a week on the Worker. Out of scope here: custom domain, TestFlight, dedicated bot, deleting Sites.

## Optional Sites rebuild

Only if someone must rebuild the old host from this tree:

```bash
SITES_BUILD=1 npm run build
```

That copies `.openai/hosting.json` and `drizzle/` into `dist/.openai/`. Google auth still applies; SIWC headers are no longer trusted.

## Verify (no production claim)

```bash
npm test
```

Manual after HQ deploy: open `/` signed out → **Sign in with Google**. Missing secrets → error page, still signed out. With secrets → Google account picker → empty private vault for a new user.
