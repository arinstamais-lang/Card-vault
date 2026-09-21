# Rehost Ari’s Card Vault on Cloudflare Workers

Status: **Workers is the product host.** Live URL: https://card-vault.ariscardvault.workers.dev  
Auth is GitHub OAuth (not Google, not ChatGPT) behind `getVaultIdentity()`. PRs in this repo still **do not auto-deploy** — HQ runs `wrangler deploy`. See [`CUTOVER.md`](./CUTOVER.md) for when to retire ChatGPT Sites.

The app is vinext + Cloudflare D1/R2.

## Why

ChatGPT Sites injects `oai-authenticated-user-*` headers and owns `/signin-with-chatgpt`. That only works on `*.chatgpt.site`. A public Worker must not trust those headers (they can be spoofed). GitHub OAuth + an HMAC session cookie replaces SIWC. There is no Google auth.

## One-time Cloudflare setup

Account ID (already provisioned): `f82810c8a9f4145c732dfbc751ce5976`

Worker name: `card-vault`  
`workers_dev = true` in `wrangler.toml`  
Workers hostname: `https://card-vault.ariscardvault.workers.dev`  
D1 database name: `card-vault` (binding `DB`, database_id `a85197a6-e0ba-465f-b4f6-b17d8939a5d8`)  
R2 bucket name: `card-vault` (binding `BUCKET`)

D1 `card-vault` and R2 bucket `card-vault` exist on this account. `wrangler.toml` already points at both.

Do **not** commit API tokens. Use `CLOUDFLARE_API_TOKEN` in the shell or `wrangler login`.

## Required secrets

Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps). Homepage URL `https://card-vault.ariscardvault.workers.dev`. Authorized callback URL:

```text
https://card-vault.ariscardvault.workers.dev/auth/github/callback
```

Add `http://localhost:5173/auth/github/callback` as a second callback if you test locally (GitHub OAuth Apps allow one callback; for local use a separate OAuth App or temporarily change the callback).

Put values in the Worker with Wrangler. Do not invent or commit credentials:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` must be a long random string (32+ bytes). Example generator (run locally, do not paste the output into git):

```bash
openssl rand -base64 48
```

Optional:

```bash
# GitHub vault user id looks like github:<id>. Only then is the seed UFC/silver catalog attached.
npx wrangler secret put VAULT_LEGACY_OWNER_ID

# Leave unset to keep eBay links as plain AU search (no affiliate tracking).
npx wrangler secret put EBAY_CAMPAIGN_ID
npx wrangler secret put EBAY_MARKETPLACE_ID
npx wrangler secret put EBAY_TOOL_ID
```

Local Wrangler/Vite reads `.dev.vars` (gitignored). Copy `.dev.vars.example` and fill it in. Until GitHub creds exist, `/auth/github` returns **503** with “GitHub sign-in is not configured” — it does not mint a fake session.

## Deploy

```bash
npm ci          # or npm run install:ci on the Sites Linux image
npm test        # vinext build + Node tests
npx wrangler deploy
# or: npm run cf:deploy
```

`wrangler.toml` is the source of truth. `vite.config.ts` lets `@cloudflare/vite-plugin` load it. The ChatGPT Sites vite plugin only runs when `SITES_BUILD=1`.

A successful `wrangler deploy` (after GitHub secrets and drizzle 0000–0005) serves `https://card-vault.ariscardvault.workers.dev`. Later product PRs still need HQ to deploy.

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
- GitHub numeric user id is stored as `github:<id>` so it cannot collide with old ChatGPT ids and stays stable if the login is renamed
- Session cookie `vault_session` is HttpOnly, SameSite=Lax, HMAC-SHA256, 30 days, Secure on non-localhost HTTPS hosts
- Collection APIs, scanner, export/delete still 401 without a valid session
- Honesty rules are unchanged: never invent card fields or sold prices

## Cutover

See [`CUTOVER.md`](./CUTOVER.md): workers.dev is primary; retire ChatGPT Sites after GitHub sign-in, scan/save/export, and Home Screen icons are on the Worker.

## Optional Sites rebuild

Only if someone must rebuild the old host from this tree:

```bash
SITES_BUILD=1 npm run build
```

That copies `.openai/hosting.json` and `drizzle/` into `dist/.openai/`. GitHub auth still applies; SIWC headers are no longer trusted.

## Verify (no production claim from a PR)

```bash
npm test
```

Manual after HQ deploy: open `/` signed out → **Sign in with GitHub**. Missing secrets → error page, still signed out. With secrets → GitHub authorize → empty private vault for a new user.
